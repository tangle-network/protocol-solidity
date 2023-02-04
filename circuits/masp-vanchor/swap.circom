pragma circom 2.0.0;

include "../merkle-tree/manyMerkleProof.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "./record.circom";
include "./nullifier.circom";

// Swap message is (aliceSpendAssetID, aliceSpendTokenID, aliceSpendAmount, bobSpendAssetID, bobSpendTokenID, bobSpendAmount, t, t')
// We check a Poseidon hash of this message is signed by BOTH Alice and Bob.

template Swap(levels, length) {
    signal input aliceSpendAssetID;
    signal input aliceSpendTokenID;
    signal input aliceSpendAmount;
    signal input aliceSpendInnerPartialRecord;
    signal input bobSpendAssetID;
    signal input bobSpendTokenID;
    signal input bobSpendAmount;
    signal input bobSpendInnerPartialRecord;
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

    signal input aliceChangeChainID;
    signal input aliceChangeAssetID;
    signal input aliceChangeTokenID;
    signal input aliceChangeAmount;
    signal input aliceChangePartialRecord;
    signal input aliceChangeRecord; // Public Input
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
    signal input aliceReceiveRecord; // Public Input
    signal input bobReceiveChainID;
    signal input bobReceiveAssetID;
    signal input bobReceiveTokenID;
    signal input bobReceiveAmount;
    signal input bobReceivePartialRecord;
    signal input bobReceiveRecord; // Public Input

    // Range check receive and change record amounts
    component aliceChangeAmountCheck = Num2Bits(248);
    aliceChangeAmountCheck.in <== aliceChangeAmount;
    component aliceReceiveAmountCheck = Num2Bits(248);
    aliceReceiveAmountCheck.in <== aliceReceiveAmount;
    component bobChangeAmountCheck = Num2Bits(248);
    bobChangeAmountCheck.in <== bobChangeAmount;
    component bobReceiveAmountCheck = Num2Bits(248);
    bobReceiveAmountCheck.in <== bobReceiveAmount;

    // Range Check timestamps
    component tRangeCheck = Num2Bits(252);
    tRangeCheck.in <== t;
    component tPrimeRangeCheck = Num2Bits(252);
    tPrimeRangeCheck.in <== tPrime;
    component currentTimestampRangeCheck = Num2Bits(252);
    currentTimestampRangeCheck.in <== currentTimestamp;
    component tCheck = LessEqThan(252);
    tCheck.in[0] <== t;
    tCheck.in[1] <== currentTimestamp;
    component tPrimeCheck = LessEqThan(252);
    tPrimeCheck.in[0] <== currentTimestamp;
    tPrimeCheck.in[1] <== tPrime;

    // Check all relevant asset and tokenIDs and amounts are equal
    aliceSpendAssetID === aliceChangeAssetID;
    aliceReceiveAssetID === bobSpendAssetID;
    bobSpendAssetID === bobChangeAssetID;
    bobReceiveAssetID === aliceSpendAssetID;
    aliceSpendTokenID === aliceChangeTokenID;
    aliceReceiveTokenID === bobSpendTokenID;
    bobSpendTokenID === bobChangeTokenID;
    bobReceiveTokenID === aliceSpendTokenID;

    // Check amount invariant
    aliceSpendAmount === aliceChangeAmount + bobReceiveAmount;
    bobSpendAmount === bobChangeAmount + aliceReceiveAmount;

    // Check Alice Spend Merkle Proof
    component aliceSpendPartialRecordHasher = PartialRecord();
    aliceSpendPartialRecordHasher.chainID <== swapChainID;
    aliceSpendPartialRecordHasher.innerPartialRecord <== aliceSpendInnerPartialRecord;
    component aliceSpendRecordHasher = Record();
    aliceSpendRecordHasher.assetID <== aliceSpendAssetID;
    aliceSpendRecordHasher.tokenID <== aliceSpendTokenID;
    aliceSpendRecordHasher.amount <== aliceSpendAmount;
    aliceSpendRecordHasher.partialRecord <== aliceSpendPartialRecordHasher.partialRecord;

    component aliceMerkleProof = ManyMerkleProof(levels, length);
	aliceMerkleProof.leaf <== aliceSpendRecordHasher.record;
	aliceMerkleProof.pathIndices <== aliceSpendPathIndices;
	for (var i = 0; i < levels; i++) {
	aliceMerkleProof.pathElements[i] <== aliceSpendPathElements[i];
	}
	aliceMerkleProof.isEnabled <== 1;
	for (var i = 0; i < length; i++) {
		aliceMerkleProof.roots[i] <== roots[i];
	}

    // Check Bob Spend Merkle Proof
    component bobSpendPartialRecordHasher = PartialRecord();
    bobSpendPartialRecordHasher.chainID <== swapChainID;
    bobSpendPartialRecordHasher.innerPartialRecord <== bobSpendInnerPartialRecord;
    component bobSpendRecordHasher = Record();
    bobSpendRecordHasher.assetID <== bobSpendAssetID;
    bobSpendRecordHasher.tokenID <== bobSpendTokenID;
    bobSpendRecordHasher.amount <== bobSpendAmount;
    bobSpendRecordHasher.partialRecord <== bobSpendPartialRecordHasher.partialRecord;

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
    aliceChangeRecordHasher.assetID <== aliceChangeAssetID;
    aliceChangeRecordHasher.tokenID <== aliceChangeTokenID;
    aliceChangeRecordHasher.amount <== aliceChangeAmount;
    aliceChangeRecordHasher.partialRecord <== aliceChangePartialRecord;
    aliceChangeRecordHasher.record === aliceChangeRecord;

    component aliceReceiveRecordHasher = Record();
    aliceReceiveRecordHasher.assetID <== aliceReceiveAssetID;
    aliceReceiveRecordHasher.tokenID <== aliceReceiveTokenID;
    aliceReceiveRecordHasher.amount <== aliceReceiveAmount;
    aliceReceiveRecordHasher.partialRecord <== aliceReceivePartialRecord;
    aliceReceiveRecordHasher.record === aliceReceiveRecord;

    component bobChangeRecordHasher = Record();
    bobChangeRecordHasher.assetID <== bobChangeAssetID;
    bobChangeRecordHasher.tokenID <== bobChangeTokenID;
    bobChangeRecordHasher.amount <== bobChangeAmount;
    bobChangeRecordHasher.partialRecord <== bobChangePartialRecord;
    bobChangeRecordHasher.record === bobChangeRecord;

    component bobReceiveRecordHasher = Record();
    bobReceiveRecordHasher.assetID <== bobReceiveAssetID;
    bobReceiveRecordHasher.tokenID <== bobReceiveTokenID;
    bobReceiveRecordHasher.amount <== bobReceiveAmount;
    bobReceiveRecordHasher.partialRecord <== bobReceivePartialRecord;
    bobReceiveRecordHasher.record === bobReceiveRecord;


    // Check Alice and Bob Spend Nullifiers constructed correctly
    component aliceNullifierHasher = Nullifier();
    aliceNullifierHasher.record <== aliceSpendRecordHasher.record;
    aliceNullifierHasher.pathIndices <== aliceSpendPathIndices;
    aliceNullifierHasher.nullifier === aliceSpendNullifier;

    component bobNullifierHasher = Nullifier();
    bobNullifierHasher.record <== bobSpendRecordHasher.record;
    bobNullifierHasher.pathIndices <== bobSpendPathIndices;
    bobNullifierHasher.nullifier === bobSpendNullifier;
}
