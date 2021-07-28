# Make necessary directories if they don't exist
mkdir -p build/ptau

# Start a new powers of tau ceremony
if [ ! -f build/ptau/pot16_0000.ptau ]; then
    echo "snarkjs powersoftau new bn128 16 build/ptau/pot16_0000.ptau -v\n"
    snarkjs powersoftau new bn128 16 build/ptau/pot16_0000.ptau -v & wait $!
fi

# make a contribution (enter some random text)
if [ ! -f build/ptau/pot16_0001.ptau ]; then
    echo "echo 'test' | snarkjs powersoftau contribute build/ptau/pot16_0000.ptau build/ptau/pot16_0001.ptau --name="First contribution" -v\n"
    echo 'test' | snarkjs powersoftau contribute build/ptau/pot16_0000.ptau build/ptau/pot16_0001.ptau --name="First contribution" -v & wait $!
fi

# Verify phase 1
echo "snarkjs powersoftau verify build/ptau/pot16_0001.ptau\n"
snarkjs powersoftau verify build/ptau/pot16_0001.ptau & wait $!

# Apply random beacon
if [ ! -f build/ptau/pot16_beacon.ptau ]; then
    echo "snarkjs powersoftau beacon build/ptau/pot16_0001.ptau build/ptau/pot16_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"\n"
    snarkjs powersoftau beacon build/ptau/pot16_0001.ptau build/ptau/pot16_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon" & wait $!
fi

# Prapare phase 2
if [ ! -f build/ptau/pot16_final.ptau ]; then
    echo "snarkjs powersoftau prepare phase2 build/ptau/pot16_0001.ptau pot16_final.ptau -v\n"
    snarkjs powersoftau prepare phase2 build/ptau/pot16_0001.ptau build/ptau/pot16_final.ptau -v & wait $!
fi

