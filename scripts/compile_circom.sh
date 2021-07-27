mkdir -p artifacts
mkdir -p artifacts/circuits
mkdir -p artifacts/circuits/tornado
mkdir -p artifacts/circuits/bridge

echo "Compiling Tornado style withdrawal circuit..."
circom circuits/test/tornado_withdraw_30.circom \
  --r1cs artifacts/circuits/tornado/withdraw_30.r1cs \
  --wasm artifacts/circuits/tornado/withdraw_30.wasm \
  --sym artifacts/circuits/tornado/withdraw_30.sym
echo "Done!\n"

echo "Compiling Webb style MiMC bridge withdrawal circuit..."
circom circuits/test/mimc_bridge_2.circom \
  --r1cs artifacts/circuits/bridge/mimc_bridge_2.r1cs \
  --wasm artifacts/circuits/bridge/mimc_bridge_2.wasm \
  --sym artifacts/circuits/bridge/mimc_bridge_2.sym
echo "Done!\n"

echo "Compiling Webb style Poseidon bridge withdrawal circuit..."
circom circuits/test/poseidon_bridge_2.circom \
  --r1cs artifacts/circuits/bridge/poseidon_bridge_2.r1cs \
  --wasm artifacts/circuits/bridge/poseidon_bridge_2.wasm \
  --sym artifacts/circuits/bridge/poseidon_bridge_2.sym
echo "Done!"

echo "Compiling pedersen preimage circuit..."
circom circuits/test/pedersen_preimage.circom \
  --r1cs artifacts/circuits/pedersen_preimage.r1cs \
  --wasm artifacts/circuits/pedersen_preimage.wasm \
  --sym artifacts/circuits/pedersen_preimage.sym
echo "Done!"

echo "Compiling poseidon preimage circuit..."
circom circuits/test/poseidon_preimage.circom \
  --r1cs artifacts/circuits/poseidon_preimage.r1cs \
  --wasm artifacts/circuits/poseidon_preimage.wasm \
  --sym artifacts/circuits/poseidon_preimage.sym
echo "Done!"

