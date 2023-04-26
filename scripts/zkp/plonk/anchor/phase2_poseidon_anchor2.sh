echo "sourcing"
source ./scripts/zkp/plonk/phase2_circuit_plonk.sh

echo "compiling"
compile_phase2 ./build/anchor/2 poseidon_anchor_2 ./artifacts/circuits/anchor
echo "moving files"
move_verifiers_and_metadata ./build/anchor/2 2 anchor
