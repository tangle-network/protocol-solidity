source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./solidity-fixtures/solidity-fixtures/vanchor_forest_2/2 vanchor_forest_2_2 ./artifacts/circuits/vanchor_forest_2
move_verifiers_and_metadata_vanchor ./solidity-fixtures/solidity-fixtures/vanchor_forest_2/2 2 vanchor_forest_2 2

compile_phase2 ./solidity-fixtures/solidity-fixtures/vanchor_forest_16/2 vanchor_forest_16_2 ./artifacts/circuits/vanchor_forest_16
move_verifiers_and_metadata_vanchor ./solidity-fixtures/solidity-fixtures/vanchor_forest_16/2 2 vanchor_forest_16 16
