#!/bin/bash

mkdir -p artifacts/circuits/{anchor,bridge,semaphore}

compile () {
    local outdir="$1" circuit="$2"
    ~/.cargo/bin/circom --r1cs --wasm --sym \
        -o artifacts/circuits/$outdir \
        circuits/test/$circuit.circom
    echo -e "Done!\n"
}

copy_to_fixtures () {
    local outdir="$1" circuit="$2" size="$3"
    cp artifacts/circuits/$outdir/$circuit.sym test/fixtures/$size/$circuit.sym
    cp artifacts/circuits/$outdir/$circuit.r1cs test/fixtures/$size/$circuit.r1cs
    cp artifacts/circuits/$outdir/$circuit_js/$circuit.wasm test/fixtures/$size/$circuit_js/$circuit.wasm
}

###
# TORNADO TORNADOS
###

echo "Compiling Tornado style Poseidon anchor withdrawal circuit..."
compile anchor anchor_withdraw_30

###
# WEBB BRIDGES
###

echo "Compiling Webb style Poseidon bridge 2 withdrawal circuit..."
compile bridge poseidon_bridge_2
copy_to_fixtures bridge poseidon_bridge_2 2

echo "Compiling Webb style Poseidon bridge 3 withdrawal circuit..."
compile bridge poseidon_bridge_3
copy_to_fixtures bridge poseidon_bridge_3 3

echo "Compiling Webb style Poseidon bridge 4 withdrawal circuit..."
compile bridge poseidon_bridge_4
copy_to_fixtures bridge poseidon_bridge_4 4

echo "Compiling Webb style Poseidon bridge 5 withdrawal circuit..."
compile bridge poseidon_bridge_5
copy_to_fixtures bridge poseidon_bridge_5 5

echo "Compiling Webb style Poseidon bridge 6 withdrawal circuit..."
compile bridge poseidon_bridge_6
copy_to_fixtures bridge poseidon_bridge_6 6

###
# POSEIDON PREIMAGES
###

echo "Compiling poseidon preimage circuit..."
compile poseidon_preimage

echo "Compiling poseidon3 preimage circuit..."
compile bridge poseidon_preimage_3

###
# SET MEMBERSHIP
###

echo "Compiling Set membership of length 5 circuit..."
# compile bridge set_membership_5

###
# WEBB SEMPAHORES
###
echo "Compiling Webb style Semaphore bridge 2 withdrawal circuit..."
compile semaphore semaphore_bridge_2
copy_to_fixtures semaphore semaphore_bridge_2 2

