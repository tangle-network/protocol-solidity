source ./scripts/bash/phase2_circuit_plonk.sh

compile_phase2 ./build/plonk/anchor2 poseidon_anchor_2 ./artifacts/circuits/anchor 18
move_verifiers_and_metadata ./build/plonk/anchor2 2
