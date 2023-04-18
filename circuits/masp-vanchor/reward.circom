pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
include "../merkle-tree/manyMerkleProof.circom";
include "../merkle-tree/merkleTree.circom";
include "../vanchor/keypair.circom";
include "./key.circom";
include "./nullifier.circom";
include "./record.circom";
include "./babypow.circom";

template Reward(levels, zeroLeaf, length) {
	signal input rate;
	signal input fee;
	signal input rewardNullifier;
	signal input extDataHash;

	// MASP Spent Note for which anonymity points are being claimed
	signal input noteChainID;
	signal input noteAmount;
	signal input noteAssetID;
	signal input noteTokenID;
	signal input note_ak_X;
	signal input note_ak_Y;
	signal input noteBlinding;
	signal input notePathIndices;

	// inputs prefixed with input correspond to the vanchor utxos
	signal input inputChainID;
	signal input inputAmount;
	signal input inputPrivateKey;
	signal input inputBlinding;
	signal input inputNullifier;
	signal input inputRoot;
	signal input inputPathElements[levels];
	signal input inputPathIndices;

	// inputs prefixed with output correspond to the anonymity points vanchor
	signal input outputChainID;
	signal input outputAmount;
	signal input outputPrivateKey;
	signal input outputBlinding;
	signal input outputCommitment;

	// inputs prefixed with spent correspond to the already spent UTXO
	signal input spentTimestamp;
	signal input spentRoots[length];
	signal input spentPathIndices;
	signal input spentPathElements[levels];

	signal input unspentTimestamp;
	signal input unspentRoots[length];
	signal input unspentPathIndices;
	signal input unspentPathElements[levels];

	// Check amount invariant
	signal intermediateRewardValue;
	signal rewardAmount;
	intermediateRewardValue <== rate * (spentTimestamp - unspentTimestamp);
	rewardAmount <== intermediateRewardValue * noteAmount;

	inputAmount + rewardAmount === outputAmount + fee;
	/* inputAmount + (rate * (spentTimestamp - unspentTimestamp)) === outputAmount + fee; */


	// === check input and output accounts and block time ===
	// Check that amounts fit into 248 bits to prevent overflow
	// Fee range is checked by the smart contract
	// Technically block range check could be skipped because it can't be large enough
	// negative number that `outputAmount` fits into 248 bits
	component inputAmountCheck = Num2Bits(248);
	component outputAmountCheck = Num2Bits(248);

	// TODO: Check how many bits we should use here
	component blockRangeCheck = Num2Bits(32);
	inputAmountCheck.in <== inputAmount;
	outputAmountCheck.in <== outputAmount;
	blockRangeCheck.in <== spentTimestamp - unspentTimestamp;

	component inputKeypair = Keypair();
	inputKeypair.privateKey <== inputPrivateKey;

	// Compute input commitment
	component inputHasher = Poseidon(4);
	inputHasher.inputs[0] <== inputChainID;
	inputHasher.inputs[1] <== inputAmount;
	inputHasher.inputs[2] <== inputKeypair.publicKey;
	inputHasher.inputs[3] <== inputBlinding;

	component inputSignature = Signature();
	inputSignature.privateKey <== inputPrivateKey;
	inputSignature.commitment <== inputHasher.out;
	inputSignature.merklePath <== inputPathIndices;

	component inputNullifierHasher = Poseidon(3);
	inputNullifierHasher.inputs[0] <== inputHasher.out;
	inputNullifierHasher.inputs[1] <== inputPathIndices;
	inputNullifierHasher.inputs[2] <== inputSignature.out;
	inputNullifierHasher.out === inputNullifier;

	component inputTree = MerkleTree(levels);
	inputTree.leaf <== inputHasher.out;
	inputTree.pathIndices <== inputPathIndices;

	for (var i = 0; i < levels; i++) {
		inputTree.pathElements[i] <== inputPathElements[i];
	}

	component checkRoot = ForceEqualIfEnabled();
	checkRoot.in[0] <== inputRoot;
	checkRoot.in[1] <== inputTree.root;
	checkRoot.enabled <== inputAmount;

	// Compute and verify output commitment
	component outputKeypair = Keypair();
	outputKeypair.privateKey <== outputPrivateKey;

	component outputHasher = Poseidon(4);
	outputHasher.inputs[0] <== outputChainID;
	outputHasher.inputs[1] <== outputAmount;
	outputHasher.inputs[2] <== outputKeypair.publicKey;
	outputHasher.inputs[3] <== outputBlinding;
	outputHasher.out === outputCommitment;

	// === check deposit and withdrawal ===
	// Compute tornado.cash commitment and nullifier

	component noteKeyComputer = Key();
	noteKeyComputer.ak_X <== note_ak_X;
	noteKeyComputer.ak_Y <== note_ak_Y;

	// Compute MASP commitment
	// MASP Inner Partial Commitment
	component noteInnerPartialCommitmentHasher = InnerPartialRecord();
	noteInnerPartialCommitmentHasher.blinding <== noteBlinding;
	// MASP Partial Commitment
	component notePartialCommitmentHasher = PartialRecord();
	notePartialCommitmentHasher.chainID <== noteChainID;
	notePartialCommitmentHasher.pk_X <== noteKeyComputer.pk_X;
	notePartialCommitmentHasher.pk_Y <== noteKeyComputer.pk_Y;
	notePartialCommitmentHasher.innerPartialRecord <== noteInnerPartialCommitmentHasher.innerPartialRecord;

	// MASP Full Commitment
	component noteRecordHasher = Record();
	noteRecordHasher.assetID <== noteAssetID;
	noteRecordHasher.tokenID <== noteTokenID;
	noteRecordHasher.amount <== noteAmount;
	noteRecordHasher.partialRecord <== notePartialCommitmentHasher.partialRecord;

	// MASP Nullifier
	component noteNullifierHasher = Nullifier();
	noteNullifierHasher.record <== noteRecordHasher.record;
	noteNullifierHasher.pathIndices <== notePathIndices;

	// Compute deposit commitment
	component unspentHasher = Poseidon(2);
	unspentHasher.inputs[0] <== noteRecordHasher.record;
	unspentHasher.inputs[1] <== unspentTimestamp;

	// Verify that deposit commitment exists in the tree
	component unspentTree = ManyMerkleProof(levels, length);
	unspentTree.leaf <== unspentHasher.out;
	unspentTree.pathIndices <== unspentPathIndices;
	for (var i = 0; i < levels; i++) {
	unspentTree.pathElements[i] <== unspentPathElements[i];
	}

	unspentTree.isEnabled <== 1;
	for (var i = 0; i < length; i++) {
		unspentTree.roots[i] <== unspentRoots[i];
	}

	// Compute withdrawal commitment
	component spentHasher = Poseidon(2);
	spentHasher.inputs[0] <== noteNullifierHasher.nullifier;
	spentHasher.inputs[1] <== spentTimestamp;

	// Verify that withdrawal commitment exists in the tree
	component spentTree = ManyMerkleProof(levels, length);
	spentTree.leaf <== spentHasher.out;
	spentTree.pathIndices <== spentPathIndices;
	for (var i = 0; i < levels; i++) {
	spentTree.pathElements[i] <== spentPathElements[i];
	}
	spentTree.isEnabled <== 1;
	for (var i = 0; i < length; i++) {
		spentTree.roots[i] <== spentRoots[i];
	}

	// Compute reward nullifier
	component rewardNullifierHasher = Poseidon(2);
	rewardNullifierHasher.inputs[0] <== noteNullifierHasher.nullifier;
	rewardNullifierHasher.inputs[1] <== notePathIndices;
	rewardNullifierHasher.out === rewardNullifier;

	// Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
	// Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
	// Squares are used to prevent optimizer from removing those constraints
	signal extDataHashSquare;
	extDataHashSquare <== extDataHash * extDataHash;
}