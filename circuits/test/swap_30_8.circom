pragma circom 2.0.0;

include "../masp-vanchor/swap.circom";

component main { public [aliceSpendNullifier, bobSpendNullifier, swapChainID, roots, currentTimestamp, aliceChangeRecord, bobChangeRecord, aliceReceiveRecord, bobReceiveRecord ] } = Swap(30, 8);