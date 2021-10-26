source ./scripts/bash/phase2_circuit_groth16.sh

compile_phase2 ./build/bridge3 poseidon_bridge_3 ./artifacts/circuits/bridge
move_verifiers_and_metadata ./build/bridge3 3