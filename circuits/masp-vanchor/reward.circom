include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "./Utils.circom";
include "./MerkleTree.circom";
include "./MerkleTreeUpdater.circom";
/* include "../vanchor/transaction.circom"; */
include "../merkle-tree/manyMerkleProof.circom";

template Reward(levels, zeroLeaf, length) {
  signal input rate;
  signal input fee;
  signal input instance;
  signal input rewardNullifier;
  signal input extDataHash;

  signal input noteSecret;
  signal input noteNullifier;

  signal input inputChainID;
  signal input inputAmount;
  signal input inputPrivateKey;
  signal input inputBlinding;
  signal input inputNullifier;
  signal input inputRoots[length];
  signal input inputPathElements[levels];
  signal input inputPathIndices;
  signal input inputNullifierHash;

  signal input outputChainID;
  signal input outputAmount;
  signal input outputPrivateKey;
  signal input outputBlinding;
  /* signal input outputNullifier; */
  signal input outputRoot;
  signal input outputPathIndices;
  signal input outputPathElements[levels];
  signal input outputCommitment;

  signal input depositTimestamp;
  signal input depositRoot;
  signal input depositPathIndices;
  signal input depositPathElements[levels];

  signal input withdrawalTimestamp;
  signal input withdrawalRoot;
  signal input withdrawalPathIndices;
  signal input withdrawalPathElements[levels];

  // Check amount invariant
  inputAmount + rate * (withdrawalTimestamp - depositTimestamp) === outputAmount + fee;

  // === check input and output accounts and block range ===
  // Check that amounts fit into 248 bits to prevent overflow
  // Fee range is checked by the smart contract
  // Technically block range check could be skipped because it can't be large enough
  // negative number that `outputAmount` fits into 248 bits
  component inputAmountCheck = Num2Bits(248);
  component outputAmountCheck = Num2Bits(248);
  component blockRangeCheck = Num2Bits(32);
  inputAmountCheck.in <== inputAmount;
  outputAmountCheck.in <== outputAmount;
  blockRangeCheck.in <== withdrawalTimestamp - depositTimestamp;

  keypair = Keypair();
  keypair.privateKey <== inputPrivateKey;

  // Compute input commitment
  component inputHasher = Poseidon(4);
  inputHasher.inputs[0] <== inputChainID;
  inputHasher.inputs[1] <== inputAmount;
  inputHasher.inputs[2] <== keypair.publicKey;
  inputHasher.inputs[3] <== inputBlinding;

  inputSignature = Signature();
  inputSignature.privateKey <== inputPrivateKey;
  inputSignature.commitment <== inputHasher.out;
  inputSignature.merklePath <== inputPathIndices;
  
  inputNullifierHasher = Poseidon(3);
  inputNullifierHasher.inputs[0] <== inputHasher.out;
  inputNullifierHasher.inputs[1] <== inputPathIndices;
  inputNullifierHasher.inputs[2] <== inputSignature.out;
  inputNullifierHasher.out === inputNullifier;
  
  inputTree = ManyMerkleProof(levels, length);
  inputTree.leaf <== inputHasher.out;
  inputTree.pathIndices <== inputPathIndices;
  
  // add the roots and diffs signals to the bridge circuit
  for (var i = 0; i < length; i++) {
      inputTree.roots[i] <== inputRoots[i];
  }
  
  inputTree.isEnabled <== inputAmount;
  for (var i = 0; i < levels; i++) {
      inputTree.pathElements[i] <== inputPathElements[tx][i];
  }

  // Compute and verify output commitment
  component outputHasher = Poseidon(4);
  outputHasher.inputs[0] <== outputChainID;
  outputHasher.inputs[1] <== outputAmount;
  outputHasher.inputs[2] <== outputPrivateKey;
  outputHasher.inputs[3] <== outputBlinding;
  outputHasher.out === outputCommitment;

  // Update accounts tree with output account commitment
  component accountTreeUpdater = MerkleTreeUpdater(levels, zeroLeaf);
  accountTreeUpdater.oldRoot <== inputRoots[0];
  accountTreeUpdater.newRoot <== outputRoot;
  accountTreeUpdater.leaf <== outputCommitment;
  accountTreeUpdater.pathIndices <== outputPathIndices;
  for (var i = 0; i < levels; i++) {
      accountTreeUpdater.pathElements[i] <== outputPathElements[i];
  }

  // === check deposit and withdrawal ===
  // Compute tornado.cash commitment and nullifier
  /* component noteHasher = TornadoCommitmentHasher(); */
  /* noteHasher.nullifier <== noteNullifier; */
  /* noteHasher.secret <== noteSecret; */

  // Compute deposit commitment
  component depositHasher = Poseidon(2);
  depositHasher.inputs[1] <== inputHasher.out;
  depositHasher.inputs[2] <== depositTimestamp;

  // Verify that deposit commitment exists in the tree
  component depositTree = MerkleTree(levels);
  depositTree.leaf <== depositHasher.out;
  depositTree.pathIndices <== depositPathIndices;
  for (var i = 0; i < levels; i++) {
    depositTree.pathElements[i] <== depositPathElements[i];
  }
  depositTree.root === depositRoot;

  // Compute withdrawal commitment
  component withdrawalHasher = Poseidon(2);
  withdrawalHasher.inputs[1] <== inputNullifier;
  withdrawalHasher.inputs[2] <== withdrawalTimestamp;

  // Verify that withdrawal commitment exists in the tree
  component withdrawalTree = MerkleTree(levels);
  withdrawalTree.leaf <== withdrawalHasher.out;
  withdrawalTree.pathIndices <== withdrawalPathIndices;
  for (var i = 0; i < levels; i++) {
    withdrawalTree.pathElements[i] <== withdrawalPathElements[i];
  }
  withdrawalTree.root === withdrawalRoot;

  // Compute reward nullifier
  component rewardNullifierHasher = Poseidon(1);
  rewardNullifierHasher.inputs[0] <== noteNullifier;
  rewardNullifierHasher.out === rewardNullifier;

  // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
  // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
  // Squares are used to prevent optimizer from removing those constraints
  signal extDataHashSquare;
  extDataHashSquare <== extDataHash * extDataHash;
}
