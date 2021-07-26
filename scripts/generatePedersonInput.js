const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const utils = require("ffjavascript").utils;
const {
  beInt2Buff,
  beBuff2int,
  leBuff2int,
  leInt2Buff,
  unstringifyBigInts,
  stringifyBigInts,

} = utils;
const circomlib = require('circomlib')

const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))

const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

async function generatePedersonInput() {
  let deposit = {
    secret: BigInt("354339462272734856965588933756506576297334318376486657113480247188100282199"),
    nullifier: BigInt("109923163870731411208473251932450262009197797424129310363671945750236914626"),
  }
  const preimage = Buffer.concat([leInt2Buff(deposit.nullifier, 31), leInt2Buff(deposit.secret, 31)])

  const bePreimage = Buffer.concat([beInt2Buff(deposit.nullifier, 31), beInt2Buff(deposit.secret, 31)])

  deposit.commitment = pedersenHash(preimage)
  const commitment = pedersenHash(bePreimage)

  console.log(deposit.commitment);
  console.log(beBuff2int(leInt2Buff(deposit.commitment)));
  console.log(beBuff2int(leInt2Buff(commitment)));

  const input = {
    secret: deposit.secret,
    nullifier: deposit.nullifier,
    commitment: deposit.commitment
  }

  await fs.writeFileSync('build/pedersonPreimage/input-pederson.json', JSON.stringify(stringifyBigInts(input)));
}

generatePedersonInput();
