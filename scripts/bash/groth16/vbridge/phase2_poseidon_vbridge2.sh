source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/vbridge_2/2 poseidon_vbridge_2_2 ./artifacts/circuits/vbridge_2
move_verifiers_and_metadata_vbridge ./build/vbridge_2/2 2 vbridge_2 2

compile_phase2 ./build/vbridge_16/2 poseidon_vbridge_16_2 ./artifacts/circuits/vbridge_16
move_verifiers_and_metadata_vbridge ./build/vbridge_16/2 2 vbridge_16 16