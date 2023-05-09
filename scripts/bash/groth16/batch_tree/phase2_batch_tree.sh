source ./scripts/bash/groth16/phase2_circuit_groth16.sh

move_verifiers_and_metadata_batch_insert () {
    local indir="$1" size="$2" anchorType="$3"
    cp $indir/circuit_final.zkey packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/circuit_final.zkey

    mkdir -p packages/contracts/contracts/verifiers/$anchorType
    cp $indir/verifier.sol packages/contracts/contracts/verifiers/$anchorType/VerifierBatch_"$size".sol
    sed -i 's/contract Verifier/contract VerifierBatch_'$size'/g' packages/contracts/contracts/verifiers/$anchorType/VerifierBatch_"$size".sol
    sed -i 's/pragma solidity ^0.6.11;/pragma solidity ^0.8.18;/g' packages/contracts/contracts/verifiers/$anchorType/VerifierBatch_"$size".sol
}

compile_phase2 packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/4 batchMerkleTreeUpdate_4 ./artifacts/circuits/batch_tree_4
move_verifiers_and_metadata_batch_insert packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/4 4 batch_tree_4 4

compile_phase2 packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/8 batchMerkleTreeUpdate_8 ./artifacts/circuits/batch_tree_8
move_verifiers_and_metadata_batch_insert packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/8 8 batch_tree_8 8

compile_phase2 packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/16 batchMerkleTreeUpdate_16 ./artifacts/circuits/batch_tree_16
move_verifiers_and_metadata_batch_insert packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/16 16 batch_tree_16 16

compile_phase2 packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/32 batchMerkleTreeUpdate_32 ./artifacts/circuits/batch_tree_32
move_verifiers_and_metadata_batch_insert packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/32 32 batch_tree_32 32

# compile_phase2 packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/64 batchMerkleTreeUpdate_64 ./artifacts/circuits/batch_tree_64
# move_verifiers_and_metadata_batch_insert packages/contracts/solidity-fixtures/solidity-fixtures/batch-tree/64 64 batch_tree_64 64

# compile_phase2 ./solidity-fixtures/solidity-fixtures/identity_vanchor_16/2 identity_vanchor_16_2 ./artifacts/circuits/identity_vanchor_16
# move_verifiers_and_metadata_identity_vanchor ./solidity-fixtures/solidity-fixtures/identity_vanchor_16/2 2 identity_vanchor_16 16
