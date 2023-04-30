pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../set/membership.circom";
include "../merkle-tree/manyMerkleProof.circom";
include "./key.circom";
include "./nullifier.circom";
include "./record.circom";
include "../../node_modules/circomlib/circuits/eddsaposeidon.circom";

/*
Goal is to support:
- Fungible assets
- Non-fungible assets
- Contract calls from the shielded and ability to re-shield

Goal is to differentiate between
- Collections of NFTs without taking over too much of the address space

UTXO structure:
// If this is an NFT, this becomes hash(contract address, tokenId)g
// If this is a fungible token, this is selected deterministically on all chains
{
    assetID,
    amount,
    InnerpartialUtxoCommitment,
}

For NFTs: hash(contract_address, token_id)

InnerPartial UTXO structure:
{
    chainID, // destination chain identifier
    pubkey,
    blinding, // random number
}

commitment = hash(assetID, tokenID, amount, hash(chainID, pubKey, blinding))
nullifier = hash(commitment, merklePath, sign(privKey, commitment, merklePath))
*/

// Universal JoinSplit transaction with nIns inputs and 2 outputs (2-2 & 16-2)
template Transaction(levels, nIns, nOuts, nFeeIns, nFeeOuts, length, numFeeTokens) {
    // extAmount = external amount used for deposits and withdrawals
    // correct extAmount range is enforced on the smart contract
    // publicAmount = extAmount - fee
    signal input publicAmount;
    signal input extDataHash; // arbitrary

    // data for input/output asset identifier
    signal input assetID;
    signal input tokenID;
    signal input publicAssetID;
    signal input publicTokenID;

    // data for transaction inputs
    signal input inputNullifier[nIns];
    signal input inAmount[nIns];
    signal input inBlinding[nIns];
    signal input inPathIndices[nIns];
    signal input inPathElements[nIns][levels];
    signal input inSignature;
    signal input inR8x;
    signal input inR8y;

    // data for transaction outputs
    signal input outputCommitment[nOuts];
    signal input outAmount[nOuts];
    signal input outChainID[nOuts];
    signal input outPk_X[nOuts];
    signal input outPk_Y[nOuts];
    signal input outBlinding[nOuts];
    signal input outSignature;
    signal input outR8x;
    signal input outR8y;

    // roots for interoperability, one-of-many merkle membership proof
    signal input chainID;
    signal input roots[length];

    component inCommitmentHasher[nIns];
    component inInnerPartialCommitmentHasher[nIns];
    component inPartialCommitmentHasher[nIns];
    component inNullifierHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];
    component inPoseidonHasher = Poseidon(nIns);
    component inSignatureChecker;

    // MASP Keys
    signal input ak_X;
    signal input ak_Y;

    // Fee Inputs (2-2 Join-Split Circuit) --------------

    // data for input/output asset identifier
    signal input feeAssetID;
    signal input whitelistedAssetIDs[numFeeTokens]; // Public Input
    signal input feeTokenID;

    // data for transaction inputs
    signal input feeInputNullifier[nFeeIns];
    signal input feeInAmount[nFeeIns];
    signal input feeInBlinding[nFeeIns];
    signal input feeInPathIndices[nFeeIns];
    signal input feeInPathElements[nFeeIns][levels];
    signal input feeInSignature;
    signal input feeInR8x;
    signal input feeInR8y;

    // data for transaction outputs
    signal input feeOutputCommitment[nFeeOuts];
    signal input feeOutAmount[nFeeOuts];
    signal input feeOutChainID[nFeeOuts];
    signal input feeOutPk_X[nFeeOuts];
    signal input feeOutPk_Y[nFeeOuts];
    signal input feeOutBlinding[nFeeOuts];
    signal input feeOutSignature;
    signal input feeOutR8x;
    signal input feeOutR8y;

    component feeInCommitmentHasher[nFeeIns];
    component feeInInnerPartialCommitmentHasher[nFeeIns];
    component feeInPartialCommitmentHasher[nFeeIns];
    component feeInNullifierHasher[nFeeIns];
    component feeInTree[nFeeIns];
    component feeInCheckRoot[nFeeIns];
    component feeInPoseidonHasher = Poseidon(nFeeIns);
    component feeInSignatureChecker;

    signal input fee_ak_X;
    signal input fee_ak_Y;
    // End Fee Inputs --------------

    var sumIns = 0;

    component keyComputer = Key();
    keyComputer.ak_X <== ak_X;
    keyComputer.ak_Y <== ak_Y;

    // verify correctness of transaction inputs
    for (var tx = 0; tx < nIns; tx++) {
        inInnerPartialCommitmentHasher[tx] = InnerPartialRecord();
        inInnerPartialCommitmentHasher[tx].blinding <== inBlinding[tx];

        inPartialCommitmentHasher[tx] = PartialRecord();
        inPartialCommitmentHasher[tx].chainID <== chainID;
        inPartialCommitmentHasher[tx].pk_X <== keyComputer.pk_X;
        inPartialCommitmentHasher[tx].pk_Y <== keyComputer.pk_Y;
        inPartialCommitmentHasher[tx].innerPartialRecord <== inInnerPartialCommitmentHasher[tx].innerPartialRecord;

        inCommitmentHasher[tx] = Record();
        inCommitmentHasher[tx].assetID <== assetID;
        inCommitmentHasher[tx].tokenID <== tokenID;
        inCommitmentHasher[tx].amount <== inAmount[tx];
        inCommitmentHasher[tx].partialRecord <== inPartialCommitmentHasher[tx].partialRecord;

        inPoseidonHasher.inputs[tx] <== inCommitmentHasher[tx].record;

        inNullifierHasher[tx] = Nullifier();
        inNullifierHasher[tx].record <== inCommitmentHasher[tx].record;
        inNullifierHasher[tx].pathIndices <== inPathIndices[tx];
        inNullifierHasher[tx].nullifier === inputNullifier[tx];

        inTree[tx] = ManyMerkleProof(levels, length);
        inTree[tx].leaf <== inCommitmentHasher[tx].record;
        inTree[tx].pathIndices <== inPathIndices[tx];

        // add the roots and diffs signals to the bridge circuit
        for (var i = 0; i < length; i++) {
            inTree[tx].roots[i] <== roots[i];
        }

        inTree[tx].isEnabled <== inAmount[tx];
        for (var i = 0; i < levels; i++) {
            inTree[tx].pathElements[i] <== inPathElements[tx][i];
        }

        // We don't need to range check input amounts, since all inputs are valid UTXOs that
        // were already checked as outputs in the previous transaction (or zero amount UTXOs that don't
        // need to be checked either).
        sumIns += inAmount[tx];
    }

    // Verify input record sig
    inSignatureChecker = EdDSAPoseidonVerifier();
    inSignatureChecker.enabled <== 1;
    inSignatureChecker.Ax <== ak_X;
    inSignatureChecker.Ay <== ak_Y;
    inSignatureChecker.R8x <== inR8x;
    inSignatureChecker.R8y <== inR8y;
    inSignatureChecker.M <== inPoseidonHasher.out;
    inSignatureChecker.S <== inSignature;

    component outInnerPartialCommitmentHasher[nOuts];
    component outPartialCommitmentHasher[nOuts];
    component outCommitmentHasher[nOuts];
    component outAmountCheck[nOuts];
    component outPoseidonHasher = Poseidon(nOuts);
    component outSignatureChecker;
    var sumOuts = 0;

    // verify correctness of transaction outputs
    for (var tx = 0; tx < nOuts; tx++) {
        outInnerPartialCommitmentHasher[tx] = InnerPartialRecord();
        outInnerPartialCommitmentHasher[tx].blinding <== outBlinding[tx];

        outPartialCommitmentHasher[tx] = PartialRecord();
        outPartialCommitmentHasher[tx].chainID <== outChainID[tx];
        outPartialCommitmentHasher[tx].pk_X <== outPk_X[tx];
        outPartialCommitmentHasher[tx].pk_Y <== outPk_Y[tx];
        outPartialCommitmentHasher[tx].innerPartialRecord <== outInnerPartialCommitmentHasher[tx].innerPartialRecord;

        outCommitmentHasher[tx] = Record();
        outCommitmentHasher[tx].assetID <== assetID;
        outCommitmentHasher[tx].tokenID <== tokenID;
        outCommitmentHasher[tx].amount <== outAmount[tx];
        outCommitmentHasher[tx].partialRecord <== outPartialCommitmentHasher[tx].partialRecord;

        outPoseidonHasher.inputs[tx] <== outCommitmentHasher[tx].record;
        
        // Constrain output commitment by reconstructed commitment
        outCommitmentHasher[tx].record === outputCommitment[tx];

        // Check that amount fits into 248 bits to prevent overflow
        outAmountCheck[tx] = Num2Bits(248);
        outAmountCheck[tx].in <== outAmount[tx];

        sumOuts += outAmount[tx];
    }

    // Verify output record sig
    outSignatureChecker = EdDSAPoseidonVerifier();
    outSignatureChecker.enabled <== 1;
    outSignatureChecker.Ax <== ak_X;
    outSignatureChecker.Ay <== ak_Y;
    outSignatureChecker.R8x <== outR8x;
    outSignatureChecker.R8y <== outR8y;
    outSignatureChecker.M <== outPoseidonHasher.out;
    outSignatureChecker.S <== outSignature;

    // check that there are no same nullifiers among all inputs
    component sameNullifiers[nIns * (nIns - 1) / 2];
    var index = 0;
    for (var i = 0; i < nIns - 1; i++) {
      for (var j = i + 1; j < nIns; j++) {
          sameNullifiers[index] = IsEqual();
          sameNullifiers[index].in[0] <== inputNullifier[i];
          sameNullifiers[index].in[1] <== inputNullifier[j];
          sameNullifiers[index].out === 0;
          index++;
      }
    }

    // verify amount invariant
    sumIns + publicAmount === sumOuts;

    // Enforce that outAssetID is zero if publicAmount is zero (i.e. shielded tx)
    // Otherwise it is equal to tokenField
    component isShieldedTx = IsZero();
    isShieldedTx.in <== publicAmount;    component checkAssetIDEqualIfNotShielded = ForceEqualIfEnabled();
    checkAssetIDEqualIfNotShielded.enabled <== 1 - isShieldedTx.out;
    checkAssetIDEqualIfNotShielded.in[0] <== assetID;
    checkAssetIDEqualIfNotShielded.in[1] <== publicAssetID;    component checkTokenIDEqualIfNotShielded = ForceEqualIfEnabled();
    checkTokenIDEqualIfNotShielded.enabled <== 1 - isShieldedTx.out;
    checkTokenIDEqualIfNotShielded.in[0] <== tokenID;
    checkTokenIDEqualIfNotShielded.in[1] <== publicTokenID;

    // Fee Constraints
    // Check Fee AssetID is allowable
    component membership = SetMembership(numFeeTokens);
    membership.element <== feeAssetID;
    for (var i = 0; i < numFeeTokens; i++) {
        membership.set[i] <== whitelistedAssetIDs[i];
    }

    // Fee Token must be a fungible token
    feeTokenID === 0;

    var sumFeeIns = 0;

    component feeKeyComputer = Key();
    feeKeyComputer.ak_X <== fee_ak_X;
    feeKeyComputer.ak_Y <== fee_ak_Y;
    // verify correctness of transaction inputs
    for (var tx = 0; tx < nFeeIns; tx++) {
        feeInInnerPartialCommitmentHasher[tx] = InnerPartialRecord();
        feeInInnerPartialCommitmentHasher[tx].blinding <== feeInBlinding[tx];

        feeInPartialCommitmentHasher[tx] = PartialRecord();
        feeInPartialCommitmentHasher[tx].chainID <== chainID;
        feeInPartialCommitmentHasher[tx].pk_X <== feeKeyComputer.pk_X;
        feeInPartialCommitmentHasher[tx].pk_Y <== feeKeyComputer.pk_Y;
        feeInPartialCommitmentHasher[tx].innerPartialRecord <== feeInInnerPartialCommitmentHasher[tx].innerPartialRecord;

        feeInCommitmentHasher[tx] = Record();
        feeInCommitmentHasher[tx].assetID <== feeAssetID;
        feeInCommitmentHasher[tx].tokenID <== feeTokenID;
        feeInCommitmentHasher[tx].amount <== feeInAmount[tx];
        feeInCommitmentHasher[tx].partialRecord <== feeInPartialCommitmentHasher[tx].partialRecord;

        feeInPoseidonHasher.inputs[tx] <== feeInCommitmentHasher[tx].record;

        feeInNullifierHasher[tx] = Nullifier();
        feeInNullifierHasher[tx].record <== feeInCommitmentHasher[tx].record;
        feeInNullifierHasher[tx].pathIndices <== feeInPathIndices[tx];
        feeInNullifierHasher[tx].nullifier === feeInputNullifier[tx];

        feeInTree[tx] = ManyMerkleProof(levels, length);
        feeInTree[tx].leaf <== feeInCommitmentHasher[tx].record;
        feeInTree[tx].pathIndices <== feeInPathIndices[tx];

        // add the roots and diffs signals to the bridge circuit
        for (var i = 0; i < length; i++) {
            feeInTree[tx].roots[i] <== roots[i];
        }

        feeInTree[tx].isEnabled <== feeInAmount[tx];
        for (var i = 0; i < levels; i++) {
            feeInTree[tx].pathElements[i] <== feeInPathElements[tx][i];
        }

        // We don't need to range check input amounts, since all inputs are valid UTXOs that
        // were already checked as outputs in the previous transaction (or zero amount UTXOs that don't
        // need to be checked either).
        sumFeeIns += feeInAmount[tx];
    }

    // verify fee inputs sig
    feeInSignatureChecker = EdDSAPoseidonVerifier();
    feeInSignatureChecker.enabled <== 1;
    feeInSignatureChecker.Ax <== fee_ak_X;
    feeInSignatureChecker.Ay <== fee_ak_Y;
    feeInSignatureChecker.R8x <== feeInR8x;
    feeInSignatureChecker.R8y <== feeInR8y;
    feeInSignatureChecker.M <== feeInPoseidonHasher.out;
    feeInSignatureChecker.S <== feeInSignature;

    component feeOutInnerPartialCommitmentHasher[nFeeOuts];
    component feeOutPartialCommitmentHasher[nFeeOuts];
    component feeOutCommitmentHasher[nFeeOuts];
    component feeOutAmountCheck[nFeeOuts];
    component feeOutSignatureChecker;
    component feeOutPoseidonHasher = Poseidon(nFeeOuts);
    var sumFeeOuts = 0;

    // verify correctness of transaction outputs
    for (var tx = 0; tx < nFeeOuts; tx++) {
        feeOutInnerPartialCommitmentHasher[tx] = InnerPartialRecord();
        feeOutInnerPartialCommitmentHasher[tx].blinding <== feeOutBlinding[tx];

        feeOutPartialCommitmentHasher[tx] = PartialRecord();
        feeOutPartialCommitmentHasher[tx].chainID <== feeOutChainID[tx];
        feeOutPartialCommitmentHasher[tx].pk_X <== feeOutPk_X[tx];
        feeOutPartialCommitmentHasher[tx].pk_Y <== feeOutPk_Y[tx];
        feeOutPartialCommitmentHasher[tx].innerPartialRecord <== feeOutInnerPartialCommitmentHasher[tx].innerPartialRecord;

        feeOutCommitmentHasher[tx] = Record();
        feeOutCommitmentHasher[tx].assetID <== feeAssetID;
        feeOutCommitmentHasher[tx].tokenID <== feeTokenID;
        feeOutCommitmentHasher[tx].amount <== feeOutAmount[tx];
        feeOutCommitmentHasher[tx].partialRecord <== feeOutPartialCommitmentHasher[tx].partialRecord;

        feeOutPoseidonHasher.inputs[tx] <== feeOutCommitmentHasher[tx].record;
        
        // Constrain output commitment by reconstructed commitment
        feeOutCommitmentHasher[tx].record === feeOutputCommitment[tx];

        // Check that amount fits into 248 bits to prevent overflow
        feeOutAmountCheck[tx] = Num2Bits(248);
        feeOutAmountCheck[tx].in <== feeOutAmount[tx];

        sumFeeOuts += feeOutAmount[tx];
    }

    // verify fee outputs sig
    feeOutSignatureChecker = EdDSAPoseidonVerifier();
    feeOutSignatureChecker.enabled <== 1;
    feeOutSignatureChecker.Ax <== fee_ak_X;
    feeOutSignatureChecker.Ay <== fee_ak_Y;
    feeOutSignatureChecker.R8x <== feeOutR8x;
    feeOutSignatureChecker.R8y <== feeOutR8y;
    feeOutSignatureChecker.M <== feeOutPoseidonHasher.out;
    feeOutSignatureChecker.S <== feeOutSignature;

    // check that there are no same nullifiers among all inputs
    component sameFeeNullifiers[nFeeIns * (nFeeIns - 1) / 2];
    var feeIndex = 0;
    for (var i = 0; i < nFeeIns - 1; i++) {
      for (var j = i + 1; j < nFeeIns; j++) {
          sameFeeNullifiers[feeIndex] = IsEqual();
          sameFeeNullifiers[feeIndex].in[0] <== feeInputNullifier[i];
          sameFeeNullifiers[feeIndex].in[1] <== feeInputNullifier[j];
          sameFeeNullifiers[feeIndex].out === 0;
          feeIndex++;
      }
    }

    // verify amount invariant
    sumFeeIns === sumFeeOuts;

    // optional safety constraint to make sure extDataHash cannot be changed
    signal extDataSquare;
    extDataSquare <== extDataHash * extDataHash;
}