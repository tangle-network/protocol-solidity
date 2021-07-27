include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/pedersen.circom";
include "manyMerkleTree.circom";

// computes Poseidon(chainID, nullifier, secret)
template CommitmentHasher() {
    signal input chainID;
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;

    component poseidon3Hasher = Hasher3();
    poseidon3Hasher.in[0] <== chainID;
    poseidon3Hasher.in[1] <== nullifier;
    poseidon3Hasher.in[2] <== secret;

    component nullifierHasher = HashLeftRight();
    nullifierHasher.left <==  nullifier;
    nullifierHasher.right <== nullifier;

    commitment <== poseidon3Hasher.hash;
    nullifierHash <== nullifierHasher.hash;
}

// Verifies that commitment that corresponds to given secret and nullifier is included in the merkle tree of deposits
template Withdraw(levels, length) {
    signal input nullifierHash;
    signal input recipient; // not taking part in any computations
    signal input relayer;  // not taking part in any computations
    signal input fee;      // not taking part in any computations
    signal input refund;   // not taking part in any computations

    // chainID fixes a withdrawal proof to the destination since
    // this will be taken as a public input from the smart contract.
    signal input chainID;
    // the set of roots to prove membership within, provided
    // as a public input from the smart contract.
    signal input roots[length];


    signal private input nullifier;
    signal private input secret;
    signal private input pathElements[levels];
    signal private input pathIndices[levels];
    // the differences of the root one is proving against and
    // all the roots provided as a public input in the `roots` signal.
    signal private input diffs[length];

    component hasher = CommitmentHasher();
    hasher.chainID <== chainID;
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    component tree = ManyMerkleTreeChecker(levels, length);
    tree.leaf <== hasher.commitment;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // add the roots and diffs signals to the bridge circuit
    for (var i = 0; i < length; i++) {
        tree.roots[i] <== roots[i];
        tree.diffs[i] <== diffs[i];
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
