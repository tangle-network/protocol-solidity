source ./scripts/bash/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/anchor/2 poseidon_anchor_2 ./artifacts/circuits/anchor
move_verifiers_and_metadata ./build/anchor/2 2 anchor
