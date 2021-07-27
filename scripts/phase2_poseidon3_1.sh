npx snarkjs groth16 setup "./artifacts/circuits/poseidon_preimage_3.r1cs" ./build/ptau/pot12_final.ptau ./build/poseidon3Preimage/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/poseidon3Preimage/circuit_0000.zkey ./build/poseidon3Preimage/circuit_0001.zkey --name"1st Contributor name" -v
