pragma circom 2.0.0;

include "merkleTree.circom";

// computes Poseidon(chainID, nullifier, secret)
template CommitmentHasher() {
    signal input nullifier; // private
    signal input secret; // private 
    signal output commitment; 
    signal output nullifierHash;

    component commitmentHasher = HashLeftRight();
    commitmentHasher.left <== nullifier;
    commitmentHasher.right <== secret;

    component nullifierHasher = HashLeftRight();
    nullifierHasher.left <==  nullifier;
    nullifierHasher.right <== nullifier;

    commitment <== commitmentHasher.hash;
    nullifierHash <== nullifierHasher.hash;
}

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdraw(levels) {
    signal input root;                  // public
    signal input nullifierHash;         // public
    signal input recipient;             // public - not taking part in any computations
    signal input relayer;               // public - not taking part in any computations
    signal input fee;                   // public - not taking part in any computations
    signal input refund;                // public - not taking part in any computations
    signal input nullifier;             // private
    signal input secret;                // private
    signal input pathElements[levels];  // private
    signal input pathIndices[levels];   // private

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
    // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
    // Squares are used to prevent optimizer from removing those constraints
    signal recipientSquare;
    signal feeSquare;
    signal relayerSquare;
    signal refundSquare;
    recipientSquare <== recipient * recipient;
    feeSquare <== fee * fee;
    relayerSquare <== relayer * relayer;
    refundSquare <== refund * refund;
}
