import circomlib from 'circomlib';
import maci from 'maci-crypto';

class PoseidonHasher {
  hash(level, left, right) {
    return maci.hashLeftRight(BigInt(left), BigInt(right)).toString()
  }

  hash3(inputs) {
    if (inputs.length !== 3) throw new Error('panic');
    return circomlib.poseidon(inputs);
  }
}

export default PoseidonHasher;