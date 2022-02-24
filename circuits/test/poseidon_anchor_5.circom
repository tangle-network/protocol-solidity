pragma circom 2.0.0;

include "../anchor/withdraw.circom";

component main {public [nullifierHash, recipient, relayer, fee, 
    refund, refreshCommitment, chainID, roots]} = Withdraw(30, 5);
