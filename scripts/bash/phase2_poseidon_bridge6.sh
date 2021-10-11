npx snarkjs groth16 setup "./artifacts/circuits/bridge/poseidon_bridge_6.r1cs" ./build/ptau/pot16_final.ptau ./build/bridge6/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute ./build/bridge6/circuit_0000.zkey ./build/bridge6/circuit_0001.zkey --name"1st Contributor name" -v

npx snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_6.r1cs ./build/ptau/pot16_final.ptau ./build/bridge6/circuit_0001.zkey

npx snarkjs zkey beacon ./build/bridge6/circuit_0001.zkey ./build/bridge6/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_6.r1cs ./build/ptau/pot16_final.ptau ./build/bridge6/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/bridge6/circuit_final.zkey ./build/bridge6/verification_key.json  

snarkjs zkey export solidityverifier ./build/bridge6/circuit_final.zkey ./build/bridge6/verifier.sol

npx snarkjs wtns calculate ./artifacts/circuits/bridge/poseidon_bridge_6.wasm ./build/bridge6/input.json ./build/bridge6/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/bridge/poseidon_bridge_6.wasm ./build/bridge6/input.json ./build/bridge6/witness.wtns ./artifacts/circuits/bridge/poseidon_bridge_6.sym --trigger --get --set
