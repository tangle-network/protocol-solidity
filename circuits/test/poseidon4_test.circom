pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

template Poseidon4Gadget() {
    signal input outChainID;
    signal input outAmount;
    signal input outPubkey;
    signal input outBlinding;
    signal input outputCommitment;

    component outUtxoHasher = Poseidon(4);
    outUtxoHasher.inputs[0] <== outChainID;
    outUtxoHasher.inputs[1] <== outAmount;
    outUtxoHasher.inputs[2] <== outPubkey;
    outUtxoHasher.inputs[3] <== outBlinding;
    outUtxoHasher.out === outputCommitment;
}

component main {public [outputCommitment]} = Poseidon4Gadget();

