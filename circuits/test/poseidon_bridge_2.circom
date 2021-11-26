pragma circom 2.0.0;

include "../bridge/withdraw.circom";

component main {public [nullifierHash, recipient, relayer, fee, 
    refund, refreshCommitment, chainID, rootsHash]} = Withdraw(30, 2);

