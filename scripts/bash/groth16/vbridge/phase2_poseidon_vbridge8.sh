source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/vbridge_2/8 poseidon_vbridge_2_8 ./artifacts/circuits/vbridge_2
move_verifiers_and_metadata_vbridge ./build/vbridge_2/8 8 vbridge_2 2

compile_phase2 ./build/vbridge_16/8 poseidon_vbridge_16_8 ./artifacts/circuits/vbridge_16
move_verifiers_and_metadata_vbridge ./build/vbridge_16/8 8 vbridge_16 16