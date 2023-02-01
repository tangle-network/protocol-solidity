pragma circom 2.0.0;

include "../merkle-tree/manyMerkleProof.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "./record.circom";
include "./nullifier.circom";

// Swap message is (aliceSpendAssetID, aliceSpendTokenID, aliceSpendAmount, bobSpendAssetID, bobSpendTokenID, bobSpendAmount, t, t')
// We check Poseidon hash of this message is signed by BOTH Alice and Bob.

template Record(levels, length) {
    signal input aliceSpendAssetID;
    signal input aliceSpendTokenID;
    signal input aliceSpendAmount;
    signal input aliceSpendPartialRecord;
    signal input bobSpendAssetID;
    signal input bobSpendTokenID;
    signal input bobSpendAmount;
    signal input bobSpendPartialRecord;
    signal input t;
    signal input tPrime;

    signal input aliceSpendPathElements[levels];
    signal input aliceSpendPathIndices;
    signal input aliceSpendNullifier; // Public Input


    signal input bobSpendPathElements[levels];
    signal input bobSpendPathIndices;
    signal input bobSpendNullifier; // Public Input
    
    signal input swapChainID; // Public Input
    signal input roots[length]; // Public Input
    signal input currentTimestamp; // Public Input

    signal input alice_pk_X;
    signal input alice_pk_Y;
    signal input bob_pk_X;
    signal input bob_pk_Y;

    signal input aliceChangeChainID;
    signal input aliceChangeAssetID;
    signal input aliceChangeTokenID;
    signal input aliceChangeAmount;
    signal input aliceChangePartialRecord;
    signal input aliceChangeRecord; 
    signal input bobChangeChainID;
    signal input bobChangeAssetID;
    signal input bobChangeTokenID;
    signal input bobChangeAmount;
    signal input bobChangePartialRecord;
    signal input bobChangeRecord; // Public Input

    signal input aliceReceiveChainID;
    signal input aliceReceiveAssetID;
    signal input aliceReceiveTokenID;
    signal input aliceReceiveAmount;
    signal input aliceReceivePartialRecord;
    signal input aliceReceiveRecord; 
    signal input bobReceiveChainID;
    signal input bobReceiveAssetID;
    signal input bobReceiveTokenID;
    signal input bobReceiveAmount;
    signal input bobReceivePartialRecord;
    signal input bobReceiveRecord; // Public Input

    // TODO: Check Swap Message Signature

    // Check all relevant asset and tokenIDs are equal
    aliceSpendAssetID === aliceChangeAssetID;
    aliceChangeAssetID === aliceReceiveAssetID;
    bobSpendAssetID === bobChangeAssetID;
    bobChangeAssetID === bobReceiveAssetID;
    aliceSpendTokenID === aliceChangeTokenID;
    aliceChangeTokenID === aliceReceiveTokenID;
    bobSpendTokenID === bobChangeTokenID;
    bobChangeTokenID === bobReceiveTokenID;

    // Check amount invariant
    aliceSpendAmount === aliceChangeAmount + aliceReceiveAmount;
    bobSpendAmount === bobChangeAmount + bobReceiveAmount;

    // Check timestamps
    


    // Check Alice Spend Merkle Proof
    component aliceSpendRecordHasher = Record();
    aliceSpendRecordHasher.chainID <== swapChainID;
    aliceSpendRecordHasher.assetID <== aliceSpendAssetID;
    aliceSpendRecordHasher.tokenID <== aliceSpendTokenID;
    aliceSpendRecordHasher.amount <== aliceSpendAmount;
    aliceSpendRecordHasher.partialRecord <== aliceSpendPartialRecord;

    component aliceMerkleProof = ManyMerkleProof(levels, length);
	aliceMerkleProof.leaf <== aliceSpendRecordHasher;
	aliceMerkleProof.pathIndices <== aliceSpendPathIndices;
	for (var i = 0; i < levels; i++) {
	aliceMerkleProof.pathElements[i] <== aliceSpendPathElements[i];
	}
	aliceMerkleProof.isEnabled <== 1;
	for (var i = 0; i < length; i++) {
		aliceMerkleProof.roots[i] <== roots[i];
	}

    // Check Bob Spend Merkle Proof
    component bobSpendRecordHasher = Record();
    bobSpendRecordHasher.chainID <== swapChainID;
    bobSpendRecordHasher.assetID <== bobSpendAssetID;
    bobSpendRecordHasher.tokenID <== bobSpendTokenID;
    bobSpendRecordHasher.amount <== bobSpendAmount;
    bobSpendRecordHasher.partialRecord <== bobSpendPartialRecord;

    component bobMerkleProof = ManyMerkleProof(levels, length);
	bobMerkleProof.leaf <== bobSpendRecordHasher.record;
	bobMerkleProof.pathIndices <== bobSpendPathIndices;
	for (var i = 0; i < levels; i++) {
	bobMerkleProof.pathElements[i] <== bobSpendPathElements[i];
	}
	bobMerkleProof.isEnabled <== 1;
	for (var i = 0; i < length; i++) {
		bobMerkleProof.roots[i] <== roots[i];
	}

    // Check Alice and Bob Change/Receive Records constructed correctly
    component aliceChangeRecordHasher = Record();
    aliceChangeRecordHasher.chainID <== swapChainID;
    aliceChangeRecordHasher.assetID <== aliceChangeAssetID;
    aliceChangeRecordHasher.tokenID <== aliceChangeTokenID;
    aliceChangeRecordHasher.amount <== aliceChangeAmount;
    aliceChangeRecordHasher.partialRecord <== aliceChangePartialRecord;
    aliceChangeRecordHasher.record === aliceChangeRecord;

    component aliceReceiveRecordHasher = Record();
    aliceReceiveRecordHasher.chainID <== swapChainID;
    aliceReceiveRecordHasher.assetID <== aliceReceiveAssetID;
    aliceReceiveRecordHasher.tokenID <== aliceReceiveTokenID;
    aliceReceiveRecordHasher.amount <== aliceReceiveAmount;
    aliceReceiveRecordHasher.partialRecord <== aliceReceivePartialRecord;
    aliceReceiveRecordHasher.record === aliceReceiveRecord;

    component bobChangeRecordHasher = Record();
    bobChangeRecordHasher.chainID <== swapChainID;
    bobChangeRecordHasher.assetID <== bobChangeAssetID;
    bobChangeRecordHasher.tokenID <== bobChangeTokenID;
    bobChangeRecordHasher.amount <== bobChangeAmount;
    bobChangeRecordHasher.partialRecord <== bobChangePartialRecord;
    bobChangeRecordHasher.record === bobChangeRecord;

    component bobReceiveRecordHasher = Record();
    bobReceiveRecordHasher.chainID <== swapChainID;
    bobReceiveRecordHasher.assetID <== bobReceiveAssetID;
    bobReceiveRecordHasher.tokenID <== bobReceiveTokenID;
    bobReceiveRecordHasher.amount <== bobReceiveAmount;
    bobReceiveRecordHasher.partialRecord <== bobReceivePartialRecord;
    bobReceiveRecordHasher.record === bobReceiveRecord;


    // Check Alice and Bob Spend Nullifiers constructed correctly
    component aliceNullifierHasher = Nullifier();
    aliceNullifierHasher.pk_X <== alice_pk_X;
    aliceNullifierHasher.pk_Y <== alice_pk_Y;
    aliceNullifierHasher.record <== aliceSpendRecordHasher.record;
    aliceNullifierHasher.pathIndices <== aliceSpendPathIndices;
    aliceNullifierHasher.nullifier === aliceSpendNullifier;

    component bobNullifierHasher = Nullifier();
    bobNullifierHasher.pk_X <== bob_pk_X;
    bobNullifierHasher.pk_Y <== bob_pk_Y;
    bobNullifierHasher.record <== bobSpendRecordHasher.record;
    bobNullifierHasher.pathIndices <== bobSpendPathIndices;
    bobNullifierHasher.nullifier === bobSpendNullifier;
}
