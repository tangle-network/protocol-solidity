import crypto from 'crypto';
const ethers = require('ethers')
const BigNumber = ethers.BigNumber
const { poseidon } = require('circomlib')

export const poseidonHash = (items) => BigNumber.from(poseidon(items).toString())

export const poseidonHash2 = (a, b) => poseidonHash([a, b])

/** Generate random number of specified byte length */
const randomBN = (nbytes = 31) => BigNumber.from(crypto.randomBytes(nbytes))

/** BigNumber to hex string of specified length */
export const toFixedHex = (number, length = 32) =>
  '0x' +
  (number instanceof Buffer
    ? number.toString('hex')
    : BigNumber.from(number).toHexString().slice(2)
  ).padStart(length * 2, '0')

export const toBuffer = (value, length) =>
  Buffer.from(
    BigNumber.from(value)
      .toHexString()
      .slice(2)
      .padStart(length * 2, '0'),
    'hex',
  )

export function bitsToNumber(bits) {
  let result = 0
  for (const item of bits.slice().reverse()) {
    result = (result << 1) + item
  }
  return result
}

module.exports = {
  randomBN,
  bitsToNumber,
  toFixedHex,
  toBuffer,
  poseidonHash,
  poseidonHash2,
}
