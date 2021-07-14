mkdir -p artifacts
mkdir -p artifacts/circuits
mkdir -p artifacts/circuits/tornado
mkdir -p artifacts/circuits/bridgeMiMC
mkdir -p artifacts/circuits/bridgePoseidon

# echo "Compiling Tornado style withdrawal circuit..."
# circom circuits/withdraw.circom \
#   --r1cs artifacts/circuits/tornado/withdraw.r1cs \
#   --wasm artifacts/circuits/tornado/withdraw.wasm \
#   --sym artifacts/circuits/tornado/withdraw.sym
# echo "Done!\n\n"

echo "Compiling Webb style MiMC bridge withdrawal circuit..."
circom circuits/bridgeMiMC/withdraw.circom \
  --r1cs artifacts/circuits/bridgeMiMC/withdraw.r1cs \
  --wasm artifacts/circuits/bridgeMiMC/withdraw.wasm \
  --sym artifacts/circuits/bridgeMiMC/withdraw.sym
echo "Done!"

echo "Compiling Webb style Poseidon bridge withdrawal circuit..."
circom circuits/bridgePoseidon/withdraw.circom \
  --r1cs artifacts/circuits/bridgePoseidon/withdraw.r1cs \
  --wasm artifacts/circuits/bridgePoseidon/withdraw.wasm \
  --sym artifacts/circuits/bridgePoseidon/withdraw.sym
echo "Done!"