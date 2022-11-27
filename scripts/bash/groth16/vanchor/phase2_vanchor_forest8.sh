source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./solidity-fixtures/solidity-fixtures/vanchor_forest_2/8 vanchor_forest_2_8 ./artifacts/circuits/vanchor_forest_2
move_verifiers_and_metadata_vanchor ./solidity-fixtures/solidity-fixtures/vanchor_forest_2/8 8 vanchor_forest_2 2

compile_phase2 ./solidity-fixtures/solidity-fixtures/vanchor_forest_16/8 vanchor_forest_16_8 ./artifacts/circuits/vanchor_forest_16
move_verifiers_and_metadata_vanchor ./solidity-fixtures/solidity-fixtures/vanchor_forest_16/8 8 vanchor_forest_16 16
