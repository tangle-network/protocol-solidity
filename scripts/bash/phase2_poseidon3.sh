npx snarkjs groth16 setup "./artifacts/circuits/poseidon_preimage_3.r1cs" ./build/ptau/pot16_final.ptau ./build/poseidon3/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/poseidon3/circuit_0000.zkey ./build/poseidon3/circuit_0001.zkey --name"1st Contributor name" -v

npx snarkjs zkey verify ./artifacts/circuits/poseidon_preimage_3.r1cs ./build/ptau/pot16_final.ptau ./build/poseidon3/circuit_0001.zkey

npx snarkjs zkey beacon ./build/poseidon3/circuit_0001.zkey ./build/poseidon3/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/poseidon_preimage_3.r1cs ./build/ptau/pot16_final.ptau ./build/poseidon3/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/poseidon3/circuit_final.zkey ./build/poseidon3/verification_key.json  

npx snarkjs wtns calculate ./artifacts/circuits/poseidon_preimage_3.wasm ./build/poseidon3/input.json ./build/poseidon3/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/poseidon_preimage_3.wasm ./build/poseidon3/input.json ./build/poseidon3/witness.wtns ./artifacts/circuits/poseidon_preimage_3.sym --trigger --get --set
