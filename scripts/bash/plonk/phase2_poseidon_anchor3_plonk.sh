source ./scripts/bash/phase2_circuit_plonk.sh

compile_phase2 ./build/plonk/anchor3 poseidon_anchor_3 ./artifacts/circuits/anchor 18
move_verifiers_and_metadata ./build/plonk/anchor3 3
