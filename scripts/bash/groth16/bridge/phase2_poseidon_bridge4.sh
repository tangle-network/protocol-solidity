source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/bridge/4 poseidon_bridge_4 ./artifacts/circuits/bridge
move_verifiers_and_metadata ./build/bridge/4 4 bridge