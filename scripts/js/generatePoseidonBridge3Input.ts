const fs = require('fs')
const path = require('path')
import * as crypto from 'crypto';

const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
  unstringifyBigInts,
  stringifyBigInts,
} = utils;
const PoseidonHasher = require('../../lib/Poseidon'); 
const MerkleTree = require('../../lib/fixed-bridge/MerkleTree');

const poseidonHasher = new PoseidonHasher();

const rbigint = (nbytes:number) => leBuff2int(crypto.randomBytes(nbytes))

async function generatePoseidonBridgeInput() {
  let deposit:any = {
    chainID: 135,
    secret: rbigint(31),
    nullifier: rbigint(31),
  }

  deposit.commitment = poseidonHasher.hash3([deposit.chainID, deposit.nullifier, deposit.secret]);
  deposit.nullifierHash =   poseidonHasher.hash(null, deposit.nullifier, deposit.nullifier);

  let refreshedDeposit:any = {
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
    roots: [root, 0, 0],
    // private
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: path_elements,
    pathIndices: path_index,
    diffs: [root, 0, 0].map(r => {
      return F.sub(
        Scalar.fromString(`${r}`),
        Scalar.fromString(`${root}`),
      ).toString();
    }),
  }

  if (!fs.existsSync('build/bridge/3')) {
    await fs.mkdirSync('build/bridge/3');
  }

  await fs.writeFileSync('build/bridge/3/input.json', JSON.stringify(stringifyBigInts(input)));
}

generatePoseidonBridgeInput();
