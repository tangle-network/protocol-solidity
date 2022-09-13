source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./solidity-fixtures/solidity-fixtures/identity_vanchor_2/8 identity_vanchor_2_8 ./artifacts/circuits/identity_vanchor_2
move_verifiers_and_metadata_identity_vanchor ./solidity-fixtures/solidity-fixtures/identity_vanchor_2/8 8 identity_vanchor_2 2

compile_phase2 ./solidity-fixtures/solidity-fixtures/identity_vanchor_16/8 identity_vanchor_16_8 ./artifacts/circuits/identity_vanchor_16
move_verifiers_and_metadata_identity_vanchor ./solidity-fixtures/solidity-fixtures/identity_vanchor_16/8 8 identity_vanchor_16 16
