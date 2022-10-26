pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";
include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../set/membership.circom";
include "../merkle-tree/manyMerkleProof.circom";
include "../vanchor/keypair.circom";

/*
UTXO structure:
{
    assetID
    amount,
    Hash {
        chainID, // destination chain identifier
        pubkey,
        blinding, // random number
    }
}

commitment = hash(assetID, amount, hash(chainID, pubKey, blinding))
nullifier = hash(commitment, merklePath, sign(privKey, commitment, merklePath))
*/

// Universal JoinSplit transaction with nIns inputs and 2 outputs (2-2 & 16-2)
template Transaction(levels, nIns, nOuts, zeroLeaf, length) {
    // extAmount = external amount used for deposits and withdrawals
    // correct extAmount range is enforced on the smart contract
    // publicAmount = extAmount - fee
    signal input publicAmount;
    signal input extDataHash; // arbitrary

    // data for input/output asset identifier
    signal input assetID;
    signal input outAssetID;

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
    signal input outPubkey[nOuts];
    signal input outBlinding[nOuts];

    // roots for interoperability, one-of-many merkle membership proof
    signal input chainID;
    signal input roots[length];

    component inKeypair[nIns];
    component inSignature[nIns];
    component inCommitmentHasher[nIns];
    component inPartialCommitmentHasher[nIns];
    component inNullifierHasher[nIns];
    component inTree[nIns];
    component inCheckRoot[nIns];
    var sumIns = 0;

    // verify correctness of transaction inputs
    for (var tx = 0; tx < nIns; tx++) {
        inKeypair[tx] = Keypair();
        inKeypair[tx].privateKey <== inPrivateKey[tx];
        
        // Compute intermediate hash
        inPartialCommitmentHasher[tx] = Poseidon(3);
        inPartialCommitmentHasher[tx].inputs[0] <== chainID;
        inPartialCommitmentHasher[tx].inputs[1] <== inKeypair[tx].publicKey;
        inPartialCommitmentHasher[tx].inputs[2] <== inBlinding[tx];

        // Compute commitment hash
        inCommitmentHasher[tx] = Poseidon(3);
        inCommitmentHasher[tx].inputs[0] <== assetID;
        inCommitmentHasher[tx].inputs[1] <== inAmount[tx];
        inCommitmentHasher[tx].inputs[2] <== inPartialCommitmentHasher[tx].out;

        inSignature[tx] = Signature();
        inSignature[tx].privateKey <== inPrivateKey[tx];
        inSignature[tx].commitment <== inCommitmentHasher[tx].out;
        inSignature[tx].merklePath <== inPathIndices[tx];

        inNullifierHasher[tx] = Poseidon(3);
        inNullifierHasher[tx].inputs[0] <== inCommitmentHasher[tx].out;
        inNullifierHasher[tx].inputs[1] <== inPathIndices[tx];
        inNullifierHasher[tx].inputs[2] <== inSignature[tx].out;
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
        // Compute intermediate hash
        outPartialCommitmentHasher[tx] = Poseidon(3);
        outPartialCommitmentHasher[tx].inputs[0] <== chainID;
        outPartialCommitmentHasher[tx].inputs[1] <== outPubkey[tx];
        outPartialCommitmentHasher[tx].inputs[2] <== outBlinding[tx];

        // Compute commitment hash
        outCommitmentHasher[tx] = Poseidon(3);
        outCommitmentHasher[tx].inputs[0] <== assetID;
        outCommitmentHasher[tx].inputs[1] <== outAmount[tx];
        outCommitmentHasher[tx].inputs[2] <== inPartialCommitmentHasher[tx].out;
        
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
    component checkEqualIfNotShielded = ForceEqualIfEnabled();
    checkEqualIfNotShielded.enabled <== 1 - isShieldedTx.out;
    checkEqualIfNotShielded.in[0] <== assetID;
    checkEqualIfNotShielded.in[1] <== outAssetID;

    // optional safety constraint to make sure extDataHash cannot be changed
    signal extDataSquare;
    extDataSquare <== extDataHash * extDataHash;
}