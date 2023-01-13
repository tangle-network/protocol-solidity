pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../set/membership.circom";
include "../merkle-tree/manyMerkleProof.circom";
include "../key.circom";
include "../nullifier.circom";
include "../record.circom";

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
    partialUtxoCommitment,
}

For NFTs: hash(contract_address, token_id)

Partial UTXO structure:
{
    chainID, // destination chain identifier
    pubkey,
    blinding, // random number
}

commitment = hash(assetID, tokenID, amount, hash(chainID, pubKey, blinding))
nullifier = hash(commitment, merklePath, sign(privKey, commitment, merklePath))
*/

// Universal JoinSplit transaction with nIns inputs and 2 outputs (2-2 & 16-2)
template Transaction(levels, nIns, nOuts, nFeeIns, nFeeOuts, zeroLeaf, length, numFeeTokens) {
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
    signal input inPrivateKey[nIns];
    signal input inBlinding[nIns];
    signal input inPathIndices[nIns];
    signal input inPathElements[nIns][levels];

    // data for transaction outputs
    signal input outputCommitment[nOuts];
    signal input outAmount[nOuts];
    signal input outChainID[nOuts];
    signal input outPk_X[nOuts];
    signal input outPk_Y[nOuts];
    signal input outBlinding[nOuts];

    // roots for interoperability, one-of-many merkle membership proof
    signal input chainID;
    signal input roots[length];

    component inKeyComputer[nIns];
    component inCommitmentHasher[nIns];
    component inPartialCommitmentHasher[nIns];
    component inNullifierHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];
    component inBabyPbk[nIns];

    // MASP Keys
    signal input ak_X[nIns];
    signal input ak_Y[nIns];
    signal input sk_alpha[nIns];
    signal input ak_alpha_X[nIns] // Public Input
    signal input ak_alpha_Y[nIns] // Public Input

    // Fee Inputs (2-2 Join-Split Circuit) --------------

    // data for input/output asset identifier
    signal input feeAssetID;
    signal input whitelistedAssetIDs[numFeeTokens]
    signal input feeTokenID;

    // data for transaction inputs
    signal input feeInputNullifier[nFeeIns];
    signal input feeInAmount[nFeeIns];
    signal input feeInPrivateKey[nFeeIns];
    signal input feeInBlinding[nFeeIns];
    signal input feeInPathIndices[nFeeIns];
    signal input feeInPathElements[nFeeIns][levels];

    // data for transaction outputs
    signal input feeOutputCommitment[nFeeOuts];
    signal input feeOutAmount[nFeeOuts];
    signal input feeOutChainID[nFeeOuts];
    signal input feeOutPk_X[nFeeOuts];
    signal input feeOutPk_Y[nFeeOuts];
    signal input feeOutBlinding[nFeeOuts];

    component feeInKeyComputer[nFeeIns];
    component feeInCommitmentHasher[nFeeIns];
    component feeInPartialCommitmentHasher[nFeeIns];
    component feeInNullifierHasher[nFeeIns];
    component feeInTree[nFeeIns];
    component feeInCheckRoot[nFeeIns];
    component feeInBabyPbk[nFeeIns];

    // MASP Keys
    signal input fee_ak_X[nFeeIns];
    signal input fee_ak_Y[nFeeIns];
    signal input fee_sk_alpha[nFeeIns];
    signal input fee_ak_alpha_X[nFeeIns] // Public Input
    signal input fee_ak_alpha_Y[nFeeIns] // Public Input
    // End Fee Inputs --------------

    var sumIns = 0;

    // verify correctness of transaction inputs
    for (var tx = 0; tx < nIns; tx++) {
        // Check MASP keys well formed
        component inBabyPbk[tx] = BabyPbk();
        inBabyPbk[tx].in = sk_alpha[tx];
        ak_alpha_X[tx] === inBabyPbk[tx].Ax;
        ak_alpha_Y[tx] === inBabyPbk[tx].Ay;

        component inKeyComputer[tx] = Key();
        inKeyComputer.ak_X <== ak_X[tx];
        inKeyComputer.ak_Y <== ak_Y[tx];

        component inPartialCommitmentHasher[tx] = PartialRecord();
        inPartialCommitmentHasher[tx].chainID <== chainID;
        inPartialCommitmentHasher[tx].pk_X <== inKeyComputer.pk_X;
        inPartialCommitmentHasher[tx].pk_Y <== inKeyComputer.pk_Y;
        inPartialCommitmentHasher[tx].blinding <== inBlinding[tx];

        component inCommitmentHasher[tx]; = Record();
        inCommitmentHasher[tx].assetID <== assetID;
        inCommitmentHasher[tx].tokenID <== tokenID;
        inCommitmentHasher[tx].amount <== inAmount[tx];
        inCommitmentHasher[tx].partialRecord <== inPartialCommitmentHasher.partialRecord;

        inNullifierHasher[tx] = Nullifier();
        inNullifierHasher[tx].pk_X <== inKeyComputer.pk_X;
        inNullifierHasher[tx].pk_Y <== inKeyComputer.pk_Y;
        inNullifierHasher[tx].record <== inCommitmentHasher[tx].out;
        inNullifierHasher[tx].pathIndices <== inPathIndices[tx];
        inNullifierHasher[tx].out === inputNullifier[tx];

        inTree[tx] = ManyMerkleProof(levels, length);
        inTree[tx].leaf <== inCommitmentHasher[tx].out;
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


    component outPartialCommitmentHasher[nOuts];
    component outCommitmentHasher[nOuts];
    component outAmountCheck[nOuts];
    var sumOuts = 0;

    // verify correctness of transaction outputs
    for (var tx = 0; tx < nOuts; tx++) {
        component outPartialCommitmentHasher[tx] = PartialRecord();
        outPartialCommitmentHasher[tx].chainID <== chainID;
        outPartialCommitmentHasher[tx].pk_X <== outPk_X[tx];
        outPartialCommitmentHasher[tx].pk_Y <== outPk_Y[tx];
        outPartialCommitmentHasher[tx].blinding <== outBlinding[tx];

        component outCommitmentHasher[tx]; = Record();
        outCommitmentHasher[tx].assetID <== assetID;
        outCommitmentHasher[tx].tokenID <== tokenID;
        outCommitmentHasher[tx].amount <== outAmount[tx];
        outCommitmentHasher[tx].partialRecord <== outPartialCommitmentHasher.partialRecord;
        
        // Constrain output commitment by reconstructed commitment
        outCommitmentHasher[tx].out === outputCommitment[tx];

        // Check that amount fits into 248 bits to prevent overflow
        outAmountCheck[tx] = Num2Bits(248);
        outAmountCheck[tx].in <== outAmount[tx];

        sumOuts += outAmount[tx];
    }

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
    isShieldedTx.in <== publicAmount;
    component checkAssetIDEqualIfNotShielded = ForceEqualIfEnabled();
    checkAssetIDEqualIfNotShielded.enabled <== 1 - isShieldedTx.out;
    checkAssetIDEqualIfNotShielded.in[0] <== assetID;
    checkAssetIDEqualIfNotShielded.in[1] <== publicAssetID;
    component checkTokenIDEqualIfNotShielded = ForceEqualIfEnabled();
    checkTokenIDEqualIfNotShielded.enabled <== 1 - isShieldedTx.out;
    checkTokenIDEqualIfNotShielded.in[0] <== tokenID;
    checkTokenIDEqualIfNotShielded.in[1] <== publicTokenID;

    // Fee Constraints
    // Check Fee AssetID is allowable
    component membership = SetMembership(numFeeTokens);
    membership.element <== assetID;
    for (var i = 0; i < numFeeTokens; i++) {
        membership.set[i] <== whitelistedAssetIDs[i];
    }

    // Fee Token must be a fungible token
    tokenID === 0;

    var sumFeeIns = 0;

    // verify correctness of transaction inputs
    for (var tx = 0; tx < nFeeIns; tx++) {
        // Check MASP keys well formed
        component feeInBabyPbk[tx] = BabyPbk();
        feeInBabyPbk[tx].in = fee_sk_alpha[tx];
        fee_ak_alpha_X[tx] === feeInBabyPbk[tx].Ax;
        fee_ak_alpha_Y[tx] === feeInBabyPbk[tx].Ay;

        component feeInKeyComputer[tx] = Key();
        feeKeyComputer.ak_X <== fee_ak_X[tx];
        feeKeyComputer.ak_Y <== fee_ak_Y[tx];

        component feeInPartialCommitmentHasher[tx] = PartialRecord();
        feeInPartialCommitmentHasher[tx].chainID <== outChainID[tx];
        feeInPartialCommitmentHasher[tx].pk_X <== feeInKeyComputer.pk_X;
        feeInPartialCommitmentHasher[tx].pk_Y <== feeInKeyComputer.pk_Y;
        feeInPartialCommitmentHasher[tx].blinding <== feeInBlinding[tx];

        component feeInCommitmentHasher[tx]; = Record();
        feeInCommitmentHasher[tx].assetID <== feeAssetID;
        feeInCommitmentHasher[tx].tokenID <== feeTokenID;
        feeInCommitmentHasher[tx].amount <== feeInAmount[tx];
        feeInCommitmentHasher[tx].partialRecord <== feeInPartialCommitmentHasher.partialRecord;

        feeInNullifierHasher[tx] = Nullifier();
        feeInNullifierHasher[tx].pk_X <== feeInKeyComputer.pk_X;
        feeInNullifierHasher[tx].pk_Y <== feeInKeyComputer.pk_Y;
        feeInNullifierHasher[tx].record <== feeInCommitmentHasher[tx].out;
        feeInNullifierHasher[tx].pathIndices <== feeInPathIndices[tx];
        feeInNullifierHasher[tx].out === feeInputNullifier[tx];

        feeInTree[tx] = ManyMerkleProof(levels, length);
        feeInTree[tx].leaf <== feeInCommitmentHasher[tx].out;
        feeInTree[tx].pathIndices <== feeInPathIndices[tx];

        // add the roots and diffs signals to the bridge circuit
        for (var i = 0; i < length; i++) {
            feeInTree[tx].roots[i] <== roots[i];
        }

        feeInTree[tx].isEnabled <== feeInAmount[tx];
        for (var i = 0; i < levels; i++) {
            feeInTree[tx].pathElements[i] <== feenPathElements[tx][i];
        }

        // We don't need to range check input amounts, since all inputs are valid UTXOs that
        // were already checked as outputs in the previous transaction (or zero amount UTXOs that don't
        // need to be checked either).
        sumFeeIns += inAmount[tx];
    }


    component feeOutPartialCommitmentHasher[nOuts];
    component feeOutCommitmentHasher[nOuts];
    component feeOutAmountCheck[nOuts];
    var sumFeeOuts = 0;

    // verify correctness of transaction outputs
    for (var tx = 0; tx < nFeeOuts; tx++) {
        component feeOutPartialCommitmentHasher[tx] = PartialRecord();
        feeOutPartialCommitmentHasher[tx].chainID <== feeOutChainID[tx];
        feeOutPartialCommitmentHasher[tx].pk_X <== feeOutPk_X[tx];
        feeOutPartialCommitmentHasher[tx].pk_Y <== feeOutPk_Y[tx];
        feeOutPartialCommitmentHasher[tx].blinding <== feeOutBlinding[tx];

        component outCommitmentHasher[tx]; = Record();
        feeOutCommitmentHasher[tx].assetID <== feeAssetID;
        feeOutCommitmentHasher[tx].tokenID <== feeTokenID;
        feeOutCommitmentHasher[tx].amount <== feeOutAmount[tx];
        feeOutCommitmentHasher[tx].partialRecord <== feeOutPartialCommitmentHasher[tx].partialRecord;
        
        // Constrain output commitment by reconstructed commitment
        feeOutCommitmentHasher[tx].out === feeOutputCommitment[tx];

        // Check that amount fits into 248 bits to prevent overflow
        feeOutAmountCheck[tx] = Num2Bits(248);
        feeOutAmountCheck[tx].in <== feeOutAmount[tx];

        sumOuts += feeOutAmount[tx];
    }

    // check that there are no same nullifiers among all inputs
    component sameFeeNullifiers[nFeeIns * (nFeeIns - 1) / 2];
    var feeIndex = 0;
    for (var i = 0; i < nFeeIns - 1; i++) {
      for (var j = i + 1; j < nFeeIns; j++) {
          sameFeeNullifiers[index] = IsEqual();
          sameFeeNullifiers[index].in[0] <== feeInputNullifier[i];
          sameFeeNullifiers[index].in[1] <== feeInputNullifier[j];
          sameFeeNullifiers[index].out === 0;
          index++;
      }
    }

    // verify amount invariant
    sumFeeIns === sumFeeOuts;

    // optional safety constraint to make sure extDataHash cannot be changed
    signal extDataSquare;
    extDataSquare <== extDataHash * extDataHash;
}