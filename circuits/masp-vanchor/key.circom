pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/babyjub.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";

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
    
    component bitify = Num2Bits(254);
    bitify.in <== vk;

    component numify_253 = Bits2Num(253);
    for (var i = 0; i<253; i++) {
        numify_253.in[i] <== bitify.out[i];
    }
    
    component numify_254 = Bits2Num(253);
    for (var i = 1; i<254; i++) {
        numify_254.in[i - 1] <== bitify.out[i];
    }

    component pbk = BabyPbk();
    var significant_bit = bitify.out[253];
    var inverse_significant_bit = 1 - bitify.out[253];
    signal left_253 <== numify_253.out * inverse_significant_bit;
    signal right_254 <== numify_254.out * significant_bit;
    pbk.in <== left_253 + right_254;
    pk_X <== pbk.Ax;
    pk_Y <== pbk.Ay;
}