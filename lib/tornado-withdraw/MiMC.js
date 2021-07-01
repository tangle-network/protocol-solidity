const circomlib = require('circomlib')
const mimcsponge = circomlib.mimcsponge
const snarkjs = require('snarkjs')

class MimcSpongeHasher {
  hash(level, left, right) {
    return mimcsponge.multiHash([BigInt(left), BigInt(right)]).toString()
  }
}

module.exports = MimcSpongeHasher;
