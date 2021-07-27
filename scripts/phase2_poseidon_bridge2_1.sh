npx snarkjs groth16 setup "./artifacts/circuits/bridge/poseidon_bridge_2.r1cs" ./build/ptau/pot12_final.ptau ./build/poseidonBridge/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/poseidonBridge/circuit_0000.zkey ./build/poseidonBridge/circuit_0001.zkey --name"1st Contributor name" -v
