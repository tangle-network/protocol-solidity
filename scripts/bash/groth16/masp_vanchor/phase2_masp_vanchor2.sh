source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/masp_vanchor_2/2 masp_vanchor_2_2 ./artifacts/circuits/masp_vanchor_2
move_verifiers_and_metadata_masp_vanchor ./packages/contracts/solidity-fixtures/solidity-fixtures/masp_vanchor_2/2 2 masp_vanchor_2 2

compile_phase2 ./packages/contracts/solidity-fixtures/solidity-fixtures/masp_vanchor_16/2 masp_vanchor_16_2 ./artifacts/circuits/masp_vanchor_16
move_verifiers_and_metadata_masp_vanchor ./packages/contracts/solidity-fixtures/solidity-fixtures/masp_vanchor_16/2 2 masp_vanchor_16 16