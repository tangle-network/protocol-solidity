npx snarkjs groth16 setup ./artifacts/circuits/semaphore/semaphore_bridge_2.r1cs ./build/ptau/pot16_final.ptau ./artifacts/circuits/semaphore/circuit_0000.zkey

echo "test" | npx snarkjs zkey contribute artifacts/circuits/semaphore/circuit_0000.zkey artifacts/circuits/semaphore/circuit_0001.zkey --name="1st Contributor Name" -v

npx snarkjs zkey verify artifacts/circuits/semaphore/semaphore_bridge_2.r1cs build/ptau/pot16_final.ptau artifacts/circuits/semaphore/circuit_0001.zkey

npx snarkjs zkey beacon artifacts/circuits/semaphore/circuit_0001.zkey artifacts/circuits/semaphore/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify artifacts/circuits/semaphore/semaphore_bridge_2.r1cs build/ptau/pot16_final.ptau artifacts/circuits/semaphore/circuit_final.zkey

#npx snarkjs zkey export verificationkey ./build/sempaphore_bridge_2/circuit_final.zkey ./build/sempaphore_bridge_2/verification_key.json  

snarkjs zkey export solidityverifier artifacts/circuits/semaphore/circuit_final.zkey contracts/verifiers/SemaphoreVerifier.sol

# npx snarkjs wtns calculate ./artifacts/circuits/semaphore/semaphore_bridge_2.wasm ./build/sempaphore_bridge_2/input.json ./build/sempaphore_bridge_2/witness.wtns

# npx snarkjs wtns debug ./artifacts/circuits/semaphore/semaphore_bridge_2.wasm ./build/sempaphore_bridge_2/input.json ./build/sempaphore_bridge_2/witness.wtns artifacts/circuits/semaphore/semaphore_bridge_2.sym --trigger --get --set

