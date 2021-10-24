const circomlib = require('circomlibjs');
const maci = require('maci-crypto');

class PoseidonHasher {
  hash(level: any, left: any, right: any) {
    return maci.hashLeftRight(BigInt(left), BigInt(right)).toString()
  }

  hash3(inputs: any) {
    if (inputs.length !== 3) throw new Error('panic');
    return circomlib.poseidon(inputs);
  }
}

export default PoseidonHasher;