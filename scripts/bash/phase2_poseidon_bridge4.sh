source ./scripts/bash/phase2_circuit_groth16.sh

compile_phase2 ./build/bridge4 poseidon_bridge_4 ./artifacts/circuits/bridge
move_verifiers_and_metadata ./build/bridge4 4