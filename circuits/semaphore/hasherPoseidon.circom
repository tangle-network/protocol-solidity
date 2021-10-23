pragma circom 2.0.0;

template PoseidonHashT6() {
    var nInputs = 5;
    signal input inputs[nInputs]; // private 
    signal output out;

    component hasher = Poseidon(nInputs);
    for (var i = 0; i < nInputs; i ++) {
        hasher.inputs[i] <== inputs[i];
    }
    out <== hasher.out;
}

template Hasher5() {
    var length = 5;
    signal input in[length]; // private
    signal output hash;

    component hasher = PoseidonHashT6();

    for (var i = 0; i < length; i++) {
        hasher.inputs[i] <== in[i];
    }

    hash <== hasher.out;
}
