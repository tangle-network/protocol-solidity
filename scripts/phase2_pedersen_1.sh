npx snarkjs groth16 setup "./artifacts/circuits/pedersen_preimage.r1cs" ./build/ptau/pot12_final.ptau ./build/pedersenPreimage/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/pedersenPreimage/circuit_0000.zkey ./build/pedersenPreimage/circuit_0001.zkey --name"1st Contributor name" -v
