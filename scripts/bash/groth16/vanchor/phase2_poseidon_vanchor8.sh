source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/vanchor_2/8 poseidon_vanchor_2_8 ./artifacts/circuits/vanchor_2
move_verifiers_and_metadata_vanchor ./build/vanchor_2/8 8 vanchor_2 2

compile_phase2 ./build/vanchor_16/8 poseidon_vanchor_16_8 ./artifacts/circuits/vanchor_16
move_verifiers_and_metadata_vanchor ./build/vanchor_16/8 8 vanchor_16 16