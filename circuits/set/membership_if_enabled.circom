pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";

// Set membership gadget is handled with a multiplicative trick.
//
// For a given set of elements, a prover first computes the difference between
// each element in the set and the element they are proving knowledge of. We
// constrain this operation accordingly. We then multiply all differences and constrain
// this value by zero. If the prover actually knows an element in the set then for that
// element, it must hold that the difference is 0. Therefore, the product of 0 and
// anything else should be 0. The prove can't lie by adding a zero into the diffs set
// because we constrain those to match all elements in the set respectively.
template ForceSetMembershipIfEnabled(length) {
  signal input element;
  signal input set[length];
  signal input diffs[length];
  signal input enabled;
  
  signal int1[length];
  signal int2[length];
  signal int3[length];
 
  signal bool;

  signal product[length + 1];
  

  product[0] <== element;

  component isz = IsZero();
  isz.in <== enabled;
  bool <== 1 - isz.out;
  bool * (1 - bool) === 0; //sanity check
  
  for (var i = 0; i < length; i++) { 
    int1[i] <== set[i] * bool;
    int2[i] <== (diffs[i] + element);
    int3[i] <== int2[i] * bool;
    int1[i] === int3[i];
    product[i + 1] <== product[i] * diffs[i];
  }

  product[length]*enabled === 0;
}
