npx snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_2.r1cs ./build/ptau/pot12_final.ptau ./build/poseidonBridge/circuit_0001.zkey

npx snarkjs zkey beacon ./build/poseidonBridge/circuit_0001.zkey ./build/poseidonBridge/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_2.r1cs ./build/ptau/pot12_final.ptau ./build/poseidonBridge/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/poseidonBridge/circuit_final.zkey ./build/poseidonBridge/verification_key.json  

npx snarkjs wtns calculate ./artifacts/circuits/bridge/poseidon_bridge_2.wasm ./build/poseidonBridge/input.json ./build/poseidonBridge/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/bridge/poseidon_bridge_2.wasm ./build/poseidonBridge/input.json ./build/poseidonBridge/witness.wtns ./artifacts/circuits/bridge/poseidon_bridge_2.sym --trigger --get --set
