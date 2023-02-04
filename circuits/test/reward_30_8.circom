pragma circom 2.0.0;

include "../masp-vanchor/reward.circom";

component main { public [rate, fee, rewardNullifier, note_ak_alpha_X, note_ak_alpha_Y, extDataHash, inputRoot, inputNullifier, outputCommitment, spentRoots, unspentRoots] } = Reward(30, 21663839004416932945382355908790599225266501822907911457504978515578255421292, 8);