include "../poseidon/poseidonHashT3.circom"

template HashLeftRight() {
    signal private input left;
    signal private input right;
    signal input commitment

    component hasher = PoseidonHashT3();
    left ==> hasher.inputs[0];
    right ==> hasher.inputs[1];

    commitment === hasher.out;
}

component main = HashLeftRight();
