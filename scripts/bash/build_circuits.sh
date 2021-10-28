#!/bin/bash

mkdir -p artifacts/circuits/{anchor,bridge,semaphore}

compile () {
    local outdir="$1" circuit="$2"
    mkdir -p $outdir
    ~/.cargo/bin/circom --r1cs --wasm --sym \
        -o artifacts/circuits/$outdir \
        circuits/test/$circuit.circom
    echo -e "Done!\n"
}

copy_to_fixtures () {
    local outdir="$1" circuit="$2" size="$3" bridgeType="$4" 
    cp artifacts/circuits/$outdir/$circuit.sym test/fixtures/$bridgeType/$size/$circuit.sym
    cp artifacts/circuits/$outdir/$circuit.r1cs test/fixtures/$bridgeType/$size/$circuit.r1cs
    cp artifacts/circuits/$outdir/$circuit\_js/$circuit.wasm test/fixtures/$bridgeType/$size/$circuit.wasm
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
compile bridge poseidon_bridge_2
copy_to_fixtures bridge poseidon_bridge_2 2 bridge

echo "Compiling Webb style Poseidon bridge 3 withdrawal circuit..."
compile bridge poseidon_bridge_3
copy_to_fixtures bridge poseidon_bridge_3 3 bridge

echo "Compiling Webb style Poseidon bridge 4 withdrawal circuit..."
compile bridge poseidon_bridge_4
copy_to_fixtures bridge poseidon_bridge_4 4 bridge

echo "Compiling Webb style Poseidon bridge 5 withdrawal circuit..."
compile bridge poseidon_bridge_5
copy_to_fixtures bridge poseidon_bridge_5 5 bridge

echo "Compiling Webb style Poseidon bridge 6 withdrawal circuit..."
compile bridge poseidon_bridge_6
copy_to_fixtures bridge poseidon_bridge_6 6 bridge

# ###
# # WEBB SEMPAHORES
# ###
# echo "Compiling Webb style Semaphore bridge 2 withdrawal circuit..."
# compile semaphore semaphore_bridge_2
# copy_to_fixtures semaphore semaphore_bridge_2 2

# echo "Compiling Webb style variable Poseidon bridge 2 circuit w/ 16 inputs"
# compile vbridge poseidon_vbridge_2_16
# copy_to_fixtures vbridge transaction16 2 vbridge

# echo "Compiling Webb style variable Poseidon bridge 2 circuit w/ 2 inputs"
# compile vbridge poseidon_vbridge_2_2
# copy_to_fixtures vbridge transaction2 2 vbridge