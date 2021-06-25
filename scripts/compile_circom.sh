mkdir -p artifacts
mkdir -p artifacts/circuits

# echo "Compiling Tornado style withdrawal circuit..."
# circom circuits/withdraw.circom \
#   --r1cs artifacts/circuits/withdraw.r1cs \
#   --wasm artifacts/circuits/withdraw.wasm \
#   --sym artifacts/circuits/withdraw.sym
# echo "Done!\n\n"

echo "Compiling Webb style bridge withdrawal circuit..."
circom circuits/bridgeWithdraw.circom \
  --r1cs artifacts/circuits/bridgeWithdraw.r1cs \
  --wasm artifacts/circuits/bridgeWithdraw.wasm \
  --sym artifacts/circuits/bridgeWithdraw.sym
echo "Done!"