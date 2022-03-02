echo "sourcing"
source ./scripts/bash/plonk/phase2_circuit_plonk.sh

echo "compiling"
compile_phase2 ./build/anchor/5 poseidon_anchor_5 ./artifacts/circuits/anchor
echo "moving files"
move_verifiers_and_metadata ./build/anchor/5 5 anchor
