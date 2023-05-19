#!/bin/bash

compile () {
    local outdir="$1" circuit="$2" size="$3"
    mkdir -p build/$outdir
    mkdir -p build/$outdir/$size
    mkdir -p artifacts/circuits/$outdir
    echo "circuits/test/$circuit.circom"
    ~/.cargo/bin/circom --r1cs --wasm --sym \
        -o artifacts/circuits/$outdir \
        circuits/test/$circuit.circom
    echo -e "Done!\n"
}

copy_to_fixtures () {
    local outdir="$1" circuit="$2" size="$3" anchorType="$4" 
    mkdir -p packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType
    mkdir -p packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size
    cp artifacts/circuits/$outdir/$circuit.sym packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/$circuit.sym
    cp artifacts/circuits/$outdir/$circuit.r1cs packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/$circuit.r1cs
    cp artifacts/circuits/$outdir/$circuit\_js/$circuit.wasm packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/$circuit.wasm
    cp artifacts/circuits/$outdir/$circuit\_js/witness_calculator.js packages/contracts/solidity-fixtures/solidity-fixtures/$anchorType/$size/witness_calculator.cjs
}

##
# WEBB VANCHORS
##

echo "Compiling Webb style Poseidon vanchor 2 circuit w/ 2 inputs"
compile vanchor_2 poseidon_vanchor_2_2 2
copy_to_fixtures vanchor_2 poseidon_vanchor_2_2 2 vanchor_2

echo "Compiling Webb style Poseidon vanchor 2 circuit w/ 16 inputs"
compile vanchor_16 poseidon_vanchor_16_2 2
copy_to_fixtures vanchor_16 poseidon_vanchor_16_2 2 vanchor_16

echo "Compiling Webb style Poseidon vanchor 8 circuit w/ 2 inputs"
compile vanchor_2 poseidon_vanchor_2_8 8
copy_to_fixtures vanchor_2 poseidon_vanchor_2_8 8 vanchor_2

echo "Compiling Webb style Poseidon vanchor 8 circuit w/ 16 inputs"
compile vanchor_16 poseidon_vanchor_16_8 8
copy_to_fixtures vanchor_16 poseidon_vanchor_16_8 8 vanchor_16

echo "Compiling Poseidon4 test gadget"
compile poseidon4 poseidon4_test 4
copy_to_fixtures poseidon4 poseidon4_test 4 none

