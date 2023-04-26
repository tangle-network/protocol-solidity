source ./scripts/zkp/groth16/phase2_circuit_groth16.sh

compile_phase2 ./build/anchor/3 poseidon_anchor_3 ./artifacts/circuits/anchor
move_verifiers_and_metadata ./build/anchor/3 3 anchor
