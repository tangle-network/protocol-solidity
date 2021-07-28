const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const crypto = require('crypto')

const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
  unstringifyBigInts,
  stringifyBigInts,
} = utils;
const PoseidonHasher = require('../lib/bridgePoseidon-withdraw/Poseidon'); 
const MerkleTree = require('../lib/bridgePoseidon-withdraw/MerkleTree');
const circomlib = require('circomlib')

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

  const tree = new MerkleTree(30, null, 'prefix')
  await tree.insert(deposit.commitment);
  const { root, path_elements, path_index } = await tree.path(0);

  const F = require('circomlib').babyJub.F;
  const Scalar = require("ffjavascript").Scalar;

  const input = {
    // public
    nullifierHash: deposit.nullifierHash,
    recipient: 0,
    relayer: 0,
    fee: 0,
    refund: 0,
    chainID: deposit.chainID,
    roots: [root, 0],
    // private
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements: path_elements,
    pathIndices: path_index,
    diffs: [root, 0].map(r => {
      return F.sub(
        Scalar.fromString(`${r}`),
        Scalar.fromString(`${root}`),
      ).toString();
    }),
  }

  await mkdirp('build/poseidonBridge');
  await fs.writeFileSync('build/poseidonBridge/input.json', JSON.stringify(stringifyBigInts(input)));
}

generatePoseidonBridgeInput();
