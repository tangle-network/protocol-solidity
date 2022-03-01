pragma circom 2.0.0;

include "../bridge/withdraw.circom";

component main {public [nullifierHash, extDataHash, chainID, roots]} = Withdraw(30, 3);
