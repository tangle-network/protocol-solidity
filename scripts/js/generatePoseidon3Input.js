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
const circomlib = require('circomlibjs')

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

  if (!fs.existsSync('build/poseidon3')) {
    await fs.mkdirSync('build/poseidon3');
  }

  await fs.writeFileSync('build/poseidon3/input.json', JSON.stringify(stringifyBigInts(input)));
}

generatePoseidon3Input();
