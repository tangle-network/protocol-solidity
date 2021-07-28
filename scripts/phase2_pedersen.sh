npx snarkjs groth16 setup "./artifacts/circuits/pedersen_preimage.r1cs" ./build/ptau/pot12_final.ptau ./build/pedersenPreimage/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/pedersenPreimage/circuit_0000.zkey ./build/pedersenPreimage/circuit_0001.zkey --name"1st Contributor name" -v

npx snarkjs zkey verify ./artifacts/circuits/pedersen_preimage.r1cs ./build/ptau/pot12_final.ptau ./build/pedersenPreimage/circuit_0001.zkey

npx snarkjs zkey beacon ./build/pedersenPreimage/circuit_0001.zkey ./build/pedersenPreimage/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/pedersen_preimage.r1cs ./build/ptau/pot12_final.ptau ./build/pedersenPreimage/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/pedersenPreimage/circuit_final.zkey ./build/pedersenPreimage/verification_key.json  

npx snarkjs wtns calculate ./artifacts/circuits/pedersen_preimage.wasm ./build/pedersenPreimage/input.json ./build/pedersenPreimage/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/pedersen_preimage.wasm ./build/pedersenPreimage/input.json ./build/pedersenPreimage/witness.wtns ./artifacts/circuits/pedersen_preimage.sym --trigger --get --set
