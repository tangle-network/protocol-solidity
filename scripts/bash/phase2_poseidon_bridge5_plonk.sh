source ./scripts/bash/phase2_circuit_plonk.sh

compile_phase2 ./build/plonk/bridge5 poseidon_bridge_5 ./artifacts/circuits/bridge 18
move_verifiers_and_metadata ./build/plonk/bridge5 5

