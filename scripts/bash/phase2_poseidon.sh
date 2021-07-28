npx snarkjs groth16 setup "./artifacts/circuits/poseidon_preimage.r1cs" ./build/ptau/pot16_final.ptau ./build/poseidon2/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/poseidon2/circuit_0000.zkey ./build/poseidon2/circuit_0001.zkey --name"1st Contributor name" -v

npx snarkjs zkey verify ./artifacts/circuits/poseidon_preimage.r1cs ./build/ptau/pot16_final.ptau ./build/poseidon2/circuit_0001.zkey

npx snarkjs zkey beacon ./build/poseidon2/circuit_0001.zkey ./build/poseidon2/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/poseidon_preimage.r1cs ./build/ptau/pot16_final.ptau ./build/poseidon2/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/poseidon2/circuit_final.zkey ./build/poseidon2/verification_key.json  

npx snarkjs wtns calculate ./artifacts/circuits/poseidon_preimage.wasm ./build/poseidon2/input.json ./build/poseidon2/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/poseidon_preimage.wasm ./build/poseidon2/input.json ./build/poseidon2/witness.wtns ./artifacts/circuits/poseidon_preimage.sym --trigger --get --set
