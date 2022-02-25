echo "sourcing"
source ./scripts/bash/plonk/phase2_circuit_plonk.sh

echo "compiling"
compile_phase2 ./build/vanchor_2/2 poseidon_vanchor_2_2 ./artifacts/circuits/vanchor_2 22
echo "moving files"
move_verifiers_and_metadata ./build/vanchor_2/2 2 vanchor_2 2

echo "compiling"
compile_phase2 ./build/vanchor_16/2 poseidon_vanchor_16_2 ./artifacts/circuits/vanchor_16 22
echo "moving files"
move_verifiers_and_metadata ./build/vanchor_16/2 2 vanchor_16 16
