npx snarkjs groth16 setup "./artifacts/circuits/bridge/poseidon_bridge_4.r1cs" ./build/ptau/pot16_final.ptau ./build/bridge4/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/bridge4/circuit_0000.zkey ./build/bridge4/circuit_0001.zkey --name"1st Contributor name" -v

npx snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_4.r1cs ./build/ptau/pot16_final.ptau ./build/bridge4/circuit_0001.zkey

npx snarkjs zkey beacon ./build/bridge4/circuit_0001.zkey ./build/bridge4/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_4.r1cs ./build/ptau/pot16_final.ptau ./build/bridge4/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/bridge4/circuit_final.zkey ./build/bridge4/verification_key.json  

snarkjs zkey export solidityverifier ./build/bridge4/circuit_final.zkey ./build/bridge4/verifier.sol

npx snarkjs wtns calculate ./artifacts/circuits/bridge/poseidon_bridge_4.wasm ./build/bridge4/input.json ./build/bridge4/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/bridge/poseidon_bridge_4.wasm ./build/bridge4/input.json ./build/bridge4/witness.wtns ./artifacts/circuits/bridge/poseidon_bridge_4.sym --trigger --get --set
