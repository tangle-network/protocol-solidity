source ./scripts/bash/phase2_circuit_groth16.sh

compile_phase2 ./build/bridge6 poseidon_bridge_6 ./artifacts/circuits/bridge
move_verifiers_and_metadata ./build/bridge6 6