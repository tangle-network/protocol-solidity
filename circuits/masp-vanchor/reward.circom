pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
/* include "./Utils.circom"; */
/* include "./MerkleTree.circom"; */
/* include "../vanchor/transaction.circom"; */
include "../merkle-tree/manyMerkleProof.circom";
include "../merkle-tree/merkleTree.circom";
include "../vanchor/keypair.circom";
include "../merkle-tree/merkleTreeUpdater.circom";

template Reward(levels, zeroLeaf, length) {
  signal input rate;
  signal input fee;
  signal input rewardNullifier;
  /* signal input extDataHash; */

  signal input noteChainID;
  signal input noteAmount;
  signal input notePrivateKey;
  signal input noteBlinding;
  signal input notePathElements[levels];
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

  // inputs prefixed with output correspond to the anonimity points vanchor
  signal input outputChainID;
  signal input outputAmount;
  signal input outputPrivateKey;
  signal input outputBlinding;
  signal input outputCommitment;
  signal input outputRoot;
  signal input outputPathIndices;
  signal input outputPathElements[levels];

  // inputs prefixed with deposit correspond to the depositMerkleTree
  signal input depositTimestamp;
  signal input depositRoots[length];
  signal input depositPathIndices;
  signal input depositPathElements[levels];

  // inputs prefixed with withdrawal correspond to the withdrawMerkleTree
  signal input withdrawTimestamp;
  signal input withdrawRoots[length];
  signal input withdrawPathIndices;
  signal input withdrawPathElements[levels];

  // Check amount invariant
  signal rewardRate;
  signal rewardAmount;
  rewardRate <== rate * (withdrawTimestamp - depositTimestamp);
  rewardAmount <== rewardRate * noteAmount;

  inputAmount + rewardAmount === outputAmount + fee;
  /* inputAmount + (rate * (withdrawalTimestamp - depositTimestamp)) === outputAmount + fee; */


  // === check input and output accounts and block range ===
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
  blockRangeCheck.in <== withdrawTimestamp - depositTimestamp;

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


  // Update accounts tree with output account commitment
  component accountTreeUpdater = MerkleTreeUpdater(levels, zeroLeaf);
  accountTreeUpdater.oldRoot <== inputRoot;
  accountTreeUpdater.newRoot <== outputRoot;
  accountTreeUpdater.leaf <== outputCommitment;
  accountTreeUpdater.pathIndices <== outputPathIndices;
  for (var i = 0; i < levels; i++) {
      accountTreeUpdater.pathElements[i] <== outputPathElements[i];
  }

  // === check deposit and withdrawal ===
  // Compute tornado.cash commitment and nullifier
  component noteKeypair = Keypair();
  noteKeypair.privateKey <== notePrivateKey;

  component noteHasher = Poseidon(4);
  noteHasher.inputs[0] <== noteChainID;
  noteHasher.inputs[1] <== noteAmount;
  noteHasher.inputs[2] <== noteKeypair.publicKey;
  noteHasher.inputs[3] <== noteBlinding;
  /**/
  component noteSignature = Signature();
  noteSignature.privateKey <== notePrivateKey;
  noteSignature.commitment <== noteHasher.out;
  noteSignature.merklePath <== notePathIndices;

  component noteNullifierHasher = Poseidon(3);
  noteNullifierHasher.inputs[0] <== noteHasher.out;
  noteNullifierHasher.inputs[1] <== notePathIndices;
  noteNullifierHasher.inputs[2] <== noteSignature.out;

  log(00000000000);
  // Compute deposit commitment
  component depositHasher = Poseidon(2);
  depositHasher.inputs[0] <== noteHasher.out;
  depositHasher.inputs[1] <== depositTimestamp;

  // Verify that deposit commitment exists in the tree
  component depositTree = ManyMerkleProof(levels, length);
  depositTree.leaf <== depositHasher.out;
  depositTree.pathIndices <== depositPathIndices;
  for (var i = 0; i < levels; i++) {
    depositTree.pathElements[i] <== depositPathElements[i];
  }

  depositTree.isEnabled <== 1;
  for (var i = 0; i < length; i++) {
      depositTree.roots[i] <== depositRoots[i];
  }

  // Compute withdrawal commitment
  component withdrawHasher = Poseidon(2);
  withdrawHasher.inputs[0] <== noteNullifierHasher.out;
  withdrawHasher.inputs[1] <== withdrawTimestamp;

  // Verify that withdrawal commitment exists in the tree
  component withdrawTree = ManyMerkleProof(levels, length);
  withdrawTree.leaf <== withdrawHasher.out;
  withdrawTree.pathIndices <== withdrawPathIndices;
  for (var i = 0; i < levels; i++) {
    withdrawTree.pathElements[i] <== withdrawPathElements[i];
  }
  withdrawTree.isEnabled <== 1;
  for (var i = 0; i < length; i++) {
      withdrawTree.roots[i] <== withdrawRoots[i];
  }

  // Compute reward nullifier
  component rewardNullifierHasher = Poseidon(1);
  rewardNullifierHasher.inputs[0] <== noteNullifierHasher.out;
  rewardNullifierHasher.out === rewardNullifier;

  // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
  // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
  // Squares are used to prevent optimizer from removing those constraints
  /* signal extDataHashSquare; */
  /* extDataHashSquare <== extDataHash * extDataHash; */
}
