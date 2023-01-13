pragma circom 2.0.0;  

include "../masp-vanchor/transaction.circom";

// zeroLeaf = Poseidon(zero, zero)
// default `zero` value is keccak256("tornado") % FIELD_SIZE = 21663839004416932945382355908790599225266501822907911457504978515578255421292
component main {public [publicAmount, extDataHash, publicAssetID, publicTokenID, inputNullifier, outputCommitment, chainID, roots, ak_alpha_X, ak_alpha_Y, feeInputNullifier, feeOutputCommitment, fee_ak_alpha_X, fee_ak_alpha_Y]} = Transaction(30, 16, 2, 2, 2,11850551329423159860688778991827824730037759162201783566284850822760196767874, 2, 10);