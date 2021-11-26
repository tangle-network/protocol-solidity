#!/bin/bash

mkdir -p artifacts/circuits/{anchor,bridge,semaphore,vanchor_2,vanchor_16}

compile () {
    local outdir="$1" circuit="$2" size="$3"
    mkdir -p build/$outdir
    mkdir -p build/$outdir/$size
    echo "$circuits/test/$circuit.circom"
    ~/.cargo/bin/circom --r1cs --wasm --sym \
        -o artifacts/circuits/$outdir \
        circuits/test/$circuit.circom
    echo -e "Done!\n"
}

copy_to_fixtures () {
    local outdir="$1" circuit="$2" size="$3" bridgeType="$4" 
    mkdir -p protocol-solidity-fixtures/fixtures/$bridgeType
    mkdir -p protocol-solidity-fixtures/fixtures/$bridgeType/$size
    cp artifacts/circuits/$outdir/$circuit.sym protocol-solidity-fixtures/fixtures/$bridgeType/$size/$circuit.sym
    cp artifacts/circuits/$outdir/$circuit.r1cs protocol-solidity-fixtures/fixtures/$bridgeType/$size/$circuit.r1cs
    cp artifacts/circuits/$outdir/$circuit\_js/$circuit.wasm protocol-solidity-fixtures/fixtures/$bridgeType/$size/$circuit.wasm
    cp artifacts/circuits/$outdir/$circuit\_js/witness_calculator.js protocol-solidity-fixtures/fixtures/$bridgeType/$size/witness_calculator.js
}

# ###
# # TORNADO TORNADOS
# ###

# echo "Compiling Tornado style Poseidon anchor withdrawal circuit..."
# compile anchor anchor_withdraw_30

###
# WEBB BRIDGES
###

echo "Compiling Webb style Poseidon bridge 2 withdrawal circuit..."
compile bridge poseidon_bridge_2 2
copy_to_fixtures bridge poseidon_bridge_2 2 bridge

echo "Compiling Webb style Poseidon bridge 3 withdrawal circuit..."
compile bridge poseidon_bridge_3 3
copy_to_fixtures bridge poseidon_bridge_3 3 bridge

echo "Compiling Webb style Poseidon bridge 4 withdrawal circuit..."
compile bridge poseidon_bridge_4 4
copy_to_fixtures bridge poseidon_bridge_4 4 bridge

echo "Compiling Webb style Poseidon bridge 5 withdrawal circuit..."
compile bridge poseidon_bridge_5 5
copy_to_fixtures bridge poseidon_bridge_5 5 bridge

echo "Compiling Webb style Poseidon bridge 6 withdrawal circuit..."
compile bridge poseidon_bridge_6 6
copy_to_fixtures bridge poseidon_bridge_6 6 bridge

# echo "Compiling Webb style Poseidon bridge 32 withdrawal circuit..."
# compile bridge poseidon_bridge_32 32
# copy_to_fixtures bridge poseidon_bridge_32 32 bridge

# ###
# # WEBB SEMPAHORES
# ###
# echo "Compiling Webb style Semaphore bridge 2 withdrawal circuit..."
# compile semaphore semaphore_bridge_2 2
# copy_to_fixtures semaphore semaphore_bridge_2 2 semaphore

# echo "Compiling Webb style variable Poseidon bridge 2 circuit w/ 2 inputs"
# compile vanchor_2 poseidon_vanchor_2_2 2
# copy_to_fixtures vanchor_2 poseidon_vanchor_2_2 2 vanchor_2

# echo "Compiling Webb style variable Poseidon bridge 2 circuit w/ 16 inputs"
# compile vanchor_16 poseidon_vanchor_16_2 2
# copy_to_fixtures vanchor_16 poseidon_vanchor_16_2 2 vanchor_16

# echo "Compiling Webb style variable Poseidon bridge 8 circuit w/ 2 inputs"
# compile vanchor_2 poseidon_vanchor_2_8 8
# copy_to_fixtures vanchor_2 poseidon_vanchor_2_8 8 vanchor_2

# echo "Compiling Webb style variable Poseidon bridge 8 circuit w/ 16 inputs"
# compile vanchor_16 poseidon_vanchor_16_8 8
# copy_to_fixtures vanchor_16 poseidon_vanchor_16_8 8 vanchor_16

# echo "Compiling Poseidon4 test gadget"
# compile poseidon4 poseidon4_test 4
# copy_to_fixtures poseidon4 poseidon4_test 4 none