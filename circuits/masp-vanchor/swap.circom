pragma circom 2.0.0;

include "../merkle-tree/manyMerkleProof.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";
include "./record.circom";
include "./nullifier.circom";
include "./key.circom";

// Swap message is (aliceChangeRecord, aliceReceiveRecord, bobChangeRecord, bobReceiveRecord, t, t')
// We check a Poseidon Hash of message is signed by both parties

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

    signal input alice_ak_X;
    signal input alice_ak_Y;

    signal input bob_ak_X;
    signal input bob_ak_Y;

    signal input alice_R8x;
    signal input alice_R8y;

    signal input aliceSig;

    signal input bob_R8x;
    signal input bob_R8y;

    signal input bobSig;

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
    signal input aliceChangeInnerPartialRecord;
    signal input aliceChangeRecord; // Public Input
    signal input bobChangeChainID;
    signal input bobChangeAssetID;
    signal input bobChangeTokenID;
    signal input bobChangeAmount;
    signal input bobChangeInnerPartialRecord;
    signal input bobChangeRecord; // Public Input

    signal input aliceReceiveChainID;
    signal input aliceReceiveAssetID;
    signal input aliceReceiveTokenID;
    signal input aliceReceiveAmount;
    signal input aliceReceiveInnerPartialRecord;
    signal input aliceReceiveRecord; // Public Input
    signal input bobReceiveChainID;
    signal input bobReceiveAssetID;
    signal input bobReceiveTokenID;
    signal input bobReceiveAmount;
    signal input bobReceiveInnerPartialRecord;
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
    tCheck.out === 1;
    component tPrimeCheck = LessEqThan(252);
    tPrimeCheck.in[0] <== currentTimestamp;
    tPrimeCheck.in[1] <== tPrime;
    tPrimeCheck.out === 1;

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

    // Check Signatures
    signal alice_pk_X;
    signal alice_pk_Y;
    component alicePkComputer = Key();
    alicePkComputer.ak_X <== alice_ak_X;
    alicePkComputer.ak_Y <== alice_ak_Y;
    alice_pk_X <== alicePkComputer.pk_X;
    alice_pk_Y <== alicePkComputer.pk_Y;

    signal bob_pk_X;
    signal bob_pk_Y;
    component bobPkComputer = Key();
    bobPkComputer.ak_X <== bob_ak_X;
    bobPkComputer.ak_Y <== bob_ak_Y;
    bob_pk_X <== bobPkComputer.pk_X;
    bob_pk_Y <== bobPkComputer.pk_Y;

    component swapMessageHasher = Poseidon(6);
    swapMessageHasher.inputs[0] <== aliceChangeRecord;
    swapMessageHasher.inputs[1] <== aliceReceiveRecord;
    swapMessageHasher.inputs[2] <== bobChangeRecord;
    swapMessageHasher.inputs[3] <== bobReceiveRecord;
    swapMessageHasher.inputs[4] <== t;
    swapMessageHasher.inputs[5] <== tPrime;

    component aliceSigChecker = EdDSAPoseidonVerifier();
    aliceSigChecker.enabled <== 1;
    aliceSigChecker.Ax <== alice_ak_X;
    aliceSigChecker.Ay <== alice_ak_Y;
    aliceSigChecker.S <== aliceSig;
    aliceSigChecker.R8x <== alice_R8x;
    aliceSigChecker.R8y <== alice_R8y;
    aliceSigChecker.M <== swapMessageHasher.out;

    component bobSigChecker = EdDSAPoseidonVerifier();
    bobSigChecker.enabled <== 1;
    bobSigChecker.Ax <== bob_ak_X;
    bobSigChecker.Ay <== bob_ak_Y;
    bobSigChecker.S <== bobSig;
    bobSigChecker.R8x <== bob_R8x;
    bobSigChecker.R8y <== bob_R8y;
    bobSigChecker.M <== swapMessageHasher.out;

    // Check Alice Spend Merkle Proof
    component aliceSpendPartialRecordHasher = PartialRecord();
    aliceSpendPartialRecordHasher.chainID <== swapChainID;
    aliceSpendPartialRecordHasher.pk_X <== alice_pk_X;
    aliceSpendPartialRecordHasher.pk_Y <== alice_pk_Y;
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
    bobSpendPartialRecordHasher.pk_X <== bob_pk_X;
    bobSpendPartialRecordHasher.pk_Y <== bob_pk_Y;
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
    component aliceChangePartialRecordHasher = PartialRecord();
    aliceChangePartialRecordHasher.chainID <== aliceChangeChainID;
    aliceChangePartialRecordHasher.pk_X <== alice_pk_X;
    aliceChangePartialRecordHasher.pk_Y <== alice_pk_Y;
    aliceChangePartialRecordHasher.innerPartialRecord <== aliceChangeInnerPartialRecord;
    component aliceChangeRecordHasher = Record();
    aliceChangeRecordHasher.assetID <== aliceChangeAssetID;
    aliceChangeRecordHasher.tokenID <== aliceChangeTokenID;
    aliceChangeRecordHasher.amount <== aliceChangeAmount;
    aliceChangeRecordHasher.partialRecord <== aliceChangePartialRecordHasher.partialRecord;
    aliceChangeRecordHasher.record === aliceChangeRecord;

    component aliceReceivePartialRecordHasher = PartialRecord();
    aliceReceivePartialRecordHasher.chainID <== aliceReceiveChainID;
    aliceReceivePartialRecordHasher.pk_X <== alice_pk_X;
    aliceReceivePartialRecordHasher.pk_Y <== alice_pk_Y;
    aliceReceivePartialRecordHasher.innerPartialRecord <== aliceReceiveInnerPartialRecord;
    component aliceReceiveRecordHasher = Record();
    aliceReceiveRecordHasher.assetID <== aliceReceiveAssetID;
    aliceReceiveRecordHasher.tokenID <== aliceReceiveTokenID;
    aliceReceiveRecordHasher.amount <== aliceReceiveAmount;
    aliceReceiveRecordHasher.partialRecord <== aliceReceivePartialRecordHasher.partialRecord;
    aliceReceiveRecordHasher.record === aliceReceiveRecord;

    component bobChangePartialRecordHasher = PartialRecord();
    bobChangePartialRecordHasher.chainID <== bobChangeChainID;
    bobChangePartialRecordHasher.pk_X <== bob_pk_X;
    bobChangePartialRecordHasher.pk_Y <== bob_pk_Y;
    bobChangePartialRecordHasher.innerPartialRecord <== bobChangeInnerPartialRecord;
    component bobChangeRecordHasher = Record();
    bobChangeRecordHasher.assetID <== bobChangeAssetID;
    bobChangeRecordHasher.tokenID <== bobChangeTokenID;
    bobChangeRecordHasher.amount <== bobChangeAmount;
    bobChangeRecordHasher.partialRecord <== bobChangePartialRecordHasher.partialRecord;
    bobChangeRecordHasher.record === bobChangeRecord;

    component bobReceivePartialRecordHasher = PartialRecord();
    bobReceivePartialRecordHasher.chainID <== bobReceiveChainID;
    bobReceivePartialRecordHasher.pk_X <== bob_pk_X;
    bobReceivePartialRecordHasher.pk_Y <== bob_pk_Y;
    bobReceivePartialRecordHasher.innerPartialRecord <== bobReceiveInnerPartialRecord;
    component bobReceiveRecordHasher = Record();
    bobReceiveRecordHasher.assetID <== bobReceiveAssetID;
    bobReceiveRecordHasher.tokenID <== bobReceiveTokenID;
    bobReceiveRecordHasher.amount <== bobReceiveAmount;
    bobReceiveRecordHasher.partialRecord <== bobReceivePartialRecordHasher.partialRecord;
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
