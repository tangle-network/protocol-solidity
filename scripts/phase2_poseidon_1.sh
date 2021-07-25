npx snarkjs groth16 setup "./artifacts/circuits/poseidon_preimage.r1cs" ./build/ptau/pot12_final.ptau ./build/poseidonPreimage/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/poseidonPreimage/circuit_0000.zkey ./build/poseidonPreimage/circuit_0001.zkey --name"1st Contributor name" -v
