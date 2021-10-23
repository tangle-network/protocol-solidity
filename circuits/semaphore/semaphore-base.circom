pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom";
include "./tree.circom";


template CalculateSecret() {
    signal input identity_nullifier; // private
    signal input identity_trapdoor; // private

    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== identity_nullifier;
    hasher.inputs[1] <== identity_trapdoor;
    out <== hasher.out;
}

template CalculateIdentityCommitment() {
    signal input secret_hash; // private

    signal output out;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret_hash;
    out <== hasher.out;
}

template CalculateNullifierHash() {
    signal input external_nullifier; // private
    signal input identity_nullifier; // private
    signal input n_levels; // private

    signal output out;

    component hasher = Poseidon(3);
    hasher.inputs[0] <== external_nullifier; 
    hasher.inputs[1] <== identity_nullifier; 
    hasher.inputs[2] <== n_levels; 
    out <== hasher.out;
}

// Set membership gadget is handled with a multiplicative trick.
//
// For a given set of elements, a prover first computes the difference between
// each element in the set and the element they are proving knowledge of. We
// constrain this operation accordingly. We then multiply all differences and constrain
// this value by zero. If the prover actually knows an element in the set then for that
// element, it must hold that the difference is 0. Therefore, the product of 0 and
// anything else should be 0. The prove can't lie by adding a zero into the diffs set
// because we constrain those to match all elements in the set respectively.
template SetMembership(length) {
  signal input element; // private
  signal input set[length]; // private
  signal input diffs[length]; // private

  signal product[length + 1];
  product[0] <== element;
  for (var i = 0; i < length; i++) {
    set[i] === diffs[i] + element;
    product[i + 1] <== product[i] * diffs[i];
  }

  product[length] === 0;
}

// n_levels must be < 32
template Semaphore(n_levels, length) {

    var LEAVES_PER_NODE = 5;
    var LEAVES_PER_PATH_LEVEL = LEAVES_PER_NODE - 1;

    signal input nullifier_hash; // public 
    signal input signal_hash; // public
    signal input external_nullifier; // public
    signal input roots[length]; // public


    signal input identity_nullifier; // private
    signal input identity_trapdoor; // private
    signal input identity_path_index[n_levels]; // private
    signal input path_elements[n_levels][LEAVES_PER_PATH_LEVEL]; // private
    signal input diffs[length]; // private

    component secret = CalculateSecret();
    secret.identity_nullifier <== identity_nullifier;
    secret.identity_trapdoor <== identity_trapdoor;

    signal secret_hash;
    secret_hash <== secret.out;

    component identity_commitment = CalculateIdentityCommitment();
    identity_commitment.secret_hash <== secret_hash;

    component calculateNullifierHash = CalculateNullifierHash();
    calculateNullifierHash.external_nullifier <== external_nullifier;
    calculateNullifierHash.identity_nullifier <== identity_nullifier;
    calculateNullifierHash.n_levels <== n_levels;

    var i;
    var j;
    component inclusionProof = QuinTreeInclusionProof(n_levels);
    inclusionProof.leaf <== identity_commitment.out;

    for (i = 0; i < n_levels; i++) {
      for (j = 0; j < LEAVES_PER_PATH_LEVEL; j++) {
        inclusionProof.path_elements[i][j] <== path_elements[i][j];
      }
      inclusionProof.path_index[i] <== identity_path_index[i];
    }

    component setMembership = SetMembership(length);
    setMembership.element <== inclusionProof.root;
    for (var i = 0; i < length; i++) {
        setMembership.set[i] <== roots[i];
        setMembership.diffs[i] <== diffs[i];
    }

    //root <== inclusionProof.root;

    // Dummy square to prevent tampering signalHash
    signal signal_hash_squared;
    signal_hash_squared <== signal_hash * signal_hash;

    nullifier_hash === calculateNullifierHash.out;
}
