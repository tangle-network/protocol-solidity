pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Nullfier = Poseidon(PublicKey_X, PublicKey_Y, Record, MembershipProof)
template Nullifier() {
    signal input publicKey_X;
    signal input publicKey_Y;
    signal input record;
    signal input pathIndices;
    signal output nullifier;

    component hasher = Poseidon(4);
    hasher.inputs[0] <== publicKey_X;
    hasher.inputs[1] <== publicKey_Y;
    hasher.inputs[2] <== record;
    hasher.inputs[3] <== pathIndices;
    nullifier <== hasher.out;
}