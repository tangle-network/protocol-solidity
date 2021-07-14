const circomlib = require('circomlib')
const hashLeftRight = require('maci-crypto').hashLeftRight;
const snarkjs = require('snarkjs')

class PoseidonHasher {
  hash(level, left, right) {
    return hashLeftRight(BigInt(left), BigInt(right)).toString()
  }
}

module.exports = PoseidonHasher;
