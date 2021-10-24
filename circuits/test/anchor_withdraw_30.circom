pragma circom 2.0.0;

include "../anchor/withdraw.circom";

component main {public [root, nullifierHash, recipient, relayer, fee, refund]} = Withdraw(30);

 
