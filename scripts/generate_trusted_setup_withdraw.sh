# Start a new powers of tau ceremony and make a contribution (enter some random text)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v

# Prapare phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v

# Start a new zkey and make a contribution (enter some random text)
snarkjs zkey new ../artifacts/circuits/withdraw.r1cs pot12_final.ptau circuit_0000.zkey
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="1st Contributor Name" -v

# Export the verification key from circuit_final.zkey
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
