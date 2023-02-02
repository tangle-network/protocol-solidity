pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Nullfier = Poseidon(PublicKey_X, PublicKey_Y, Record, MembershipProof)
template Nullifier() {
    signal input record;
    signal input pathIndices;
    signal output nullifier;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== record;
    hasher.inputs[1] <== pathIndices;
    nullifier <== hasher.out;
}