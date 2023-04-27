pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon(PublicKey_X, PublicKey_Y, blinding)
template InnerPartialRecord() {
    signal input blinding;
    signal output innerPartialRecord;

    component hasher = Poseidon(1);
    hasher.inputs[0] <== blinding;
    innerPartialRecord <== hasher.out;
}

template PartialRecord() {
    signal input chainID;
    signal input pk_X;
    signal input pk_Y;
    signal input innerPartialRecord;
    signal output partialRecord;

    component hasher = Poseidon(4);
    hasher.inputs[0] <== chainID;
    hasher.inputs[1] <== pk_X;
    hasher.inputs[2] <== pk_Y;
    hasher.inputs[3] <== innerPartialRecord;
    partialRecord <== hasher.out;
}

// Record = Poseidon(AssetId, TokenId, Amount, PartialRecord)
template Record() {
    signal input assetID;
    signal input tokenID;
    signal input amount;
    signal input partialRecord;
    signal output record;

    component hasher = Poseidon(4);
    hasher.inputs[0] <== assetID;
    hasher.inputs[1] <== tokenID;
    hasher.inputs[2] <== amount;
    hasher.inputs[3] <== partialRecord;
    record <== hasher.out;
}