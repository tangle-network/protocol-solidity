pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon(DestinationChainId, PublicKey_X, PublicKey_Y, blinding)
template PartialRecord() {
    signal input pk_X;
    signal input pk_Y;
    signal input blinding;
    signal output partialRecord;

    component hasher = Poseidon(3);
    hasher.inputs[0] <== pk_X;
    hasher.inputs[1] <== pk_Y;
    hasher.inputs[2] <== blinding;
    partialRecord <== hasher.out;
}

// Record = Poseidon(AssetId, TokenId, Amount, PartialRecord)
template Record() {
    signal input chainID;
    signal input assetID;
    signal input tokenID;
    signal input amount;
    signal input partialRecord;
    signal output record;

    component hasher = Poseidon(5);
    hasher.inputs[0] <== chainID;
    hasher.inputs[1] <== assetID;
    hasher.inputs[2] <== tokenID;
    hasher.inputs[3] <== amount;
    hasher.inputs[4] <== partialRecord;
    record <== hasher.out;
}