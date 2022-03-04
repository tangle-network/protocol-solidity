pragma circom 2.0.0;

include "../anchor/withdraw.circom";

component main {public [nullifierHash, extDataHash, chainID, roots]} = Withdraw(30, 5);
