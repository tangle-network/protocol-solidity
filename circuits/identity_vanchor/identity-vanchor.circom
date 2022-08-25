pragma circom 2.0.0;

include "../vanchor/transaction.circom";
include "./semaphore.circom";

template IdentityVAnchor(levels, nIns, nOuts, zeroLeaf, semaphoreSetLength, vanchorSetLength) {
    // Semaphore inputs
    signal input semaphoreIdentityNullifier;
    signal input semaphoreIdentityTrapdoor;
    signal input semaphoreTreePathIndices[levels];
    signal input semaphoreTreeSiblings[levels];

    signal input semaphoreSignalHash;
    signal input semaphoreExternalNullifier;

    // roots for interoperability, one-of-many merkle membership proof
    signal input semaphoreRoots[semaphoreSetLength];
    signal input chainID;

    signal output nullifierHash;


    // VAnchor inputs
    signal input publicAmount;
    signal input extDataHash; // arbitrary

    // data for transaction inputs
    signal input inputNullifier[nIns];
    signal input inAmount[nIns];
    signal input inPrivateKey[nIns];
    signal input inBlinding[nIns];
    signal input inPathIndices[nIns];
    signal input inPathElements[nIns][levels];

    // data for transaction outputs
    signal input outputCommitment[nOuts];
    signal input outChainID[nOuts];
    signal input outAmount[nOuts];
    signal input outPubkey[nOuts];
    signal input outBlinding[nOuts];

    // roots for interoperability, one-of-many merkle membership proof
    signal input vanchorRoots[vanchorSetLength];

    component semaphore =  Semaphore(levels, semaphoreSetLength);

    semaphore.identityNullifier <== semaphoreIdentityNullifier;
    semaphore.identityTrapdoor <== semaphoreIdentityTrapdoor;
    for (var i = 0; i < levels; i++) {
        semaphore.treePathIndices[i] <== semaphoreTreePathIndices[i];
        semaphore.treeSiblings[i] <== semaphoreTreeSiblings[i];
    }
    semaphore.signalHash <== semaphoreSignalHash;
    semaphore.externalNullifier <== semaphoreExternalNullifier;
    semaphore.chainID <== chainID;

    for (var i = 0; i < semaphoreSetLength; i++) {
        semaphore.roots[i] <== semaphoreRoots[i];
    }
    nullifierHash <== semaphore.nullifierHash;

    component vanchor =  Transaction(levels, nIns, nOuts, zeroLeaf, vanchorSetLength);

    vanchor.publicAmount <== publicAmount;
    vanchor.extDataHash <== extDataHash;
    for (var i = 0; i < nIns; i++) {
        vanchor.inputNullifier[i] <== inputNullifier[i];
        vanchor.inAmount[i] <== inAmount[i];
        vanchor.inPrivateKey[i] <== inPrivateKey[i];
        vanchor.inBlinding[i] <== inBlinding[i];
        vanchor.inPathIndices[i] <== inPathIndices[i];
        for (var j = 0; j < levels; j++) {
            vanchor.inPathElements[i][j] <== inPathElements[i][j];
        }
    }
    for (var i = 0; i < nOuts; i++) {
        vanchor.outputCommitment[i] <== outputCommitment[i];
        vanchor.outChainID[i] <== outChainID[i];
        vanchor.outAmount[i] <== outAmount[i];
        vanchor.outPubkey[i] <== outPubkey[i];
        vanchor.outBlinding[i] <== outBlinding[i];
    }
    for (var i = 0; i < vanchorSetLength; i++) {
        vanchor.roots[i] <== vanchorRoots[i];
    }
}
