echo "sourcing"
source ./scripts/bash/plonk/phase2_circuit_plonk.sh

echo "compiling"
compile_phase2 ./build/anchor/4 poseidon_anchor_4 ./artifacts/circuits/anchor 22
echo "moving files"
move_verifiers_and_metadata ./build/anchor/4 4 anchor
