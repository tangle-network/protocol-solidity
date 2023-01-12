pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";

// Poseidon(DestinationChainId, PublicKey_X, PublicKey_Y, blinding)
template PartialRecord() {
    signal input chainID;
    signal input publicKey_X;
    signal input publicKey_Y;
    signal input blinding;
    signal output partialRecord

    component hasher = Poseidon(4);
    hasher.inputs[0] <== chainID;
    hasher.inputs[1] <== publicKey_X;
    hasher.inputs[2] <== publicKey_Y;
    hasher.inputs[3] <== blinding;
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