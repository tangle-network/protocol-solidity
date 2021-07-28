const fs = require('fs')
const mkdirp = require('mkdirp');
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
const circomlib = require('circomlib');

const poseidonHasher = new PoseidonHasher();

const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))

async function generatePoseidon3Input() {
  let deposit = {
    chainID: 135,
    secret: rbigint(31),
    nullifier: rbigint(31),
  }
  
  deposit.commitment = poseidonHasher.hash3([deposit.chainID, deposit.nullifier, deposit.secret]);

  const input = {
    inputs: [deposit.chainID, deposit.nullifier, deposit.secret],
    commitment: deposit.commitment
  }

  await mkdirp('build/poseidon3Preimage');
  await fs.writeFileSync('build/poseidon3Preimage/input.json', JSON.stringify(stringifyBigInts(input)));
}

generatePoseidon3Input();
