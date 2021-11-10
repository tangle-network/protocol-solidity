pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../set/membership.circom";
include "./tree.circom";


template CalculateSecret() {
    signal input identity_nullifier;
    signal input identity_trapdoor; 

    signal output out;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== identity_nullifier;
    hasher.inputs[1] <== identity_trapdoor;
    out <== hasher.out;
}

template CalculateIdentityCommitment() {
    signal input secret_hash;

    signal output out;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== secret_hash;
    out <== hasher.out;
}

template CalculateNullifierHash() {
    signal input external_nullifier;
    signal input identity_nullifier;
    signal input n_levels; // private

    signal output out;

    component hasher = Poseidon(3);
    hasher.inputs[0] <== external_nullifier; 
    hasher.inputs[1] <== identity_nullifier; 
    hasher.inputs[2] <== n_levels; 
    out <== hasher.out;
}

// n_levels must be < 32
template Semaphore(n_levels, length) {

    var LEAVES_PER_NODE = 5;
    var LEAVES_PER_PATH_LEVEL = LEAVES_PER_NODE - 1;

    signal input nullifier_hash;                                  // public
    signal input signal_hash;                                     // public
    signal input external_nullifier;                              // public
    signal input roots[length];                                   // public


    signal input identity_nullifier;                              // private
    signal input identity_trapdoor;                               // private
    signal input identity_path_index[n_levels];                   // private
    signal input path_elements[n_levels][LEAVES_PER_PATH_LEVEL];  // private
    signal input diffs[length];                                   // private

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
