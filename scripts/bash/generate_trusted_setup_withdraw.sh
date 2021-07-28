R1CS_PATH=$1
OUTPUT_DIR=$2

# Make necessary directories if they don't exist
mkdir -p build
mkdir -p $OUTPUT_DIR

# Start a new powers of tau ceremony and make a contribution (enter some random text)
if [ ! -f $OUTPUT_DIR/pot16_0000.ptau ]; then
    echo "snarkjs powersoftau new bn128 16 $OUTPUT_DIR/pot16_0000.ptau -v\n"
    snarkjs powersoftau new bn128 16 $OUTPUT_DIR/pot16_0000.ptau -v
    wait 500
fi

if [ ! -f $OUTPUT_DIR/pot16_0001.ptau ]; then
    echo "echo 'test' | snarkjs powersoftau contribute $OUTPUT_DIR/pot16_0000.ptau $OUTPUT_DIR/pot16_0001.ptau --name="First contribution" -v\n"
    echo 'test' | snarkjs powersoftau contribute $OUTPUT_DIR/pot16_0000.ptau $OUTPUT_DIR/pot16_0001.ptau --name="First contribution" -v
    wait 500
fi

# Verify phase 1
echo "snarkjs powersoftau verify $OUTPUT_DIR/pot16_0001.ptau\n"
snarkjs powersoftau verify $OUTPUT_DIR/pot16_0001.ptau
wait 500

# Apply random beacon
if [ ! -f $OUTPUT_DIR/pot16_beacon.ptau ]; then
    echo "snarkjs powersoftau beacon $OUTPUT_DIR/pot16_0001.ptau $OUTPUT_DIR/pot16_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"\n"
    snarkjs powersoftau beacon $OUTPUT_DIR/pot16_0001.ptau $OUTPUT_DIR/pot16_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"
    wait 500
fi

# Prapare phase 2
if [ ! -f $OUTPUT_DIR/pot16_final.ptau ]; then
    echo "snarkjs powersoftau prepare phase2 $OUTPUT_DIR/pot16_0001.ptau pot16_final.ptau -v\n"
    snarkjs powersoftau prepare phase2 $OUTPUT_DIR/pot16_0001.ptau $OUTPUT_DIR/pot16_final.ptau -v
    wait 500
fi

# Start a new zkey and make a contribution (enter some random text)
if [ ! -f $OUTPUT_DIR/circuit_0000.zkey ]; then
    echo "snarkjs groth16 setup "${R1CS_PATH}" $OUTPUT_DIR/pot16_final.ptau $OUTPUT_DIR/circuit_0000.zkey\n"
    snarkjs groth16 setup "${R1CS_PATH}" $OUTPUT_DIR/pot16_final.ptau $OUTPUT_DIR/circuit_0000.zkey
    wait 500
fi

# Contribute to the circuit specific setup
if [ ! -f $OUTPUT_DIR/pot16_0000.ptau ]; then
    echo "echo 'test' | snarkjs zkey contribute $OUTPUT_DIR/circuit_0000.zkey $OUTPUT_DIR/circuit_0001.zkey --name="1st Contributor Name" -v\n"
    echo 'test' | snarkjs zkey contribute $OUTPUT_DIR/circuit_0000.zkey $OUTPUT_DIR/circuit_0001.zkey --name="1st Contributor Name" -v
    wait 500
fi

# Verify zkey
echo "snarkjs zkey verify $R1CS_PATH $OUTPUT_DIR/pot16_final.ptau $OUTPUT_DIR/circuit_0001.zkey\n"
snarkjs zkey verify $R1CS_PATH $OUTPUT_DIR/pot16_final.ptau $OUTPUT_DIR/circuit_0001.zkey
wait 500

# Apply random beacon
if [ ! -f $OUTPUT_DIR/pot16_0000.ptau ]; then
    echo "snarkjs zkey beacon $OUTPUT_DIR/circuit_0001.zkey $OUTPUT_DIR/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"\n"
    snarkjs zkey beacon $OUTPUT_DIR/circuit_0001.zkey $OUTPUT_DIR/circuit_final.zkey 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"
    wait 500
fi

# Verify final zkey
echo "snarkjs zkey verify $R1CS_PATH $OUTPUT_DIR/pot16_final.ptau $OUTPUT_DIR/circuit_final.zkey\n"
snarkjs zkey verify $R1CS_PATH $OUTPUT_DIR/pot16_final.ptau $OUTPUT_DIR/circuit_final.zkey
wait 500

# Export the verification key from circuit_final.zkey
echo "snarkjs zkey export verificationkey $OUTPUT_DIR/circuit_final.zkey $OUTPUT_DIR/verification_key.json\n"
snarkjs zkey export verificationkey $OUTPUT_DIR/circuit_final.zkey $OUTPUT_DIR/verification_key.json
wait 500

# Export solidity verifier
echo "snarkjs zkey export solidityverifier $OUTPUT_DIR/circuit_final.zkey $OUTPUT_DIR/verifier.sol\n"
snarkjs zkey export solidityverifier $OUTPUT_DIR/circuit_final.zkey $OUTPUT_DIR/verifier.sol
wait 500