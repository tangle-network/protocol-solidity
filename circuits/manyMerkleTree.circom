include "../node_modules/circomlib/circuits/mimcsponge.circom";

// Set membership gadget is handled with a multiplicative trick.
//
// For a given set of elements, a prover first computes the difference between
// each element in the set and the element they are proving knowledge of. We
// constrain this operation accordingly. We then multiply all differences and constrain
// this value by zero. If the prover actually knows an element in the set then for that
// element, it must hold that the difference is 0. Therefore, the product of 0 and
// anything else should be 0. The prove can't lie by adding a zero into the diffs set
// because we constrain those to match all elements in the set respectively.
template SetMembership(length) {
  signal input element;
  signal input set[length];
  signal input diffs[length];

  signal product[length + 1];
  product[0] <== element;
  for (var i = 0; i < length; i++) {
    set[i] === diffs[i] + element;
    product[i + 1] <== product[i] * diffs[i];
  }

  product[length] === 0
}

// Computes MiMC([left, right])
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = MiMCSponge(2, 220, 1);
    hasher.ins[0] <== left;
    hasher.ins[1] <== right;
    hasher.k <== 0;
    hash <== hasher.outs[0];
}

// if s == 0 returns [in[0], in[1]]
// if s == 1 returns [in[1], in[0]]
template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0
    out[0] <== (in[1] - in[0])*s + in[0];
    out[1] <== (in[0] - in[1])*s + in[1];
}

// Verifies that merkle proof is correct for given merkle root and a leaf
// pathIndices input is an array of 0/1 selectors telling whether given pathElement is on the left or right side of merkle path
template ManyMerkleTreeChecker(levels, length) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];
    signal input roots[length];
    signal input diffs[length];

    component selectors[levels];
    component hashers[levels];

    for (var i = 0; i < levels; i++) {
        selectors[i] = DualMux();
        selectors[i].in[0] <== i == 0 ? leaf : hashers[i - 1].hash;
        selectors[i].in[1] <== pathElements[i];
        selectors[i].s <== pathIndices[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== selectors[i].out[0];
        hashers[i].right <== selectors[i].out[1];
    }

    // verify that the resultant hash (computed merkle root)
    // is in the set of roots
    component set = SetMembership(length);
    set.element <== hashers[levels - 1].hash;
    for (var i = 0; i < length; i++) {
        set.set[i] <== roots[i];
        set.diffs[i] <== diffs[i];
    }
}