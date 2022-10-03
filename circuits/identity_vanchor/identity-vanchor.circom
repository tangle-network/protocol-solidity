pragma circom 2.0.0;

include "../vanchor/transaction.circom";
include "./semaphore.circom";
include "./manyMerkleProof.circom";

template IdentityVAnchor(levels, nIns, nOuts, zeroLeaf, length) {
    // Semaphore inputs
    signal input privateKey;
    signal input semaphoreTreePathIndices[levels];
    signal input semaphoreTreeSiblings[levels];

    // roots for interoperability, one-of-many merkle membership proof
    signal input semaphoreRoots[length];
    signal input chainID;

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
    signal input outSemaphoreTreePathIndices[nOuts][levels];
    // TODO: can we reduce this to a single index per nOut?
    signal input outSemaphoreTreeElements[nOuts][levels];
    signal input outBlinding[nOuts];

    // roots for interoperability, one-of-many merkle membership proof
    signal input vanchorRoots[length];

    component semaphore =  Semaphore(levels, length);

    semaphore.privateKey <== privateKey;
    for (var i = 0; i < levels; i++) {
        semaphore.treePathIndices[i] <== semaphoreTreePathIndices[i];
        semaphore.treeSiblings[i] <== semaphoreTreeSiblings[i];
    }
    semaphore.chainID <== chainID;

    for (var i = 0; i < length; i++) {
        semaphore.roots[i] <== semaphoreRoots[i];
    }

    component vanchor =  Transaction(levels, nIns, nOuts, zeroLeaf, length);

    vanchor.publicAmount <== publicAmount;
    vanchor.extDataHash <== extDataHash;
    vanchor.chainID <== chainID;
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
    for (var i = 0; i < length; i++) {
        vanchor.roots[i] <== vanchorRoots[i];
    }

    component publicSemaphore[nOuts];
    
    for (var n = 0; n < nOuts; n++) {
        publicSemaphore[n] = ManyMerkleProofPublic(levels, length);
        publicSemaphore[n].leaf <== outPubkey[n];
        publicSemaphore[n].enabled <== outAmount[n];
        for (var i = 0; i < length; i++) {
            publicSemaphore[n].roots[i] <== semaphoreRoots[i];
        }
        for (var i = 0; i < levels; i++) {
            publicSemaphore[n].pathIndices[i] <== outSemaphoreTreePathIndices[n][i];
            publicSemaphore[n].pathElements[i] <== outSemaphoreTreeElements[n][i];
        }
    }
}
