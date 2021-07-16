const wasmsnark = require('wasmsnark');

const utils = require('wasmsnark/tools/buildWitness');
console.log(utils);

const build = () => {
  return wasmsnark.buildBn128().then( (bn128) => {
    bn128 = bn128;
    groth16GenProof = function(witness, provingKey, cb) {

        const p = bn128.groth16GenProof(witness, provingKey);

        if (cb) {
            p.then( (proof) => {
                cb(null, proof);
            }, (err) => {
                cb(err);
            });
        } else {
            return p;
        }
    };

    groth16Verify = function(verificationKey, input, proof, cb) {

        const p = bn128.groth16Verify(verificationKey, input, proof);

        if (cb) {
            p.then( (proof) => {
                cb(null, proof);
            }, (err) => {
                cb(err);
            });
        } else {
            return p;
        }
    };

    return  {
      bn128,
      groth16GenProof,
      groth16Verify,
    };
  });
}

module.exports = build;