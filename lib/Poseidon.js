const circomlib = require('circomlibjs')
const maci = require('maci-crypto');
const { hashLeftRight } = maci;

class PoseidonHasher {
  hash(level, left, right) {
    return hashLeftRight(BigInt(left), BigInt(right)).toString()
  }

  hash3(inputs) {
    if (inputs.length !== 3) throw new Error('panic');
    return circomlib.poseidon(inputs);
  }
}

module.exports = PoseidonHasher;
