source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/bridge/5 poseidon_bridge_5 ./artifacts/circuits/bridge
move_verifiers_and_metadata ./build/bridge/5 5 bridge