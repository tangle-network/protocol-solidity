const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
  unstringifyBigInts,
  stringifyBigInts,
} = utils;
const PoseidonHasher = require('../../lib/Poseidon'); 
const MerkleTree = require('../../lib/MerkleTree');
const circomlibjs = require('circomlibjs')

const poseidonHasher = new PoseidonHasher();

const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))

async function generatePoseidonBridgeInput() {
  let deposit = {
    chainID: 135,
    secret: rbigint(31),
    nullifier: rbigint(31),
  }

  deposit.commitment = poseidonHasher.hash3([deposit.chainID, deposit.nullifier, deposit.secret]);
  deposit.nullifierHash =   poseidonHasher.hash(null, deposit.nullifier, deposit.nullifier);

  let refreshedDeposit = {
    chainID: 135,
    secret: rbigint(31),
    nullifier: rbigint(31),
  }

  refreshedDeposit.commitment = poseidonHasher.hash3([refreshedDeposit.chainID, refreshedDeposit.nullifier, refreshedDeposit.secret]);
  refreshedDeposit.nullifierHash =   poseidonHasher.hash(null, refreshedDeposit.nullifier, refreshedDeposit.nullifier);


  const tree = new MerkleTree(30, null, 'prefix')
  await tree.insert(deposit.commitment);
  const { root, path_elements, path_index } = await tree.path(0);

  const F = require('circomlibjs').babyjub.F;
  const Scalar = require("ffjavascript").Scalar;

  const input = {
    // public
    nullifierHash: deposit.nullifierHash,
    refreshCommitment: refreshedDeposit.commitment,
    recipient: 0,
    relayer: 0,
    fee: 0,
    refund: 0,
    chainID: deposit.chainID,
    roots: [root, 0, 0, 0, 0, 0],
    // private
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: path_elements,
    pathIndices: path_index,
    diffs: [root, 0, 0, 0, 0, 0].map(r => {
      return F.sub(
        Scalar.fromString(`${r}`),
        Scalar.fromString(`${root}`),
      ).toString();
    }),
  }

  if (!fs.existsSync('build/bridge6')) {
    await fs.mkdirSync('build/bridge6');
  }

  await fs.writeFileSync('build/bridge6/input.json', JSON.stringify(stringifyBigInts(input)));
}

generatePoseidonBridgeInput();
