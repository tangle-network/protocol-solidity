npx snarkjs zkey verify ./artifacts/circuits/poseidon_preimage.r1cs ./build/ptau/pot12_final.ptau ./build/poseidonPreimage/circuit_0001.zkey

npx snarkjs zkey beacon ./build/poseidonPreimage/circuit_0001.zkey ./build/poseidonPreimage/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

npx snarkjs zkey verify ./artifacts/circuits/poseidon_preimage.r1cs ./build/ptau/pot12_final.ptau ./build/poseidonPreimage/circuit_final.zkey

npx snarkjs zkey export verificationkey ./build/poseidonPreimage/circuit_final.zkey ./build/poseidonPreimage/verification_key.json  

npx snarkjs wtns calculate ./artifacts/circuits/poseidon_preimage.wasm ./build/poseidonPreimage/input.json ./build/poseidonPreimage/witness.wtns

npx snarkjs wtns debug ./artifacts/circuits/poseidon_preimage.wasm ./build/poseidonPreimage/input.json ./build/poseidonPreimage/witness.wtns ./artifacts/circuits/poseidon_preimage.sym --trigger --get --set
