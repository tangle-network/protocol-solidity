#!/bin/bash

compile () {
    local outdir="$1" circuit="$2" size="$3"
    mkdir -p build/$outdir
    mkdir -p build/$outdir/$size
    echo "circuits/main/$circuit.circom"
    ~/.cargo/bin/circom --r1cs --wasm --sym \
        -o artifacts/circuits/$outdir \
        circuits/main/$circuit.circom
    echo -e "Done!\n"
}

copy_to_fixtures () {
    local outdir="$1" circuit="$2" size="$3" anchorType="$4" 
    mkdir -p solidity-fixtures/solidity-fixtures/$anchorType
    mkdir -p solidity-fixtures/solidity-fixtures/$anchorType/$size
    cp artifacts/circuits/$outdir/$circuit.sym solidity-fixtures/solidity-fixtures/$anchorType/$size/$circuit.sym
    cp artifacts/circuits/$outdir/$circuit.r1cs solidity-fixtures/solidity-fixtures/$anchorType/$size/$circuit.r1cs
    cp artifacts/circuits/$outdir/$circuit\_js/$circuit.wasm solidity-fixtures/solidity-fixtures/$anchorType/$size/$circuit.wasm
    cp artifacts/circuits/$outdir/$circuit\_js/witness_calculator.js solidity-fixtures/solidity-fixtures/$anchorType/$size/witness_calculator.cjs
}

# ###
# # TORNADO TORNADOS
# ###

# echo "Compiling Tornado style Poseidon anchor withdrawal circuit..."
# compile anchor anchor_withdraw_30

###
# WEBB ANCHORS
###

echo "Compiling Webb style Poseidon anchor 2 withdrawal circuit..."
compile anchor poseidon_anchor_2 2
copy_to_fixtures anchor poseidon_anchor_2 2 anchor

echo "Compiling Webb style Poseidon anchor 3 withdrawal circuit..."
compile anchor poseidon_anchor_3 3
copy_to_fixtures anchor poseidon_anchor_3 3 anchor

echo "Compiling Webb style Poseidon anchor 4 withdrawal circuit..."
compile anchor poseidon_anchor_4 4
copy_to_fixtures anchor poseidon_anchor_4 4 anchor

echo "Compiling Webb style Poseidon anchor 5 withdrawal circuit..."
compile anchor poseidon_anchor_5 5
copy_to_fixtures anchor poseidon_anchor_5 5 anchor

echo "Compiling Webb style Poseidon anchor 6 withdrawal circuit..."
compile anchor poseidon_anchor_6 6
copy_to_fixtures anchor poseidon_anchor_6 6 anchor

echo "Compiling Webb style Poseidon anchor 32 withdrawal circuit..."
compile anchor poseidon_anchor_32 32
copy_to_fixtures anchor poseidon_anchor_32 32 anchor

###
# WEBB VANCHORS
###

echo "Compiling Webb style variable Poseidon vanchor 2 circuit w/ 2 inputs"
compile vanchor_2 poseidon_vanchor_2_2 2
copy_to_fixtures vanchor_2 poseidon_vanchor_2_2 2 vanchor_2

echo "Compiling Webb style variable Poseidon vanchor 2 circuit w/ 16 inputs"
compile vanchor_16 poseidon_vanchor_16_2 2
copy_to_fixtures vanchor_16 poseidon_vanchor_16_2 2 vanchor_16

echo "Compiling Webb style variable Poseidon vanchor 8 circuit w/ 2 inputs"
compile vanchor_2 poseidon_vanchor_2_8 8
copy_to_fixtures vanchor_2 poseidon_vanchor_2_8 8 vanchor_2

echo "Compiling Webb style variable Poseidon vanchor 8 circuit w/ 16 inputs"
compile vanchor_16 poseidon_vanchor_16_8 8
copy_to_fixtures vanchor_16 poseidon_vanchor_16_8 8 vanchor_16

# Keypair Circuits

# echo "Compiling Keypair Circuit"
# compile keypair keypair_test 0
# copy_to_fixtures keypair keypair_test 0 none
