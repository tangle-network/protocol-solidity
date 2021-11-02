pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Since we don't use signatures, the keypair can be based on a simple hash
template Keypair() {
    signal input privateKey;
    signal output publicKey;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== privateKey;
    publicKey <== hasher.out;
}