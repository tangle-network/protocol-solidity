pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../set/membership.circom";
include "./manyMerkleProof.circom";
include "./keypair.circom";

/*
Utxo structure:
{
    chainID, // destination chain identifier
    amount,
    blinding, // random number
    pubkey,
}

commitment = hash(chainID, amount, blinding, pubKey)
nullifier = hash(commitment, privKey, merklePath)
*/

// Universal JoinSplit transaction with nIns inputs and 2 outputs
template Transaction(levels, nIns, nOuts, zeroLeaf, length) {
    // extAmount = external amount used for deposits and withdrawals
    // correct extAmount range is enforced on the smart contract
    // publicAmount = extAmount - fee
    signal input publicAmount;
    signal input extDataHash;

    // data for transaction inputs
    signal input inputNullifier[nIns];
    signal input inAmount[nIns];
    signal input inBlinding[nIns];
    signal input inPrivateKey[nIns];
    signal input inPathIndices[nIns];
    signal input inPathElements[nIns][levels];

    // data for transaction outputs
    signal input outputCommitment[nOuts];
    signal input outputChainID[nOuts];
    signal input outAmount[nOuts];
    signal input outBlinding[nOuts];
    signal input outPubkey[nOuts];

    // roots and diffs for interoperability, one-of-many merkle membership proof
    signal input chainID;
    signal input roots[length];
    signal input diffs[nIns][length];

    component inKeypair[nIns];
    component inUtxoHasher[nIns];
    component nullifierHasher[nIns];
    component tree[nIns];
    component checkRoot[nIns];
    var sumIns = 0;

    // verify correctness of transaction inputs
    for (var tx = 0; tx < nIns; tx++) {
        inKeypair[tx] = Keypair();
        inKeypair[tx].privateKey <== inPrivateKey[tx];

        inUtxoHasher[tx] = Poseidon(4);
        inUtxoHasher[tx].inputs[0] <== chainID;
        inUtxoHasher[tx].inputs[1] <== inAmount[tx];
        inUtxoHasher[tx].inputs[2] <== inBlinding[tx];
        inUtxoHasher[tx].inputs[3] <== inKeypair[tx].publicKey;

        nullifierHasher[tx] = Poseidon(3);
        nullifierHasher[tx].inputs[0] <== inUtxoHasher[tx].out;
        nullifierHasher[tx].inputs[1] <== inPathIndices[tx];
        nullifierHasher[tx].inputs[2] <== inPrivateKey[tx];
        nullifierHasher[tx].out === inputNullifier[tx];

        tree[tx] = ManyMerkleProof(levels, length);
        tree[tx].leaf <== inUtxoHasher[tx].out;
        tree[tx].pathIndices <== inPathIndices[tx];

        // add the roots and diffs signals to the bridge circuit
        for (var i = 0; i < length; i++) {
            tree[tx].roots[i] <== roots[i];
            tree[tx].diffs[i] <== diffs[tx][i];
        }

        tree[tx].isEnabled <== inAmount[tx];
        for (var i = 0; i < levels; i++) {
            tree[tx].pathElements[i] <== inPathElements[tx][i];
        }

        // We don't need to range check input amounts, since all inputs are valid UTXOs that 
        // were already checked as outputs in the previous transaction (or zero amount UTXOs that don't 
        // need to be checked either).

        sumIns += inAmount[tx];
    }

    component outUtxoHasher[nOuts];
    component outAmountCheck[nOuts];
    var sumOuts = 0;

    // verify correctness of transaction outputs
    for (var tx = 0; tx < nOuts; tx++) {
        outUtxoHasher[tx] = Poseidon(4);
        outUtxoHasher[tx].inputs[0] <== outputChainID[tx];
        outUtxoHasher[tx].inputs[1] <== outAmount[tx];
        outUtxoHasher[tx].inputs[2] <== outBlinding[tx];
        outUtxoHasher[tx].inputs[3] <== outPubkey[tx];
        outUtxoHasher[tx].out === outputCommitment[tx];

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

    // optional safety constraint to make sure extDataHash cannot be changed
    signal extDataSquare;
    extDataSquare <== extDataHash * extDataHash;
}