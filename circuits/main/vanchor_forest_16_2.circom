pragma circom 2.0.0;  

include "../vanchor/transactionForest.circom";

// zeroLeaf = Poseidon(zero, zero)
// default `zero` value is keccak256("tornado") % FIELD_SIZE = 21663839004416932945382355908790599225266501822907911457504978515578255421292
component main {public [publicAmount, extDataHash, inputNullifier, outputCommitment, chainID, roots]} = TransactionForest(5, 30, 16, 2, 11850551329423159860688778991827824730037759162201783566284850822760196767874, 2);
