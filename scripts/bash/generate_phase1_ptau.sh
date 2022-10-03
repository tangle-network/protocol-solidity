# Make necessary directories if they don't exist
compile_phase1 () {
    # ask for max circuit size
    #   

    echo -n "Enter maximum constraints size (integer between 16 and 28 exclusive)"

    read max_constraints

    if [ $max_constraints -ge 16 ] || [ $max_constraints -le 28 ]; then

        mkdir -p solidity-fixtures/ptau

        # Start a new powers of tau ceremony
        if [ ! -f solidity-fixtures/ptau/pot"$max_constraints"_0000.ptau ]; then
            echo "snarkjs powersoftau new bn128 $max_constraints solidity-fixtures/ptau/pot$max_constraints""_0000.ptau -v\n"
            snarkjs powersoftau new bn128 $max_constraints solidity-fixtures/ptau/pot"$max_constraints"_0000.ptau -v & wait $!
        fi

        # make a contribution (enter some random text)
        if [ ! -f solidity-fixtures/ptau/pot"$max_constraints"_0001.ptau ]; then
            echo "echo 'test' | snarkjs powersoftau contribute solidity-fixtures/ptau/pot$max_constraints""_0000.ptau solidity-fixtures/ptau/pot$max_constraints""_0001.ptau --name="First contribution" -v\n"
            echo 'test' | snarkjs powersoftau contribute solidity-fixtures/ptau/pot"$max_constraints"_0000.ptau solidity-fixtures/ptau/pot"$max_constraints"_0001.ptau --name="First contribution" -v & wait $!
        fi

        # Verify phase 1
        echo "snarkjs powersoftau verify solidity-fixtures/ptau/pot$max_constraints""_0001.ptau\n"
        snarkjs powersoftau verify solidity-fixtures/ptau/pot"$max_constraints"_0001.ptau & wait $!

        # Apply random beacon
        if [ ! -f solidity-fixtures/ptau/pot"$max_constraints"_beacon.ptau ]; then
            echo "snarkjs powersoftau beacon solidity-fixtures/ptau/pot$max_constraints""_0001.ptau solidity-fixtures/ptau/pot$max_constraints""_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon"\n"
            snarkjs powersoftau beacon solidity-fixtures/ptau/pot"$max_constraints"_0001.ptau solidity-fixtures/ptau/pot"$max_constraints"_beacon.ptau 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon" & wait $!
        fi

        # Prapare phase 2
        if [ ! -f solidity-fixtures/ptau/pot"$max_constraints"_final.ptau ]; then
            echo "snarkjs powersoftau prepare phase2 solidity-fixtures/ptau/pot$max_constraints""_0001.ptau pot$max_constraints""_final.ptau -v\n"
            snarkjs powersoftau prepare phase2 solidity-fixtures/ptau/pot"$max_constraints"_0001.ptau solidity-fixtures/ptau/pot"$max_constraints"_final.ptau -v & wait $!
        fi
    fi
}

compile_phase1
