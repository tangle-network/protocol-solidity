source ./scripts/bash/groth16/phase2_circuit_groth16.sh

move_verifiers_and_metadata_swap () {
    local indir="$1" size="$2" anchorType="$3"
    cp $indir/circuit_final.zkey packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/circuit_final.zkey

    mkdir -p packages/contracts/contracts/verifiers/$anchorType
    cp $indir/verifier.sol packages/contracts/contracts/verifiers/$anchorType/VerifierSwap_"$size".sol
    sed -i 's/contract Verifier/contract VerifierSwap_'$size'/g' packages/contracts/contracts/verifiers/$anchorType/VerifierSwap_"$size".sol
    sed -i 's/pragma solidity ^0.6.11;/pragma solidity ^0.8.18;/g' packages/contracts/contracts/verifiers/$anchorType/VerifierSwap_"$size".sol
}

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/swap_2/20 swap_20_2 ./artifacts/circuits/swap_2
move_verifiers_and_metadata_swap ./packages/contracts/solidity-fixtures/solidity-fixtures/swap_2/20 20 swap_2

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/swap_8/20 swap_20_8 ./artifacts/circuits/swap_8
move_verifiers_and_metadata_swap ./packages/contracts/solidity-fixtures/solidity-fixtures/swap_8/20 20 swap_8