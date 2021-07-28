mkdir -p artifacts
mkdir -p artifacts/circuits
mkdir -p artifacts/circuits/tornado
mkdir -p artifacts/circuits/bridge

echo "Compiling Tornado style Poseidon anchor withdrawal circuit..."
circom circuits/test/anchor_withdraw_30.circom \
  --r1cs artifacts/circuits/anchor/withdraw_30.r1cs \
  --wasm artifacts/circuits/anchor/withdraw_30.wasm \
  --sym artifacts/circuits/anchor/withdraw_30.sym
echo "Done!\n"

echo "Compiling Webb style Poseidon bridge withdrawal circuit..."
circom circuits/test/poseidon_bridge_2.circom \
  --r1cs artifacts/circuits/bridge/poseidon_bridge_2.r1cs \
  --wasm artifacts/circuits/bridge/poseidon_bridge_2.wasm \
  --sym artifacts/circuits/bridge/poseidon_bridge_2.sym
echo "Done!\n"

echo "Compiling poseidon preimage circuit..."
circom circuits/test/poseidon_preimage.circom \
  --r1cs artifacts/circuits/poseidon_preimage.r1cs \
  --wasm artifacts/circuits/poseidon_preimage.wasm \
  --sym artifacts/circuits/poseidon_preimage.sym
echo "Done!\n"

echo "Compiling poseidon3 preimage circuit..."
circom circuits/test/poseidon_preimage_3.circom \
  --r1cs artifacts/circuits/poseidon_preimage_3.r1cs \
  --wasm artifacts/circuits/poseidon_preimage_3.wasm \
  --sym artifacts/circuits/poseidon_preimage_3.sym
echo "Done!"

