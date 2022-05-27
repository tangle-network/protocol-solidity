const circomlibjs = require('circomlibjs');

const hashLeftRight = (left: bigint, right: bigint) => {
  return circomlibjs.poseidon([left, right]);
};

class PoseidonHasher {
  hash (level: any, left: any, right: any) {
    return hashLeftRight(BigInt(left), BigInt(right)).toString();
  }

  hash3 (inputs: any) {
    if (inputs.length !== 3) {
      throw new Error('panic');
    }

    return circomlibjs.poseidon(inputs);
  }
}


export { PoseidonHasher };
