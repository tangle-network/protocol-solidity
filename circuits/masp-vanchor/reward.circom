pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "../../node_modules/circomlib/circuits/comparators.circom";
/* include "./Utils.circom"; */
/* include "./MerkleTree.circom"; */
/* include "../vanchor/transaction.circom"; */
include "../merkle-tree/manyMerkleProof.circom";
include "../vanchor/keypair.circom";
include "../merkle-tree/merkleTreeUpdater.circom";

template Reward(levels, zeroLeaf, length) {
  signal input rate;
  signal input fee;
  signal input rewardNullifier;
  signal input extDataHash;

  signal input noteChainID;
  signal input noteAmount;
  signal input notePrivateKey;
  signal input noteBlinding;
  signal input noteMerkleRoot;
  signal input notePathElements[levels];
  signal input notePathIndices;

  // inputs prefixed with input correspond to the vanchor utxos
  signal input inputChainID;
  signal input inputAmount;
  signal input inputPrivateKey;
  signal input inputBlinding;
  signal input inputNullifier;
  signal input inputRoots[length];
  signal input inputPathElements[levels];
  signal input inputPathIndices;

  // inputs prefixed with output correspond to the anonimity points vanchor
  signal input outputChainID;
  signal input outputAmount;
  signal input outputPrivateKey;
  signal input outputBlinding;
  signal input outputRoot;
  signal input outputPathIndices;
  signal input outputPathElements[levels];
  signal input outputCommitment;

  // inputs prefixed with deposit correspond to the depositMerkleTree
  signal input unspentTimestamp;
  signal input unspentRoots[length];
  /* signal input unspentRoot; */
  signal input unspentPathIndices;
  signal input unspentPathElements[levels];

  // inputs prefixed with withdrawal correspond to the withdrawMerkleTree
  signal input spentTimestamp;
  signal input spentRoots[length];
  /* signal input spentRoot; */
  signal input spentPathIndices;
  signal input spentPathElements[levels];

  // Check amount invariant
  signal rewardRate;
  signal rewardAmount;
  rewardRate <== rate * (spentTimestamp - unspentTimestamp);
  rewardAmount <== rewardRate * inputAmount;

  inputAmount + rewardAmount === outputAmount + fee;
  /* inputAmount + (rate * (withdrawalTimestamp - depositTimestamp)) === outputAmount + fee; */


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
  
  component inputTree = ManyMerkleProof(levels, length);
  inputTree.leaf <== inputHasher.out;
  inputTree.pathIndices <== inputPathIndices;
  
  // add the roots and diffs signals to the bridge circuit
  for (var i = 0; i < length; i++) {
      inputTree.roots[i] <== inputRoots[i];
  }
  
  inputTree.isEnabled <== inputAmount;
  for (var i = 0; i < levels; i++) {
      inputTree.pathElements[i] <== inputPathElements[i];
  }

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
  accountTreeUpdater.oldRoot <== inputRoots[0];
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

  component noteSignature = Signature();
  noteSignature.privateKey <== notePrivateKey;
  noteSignature.commitment <== noteHasher.out;
  noteSignature.merklePath <== notePathIndices;
  
  component inputNullifierHasher = Poseidon(3);
  noteNullifierHasher.inputs[0] <== noteHasher.out;
  noteNullifierHasher.inputs[1] <== notePathIndices;
  noteNullifierHasher.inputs[2] <== noteSignature.out;

  // Compute deposit commitment
  component spentHasher = Poseidon(2);
  spentHasher.inputs[0] <== noteHasher.out;
  spentHasher.inputs[1] <== spentTimestamp;

  // Verify that deposit commitment exists in the tree
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

  // Compute withdrawal commitment
  component unspentHasher = Poseidon(2);
  unspentHasher.inputs[0] <== noteNullifierHasher.out;
  unspentHasher.inputs[1] <== unspentTimestamp;

  // Verify that withdrawal commitment exists in the tree
  component unspentTree = ManyMerkleProof(levels, length);
  unspentTree.leaf <== unspentHasher.out;
  unspentTree.pathIndices <== unspentPathIndices;
  for (var i = 0; i < levels; i++) {
    unspentTree.pathElements[i] <== unspentPathElements[i];
  }
  /* withdrawalTree.root === withdrawalRoot; */
  unspentTree.isEnabled <== 1;
  for (var i = 0; i < length; i++) {
      unspentTree.roots[i] <== unspentRoots[i];
  }

  // Compute reward nullifier
  component rewardNullifierHasher = Poseidon(3);
  rewardNullifierHasher.inputs[0] <== noteNullifierHasher.out;
  rewardNullifierHasher.inputs[1] <== outputPathIndices;
  rewardNullifierHasher.out === rewardNullifier;

  // Add hidden signals to make sure that tampering with recipient or fee will invalidate the snark proof
  // Most likely it is not required, but it's better to stay on the safe side and it only takes 2 constraints
  // Squares are used to prevent optimizer from removing those constraints
  signal extDataHashSquare;
  extDataHashSquare <== extDataHash * extDataHash;
}
