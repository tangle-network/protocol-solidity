source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/vbridge2 poseidon_vbridge_2_2 ./artifacts/circuits/vbridge
move_verifiers_and_metadata_vbridge ./build/vbridge2 2 vbridge 2