// Set membership gadget is handled with a multiplicative trick.
//
// For a given set of elements, a prover first computes the difference between
// each element in the set and the element they are proving knowledge of. We
// add a constraint for each element that the difference plus the element is equal to each
// respective element in the set. We then multiply all differences and constrain
// this value by zero. If the prover actually knows an element in the set then for that
// element, it must hold that the difference is 0. Therefore, the product of 0 and
// anything else should be 0.
template SetMembership(length) {
  signal input element;
  signal input set[length];
  signal input diffs[length];

  var product = element;
  for (i = 0; i < length; i++) {
    set[i] === diffs[i] + element;
    product = product * diffs[i];
  }

  product === 0
}