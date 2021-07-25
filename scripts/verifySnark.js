const fs = require('fs')
const path = require('path')

const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const MerkleTree = require('../lib/tornado-withdraw/MerkleTree')
const bigInt = BigInt;
const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
  unstringifyBigInts,
  stringifyBigInts,
} = utils;

const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
const getRandomRecipient = () => rbigint(20)

function generateDeposit() {
  let deposit = {
    secret: rbigint(31),
    nullifier: rbigint(31),
  }
  const preimage = Buffer.concat([leInt2Buff(deposit.nullifier, 31), leInt2Buff(deposit.secret, 31)])
  deposit.commitment = pedersenHash(preimage)
  return deposit
}

async function snarkVerify(proof) {
  const verification_key = unstringifyBigInts(require('../build/tornado/verification_key.json'))
  return await snarkjs.groth16.verify(verification_key, proof.publicSignals, proof.proof)
}

async function runScript()
{
  let tree;
  const levels = 30;
  let prefix = 'test';
  tree = new MerkleTree(levels, null, prefix);
  const recipient = getRandomRecipient();
  const fee = bigInt(1e17);
  const refund = bigInt(0);
  const relayer = getRandomRecipient();

  const deposit = generateDeposit();
  await tree.insert(deposit.commitment);
  const { root, path_elements, path_index } = await tree.path(0);

  const input = {
    root,
    nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
    nullifier: deposit.nullifier,
    relayer,
    recipient,
    fee,
    refund,
    secret: deposit.secret,
    pathElements: path_elements,
    pathIndices: path_index,
  };

  // await fs.promises.writeFile('./input.json', JSON.stringify(stringifyBigInts(input)));

  const proof = await snarkjs.groth16.fullProve(input, "../artifacts/circuits/tornado/withdraw_30.wasm", "../build/tornado/circuit_final.zkey");
  let result = await snarkVerify(proof);
  console.log(result);
  return;
}

runScript()