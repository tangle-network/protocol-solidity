source ./scripts/bash/groth16/phase2_circuit_groth16.sh

move_verifiers_and_metadata_batch_insert () {
    local indir="$1" size="$2" anchorType="$3"
    cp $indir/circuit_final.zkey packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/circuit_final.zkey

    mkdir -p packages/contracts/contracts/verifiers/$anchorType
    cp $indir/verifier.sol packages/contracts/contracts/verifiers/$anchorType/VerifierReward_"$size".sol
    sed -i 's/contract Verifier/contract VerifierReward_'$size'/g' packages/contracts/contracts/verifiers/$anchorType/VerifierReward_"$size".sol
    sed -i 's/pragma solidity ^0.6.11;/pragma solidity ^0.8.0;/g' packages/contracts/contracts/verifiers/$anchorType/VerifierReward_"$size".sol
}

compile_phase2 packages/contracts/solidity-fixtures/solidity-fixtures/reward/30 rewardMain ./artifacts/circuits/reward

move_verifiers_and_metadata_batch_insert packages/contracts/solidity-fixtures/solidity-fixtures/reward/30 30 rewardMain

