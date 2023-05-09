source ./scripts/bash/groth16/phase2_circuit_groth16.sh

move_verifiers_and_metadata_reward () {
    local indir="$1" size="$2" anchorType="$3"
    cp $indir/circuit_final.zkey packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/circuit_final.zkey

    mkdir -p packages/contracts/contracts/verifiers/$anchorType
    cp $indir/verifier.sol packages/contracts/contracts/verifiers/$anchorType/VerifierReward_"$size".sol
    sed -i 's/contract Verifier/contract VerifierReward_'$size'/g' packages/contracts/contracts/verifiers/$anchorType/VerifierReward_"$size".sol
    sed -i 's/pragma solidity ^0.6.11;/pragma solidity ^0.8.18;/g' packages/contracts/contracts/verifiers/$anchorType/VerifierReward_"$size".sol
}

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/reward_2/30 reward_30_2 ./artifacts/circuits/reward_2
move_verifiers_and_metadata_reward ./packages/contracts/solidity-fixtures/solidity-fixtures/reward_2/30 30 reward_2

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/reward_8/30 reward_30_8 ./artifacts/circuits/reward_8
move_verifiers_and_metadata_reward ./packages/contracts/solidity-fixtures/solidity-fixtures/reward_8/30 30 reward_8