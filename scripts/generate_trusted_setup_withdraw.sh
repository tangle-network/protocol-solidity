# Start a new powers of tau ceremony and make a contribution (enter some random text)
snarkjs powersoftau new bn128 16 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

# Verify phase 1
snarkjs powersoftau verify pot12_0001.ptau

# Apply random beacon
snarkjs powersoftau beacon pot12_0001.ptau pot12_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"

# Prapare phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Start a new zkey and make a contribution (enter some random text)
snarkjs groth16 setup ./artifacts/circuits/bridge/poseidon_bridge_2.r1cs pot12_final.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_0001.zkey --name="1st Contributor Name" -v

# Verify zkey
snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_2.r1cs pot12_final.ptau circuit_0001.zkey

# Apply random beacon
snarkjs zkey beacon circuit_0001.zkey circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"

# Verify final zkey
snarkjs zkey verify ./artifacts/circuits/bridge/poseidon_bridge_2.r1cs pot12_final.ptau circuit_final.zkey

# Export the verification key from circuit_final.zkey
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json

# Export solidity verifier
snarkjs zkey export solidityverifier circuit_final.zkey verifier.sol