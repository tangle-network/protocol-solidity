pragma circom 2.0.0;

include "./MerkleTree.circom";

// inserts a leaf into a tree
// checks that tree previously contained zero in the same position
template MerkleTreeUpdater(levels, zeroLeaf) {
    signal input oldRoot;
    signal input newRoot;
    signal input leaf;
    signal input pathIndices;
    signal input pathElements[levels]; //private

    // Compute indexBits once for both trees
    // Since Num2Bits is non deterministic, 2 duplicate calls to it cannot be
    // optimized by circom compiler
    component indexBits = Num2Bits(levels);
    indexBits.in <== pathIndices;

    component treeBefore = RawMerkleTree(levels);
    for(var i = 0; i < levels; i++) {
        treeBefore.pathIndices[i] <== indexBits.out[i];
        treeBefore.pathElements[i] <== pathElements[i];
    }
    treeBefore.leaf <== zeroLeaf;
    treeBefore.root === oldRoot;

    component treeAfter = RawMerkleTree(levels);
    for(var i = 0; i < levels; i++) {
        treeAfter.pathIndices[i] <== indexBits.out[i];
        treeAfter.pathElements[i] <== pathElements[i];
    }
    treeAfter.leaf <== leaf;
    treeAfter.root === newRoot;
}
