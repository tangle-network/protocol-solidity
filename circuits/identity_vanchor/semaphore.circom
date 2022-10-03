pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "./manyMerkleProof.circom";

// nLevels must be < 32.
template Semaphore(nLevels, length) {
    signal input privateKey;
    signal input treePathIndices[nLevels];
    signal input treeSiblings[nLevels];

    // roots for interoperability, one-of-many merkle membership proof
    signal input roots[length];
    signal input chainID;

    component poseidon = Poseidon(1);
    poseidon.inputs[0] <== privateKey;

    signal publicKey;
    publicKey <== poseidon.out;

    component inclusionProof = ManyMerkleProofIdentity(nLevels, length);
    inclusionProof.leaf <== publicKey;
    // transformed value into list of values due to semaphore usage
    /* inclusionProof.pathIndices <== inPathIndices[tx]; */

    // add the roots and diffs signals to the bridge circuit
    for (var i = 0; i < length; i++) {
        inclusionProof.roots[i] <== roots[i];
    }

    for (var i = 0; i < nLevels; i++) {
        inclusionProof.pathElements[i] <== treeSiblings[i];
        inclusionProof.pathIndices[i] <== treePathIndices[i];
    }

    // Dummy square to prevent tampering chainID.
    signal chainIDSquared;
    chainIDSquared <== chainID * chainID;
}
