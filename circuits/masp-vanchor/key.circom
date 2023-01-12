pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom.circom";

// Since we don't use signatures, the keypair can be based on a simple hash
template Key() {
    signal input ak_X;
    signal input ak_Y;
    signal vk;
    signal output pk_X;
    signal output pk_Y;


    component hasher = Poseidon(2);
    hasher.inputs[0] <== ak_X;
    hasher.inputs[1] <== ak_Y;
    vk <== hasher.out;

    component pbk = BabyPbk();
    pbk.in <== vk;
    pk_X <== Ax;
    pk_Y <== Ay;
}