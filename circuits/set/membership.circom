pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/comparators.circom";

template SetMembership(length) {
    signal input element;
    signal input set[length];

    signal product[length + 1];
    product[0] <== 1;

    component isEqualChecker[length];
    component isZeroChecker[length];

    for(var i = 0; i < length; i++) {
     isEqualChecker[i] = IsEqual();
     isZeroChecker[i] = IsZero();

     isEqualChecker[i].in[0] <== element;
     isEqualChecker[i].in[1] <== set[i];

     isZeroChecker[i].in <== isEqualChecker[i].out;

     product[i + 1] <== product[i] * isZeroChecker[i].out;
    }

    product[length] === 0;
}