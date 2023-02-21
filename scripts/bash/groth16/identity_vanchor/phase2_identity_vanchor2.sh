source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/identity_vanchor_2/2 identity_vanchor_2_2 ./artifacts/circuits/identity_vanchor_2
move_verifiers_and_metadata_identity_vanchor ./packages/contracts/solidity-fixtures/solidity-fixtures/identity_vanchor_2/2 2 identity_vanchor_2 2

# compile_phase2 ./solidity-fixtures/solidity-fixtures/identity_vanchor_16/2 identity_vanchor_16_2 ./artifacts/circuits/identity_vanchor_16
# move_verifiers_and_metadata_identity_vanchor ./solidity-fixtures/solidity-fixtures/identity_vanchor_16/2 2 identity_vanchor_16 16
