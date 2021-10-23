#!/bin/bash

mkdir -p artifacts/circuits/{anchor,bridge,semaphore}

compile () {
    local outdir="$1" circuit="$2"
    ~/.cargo/bin/circom --r1cs --wasm --sym \
        -o artifacts/circuits/$outdir \
        circuits/test/$circuit.circom
    echo -e "Done!\n"
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

echo "Compiling Webb style Poseidon bridge 3 withdrawal circuit..."
compile bridge poseidon_bridge_3

echo "Compiling Webb style Poseidon bridge 4 withdrawal circuit..."
compile bridge poseidon_bridge_4

echo "Compiling Webb style Poseidon bridge 5 withdrawal circuit..."
compile bridge poseidon_bridge_5

echo "Compiling Webb style Poseidon bridge 6 withdrawal circuit..."
compile bridge poseidon_bridge_6

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
compile bridge set_membership_5

###
# WEBB SEMPAHORES
###
echo "Compiling Webb style Semaphore bridge 2 withdrawal circuit..."
compile semaphore semaphore_bridge_2
