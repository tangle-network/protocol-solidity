source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./protocol-solidity-fixtures/fixtures/identity_vanchor_2/2 identity_vanchor_2_2 ./artifacts/circuits/identity_vanchor_2
move_verifiers_and_metadata_vanchor ./protocol-solidity-fixtures/fixtures/identity_vanchor_2/2 2 identity_vanchor_2 2

compile_phase2 ./protocol-solidity-fixtures/fixtures/identity_vanchor_16/2 identity_vanchor_16_2 ./artifacts/circuits/identity_vanchor_16
move_verifiers_and_metadata_vanchor ./protocol-solidity-fixtures/fixtures/identity_vanchor_16/2 2 identity_vanchor_16 16
