
include "../poseidon/hasher.circom";

template Poseidon3Hasher() {
    var length = 3;
    signal private input inputs[length];
    signal input commitment;

    component hasher = Hasher3();
    for (var i = 0; i < length; i++) {
        hasher.in[i] <== inputs[i];
    }

    commitment === hasher.hash;
}

component main = Poseidon3Hasher();