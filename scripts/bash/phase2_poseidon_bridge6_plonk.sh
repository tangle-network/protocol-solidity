source ./scripts/bash/phase2_circuit_plonk.sh

compile_phase2 ./build/plonk/bridge6 poseidon_bridge_6 ./artifacts/circuits/bridge 18
move_verifiers_and_metadata ./build/plonk/bridge6 6