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
const PoseidonHasher = require('../lib/bridgePoseidon-withdraw/Poseidon'); 
const circomlib = require('circomlib')

const poseidonHasher = new PoseidonHasher();

const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))

async function generatePoseidonInput() {
  let deposit = {
    secret: rbigint(31),
    nullifier: rbigint(31),
  }
  
  deposit.commitment = poseidonHasher.hash(null, deposit.nullifier, deposit.secret);

  const input = {
    right: deposit.secret,
    left: deposit.nullifier,
    commitment: deposit.commitment
  }

  await fs.writeFileSync('build/poseidonPreimage/input.json', JSON.stringify(stringifyBigInts(input)));
}

generatePoseidonInput();
