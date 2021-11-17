source ./scripts/bash/phase2_circuit_plonk.sh

compile_phase2 ./build/plonk/bridge2 poseidon_bridge_2 ./artifacts/circuits/bridge 18
move_verifiers_and_metadata ./build/plonk/bridge2 2
