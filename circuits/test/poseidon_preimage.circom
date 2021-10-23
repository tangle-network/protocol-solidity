pragma circom 2.0.0;

include "../poseidon/poseidonHashT3.circom"

template HashLeftRight() {
    signal input left;
    signal input right;
    signal input commitment

    component hasher = PoseidonHashT3();
    left ==> hasher.inputs[0];
    right ==> hasher.inputs[1];

    commitment === hasher.out;
}

component main = HashLeftRight();
