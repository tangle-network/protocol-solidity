pragma circom 2.0.0;

include "./poseidonHashT3.circom";
include "./poseidonHashT4.circom";
include "./poseidonHashT5.circom";
include "./poseidonHashT6.circom";

template Hasher3() {
    var length = 3;
    signal input in[length];
    signal output hash;

    component hasher = PoseidonHashT4();

    for (var i = 0; i < length; i++) {
        hasher.inputs[i] <== in[i];
    }

    hash <== hasher.out;
}

template Hasher4() {
    var length = 4;
    signal input in[length];
    signal output hash;

    component hasher = PoseidonHashT5();

    for (var i = 0; i < length; i++) {
        hasher.inputs[i] <== in[i];
    }

    hash <== hasher.out;
}

template Hasher5() {
    var length = 5;
    signal input in[length];
    signal output hash;

    component hasher = PoseidonHashT6();

    for (var i = 0; i < length; i++) {
        hasher.inputs[i] <== in[i];
    }

    hash <== hasher.out;
}

template HashLeftRight() {
    signal input left;
    signal input right;

    signal output hash;

    component hasher = PoseidonHashT3();
    left ==> hasher.inputs[0];
    right ==> hasher.inputs[1];

    hash <== hasher.out;
}
