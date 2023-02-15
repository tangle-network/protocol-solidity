#!/bin/bash

mkdir -p artifacts/circuits/{anchor,anchor,keypair,membership,semaphore,signature,vanchor_2,vanchor_16,poseidon4,identity_vanchor_2,identity_vanchor_16,reward_2,reward_8,swap_2,swap_8}

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

# ###
# # TORNADO TORNADOS
# ###

# echo "Compiling Tornado style Poseidon anchor withdrawal circuit..."
# compile anchor anchor_withdraw_30

###
# WEBB BATCH TREE UPDATER
###

# echo "Compiling batch insertion for 4 leafs (levels=2)"
# compile batch_tree_4 batchMerkleTreeUpdate_4 4
# copy_to_fixtures batch_tree_4 batchMerkleTreeUpdate_4 4 batch-tree

# echo "Compiling batch insertion for 8 leafs (levels=3)"
# compile batch_tree_8 batchMerkleTreeUpdate_8 8
# copy_to_fixtures batch_tree_8 batchMerkleTreeUpdate_8 8 batch-tree

# echo "Compiling batch insertion for 16 leafs (levels=4)"
# compile batch_tree_16 batchMerkleTreeUpdate_16 16
# copy_to_fixtures batch_tree_16 batchMerkleTreeUpdate_16 16 batch-tree

# echo "Compiling batch insertion for 32 leafs (levels=5)"
# compile batch_tree_32 batchMerkleTreeUpdate_32 32
# copy_to_fixtures batch_tree_32 batchMerkleTreeUpdate_32 32 batch-tree

# echo "Compiling batch insertion for 64 leafs (levels=6)"
# compile batch_tree_64 batchMerkleTreeUpdate_64 64
# copy_to_fixtures batch_tree_64 batchMerkleTreeUpdate_64 64 batch-tree

###
# WEBB ANCHORS
###

# echo "Compiling Webb style Poseidon anchor 2 withdrawal circuit..."
# compile anchor poseidon_anchor_2 2
# copy_to_fixtures anchor poseidon_anchor_2 2 anchor
#
# echo "Compiling Webb style Poseidon anchor 3 withdrawal circuit..."
# compile anchor poseidon_anchor_3 3
# copy_to_fixtures anchor poseidon_anchor_3 3 anchor
#
# echo "Compiling Webb style Poseidon anchor 4 withdrawal circuit..."
# compile anchor poseidon_anchor_4 4
# copy_to_fixtures anchor poseidon_anchor_4 4 anchor
#
# echo "Compiling Webb style Poseidon anchor 5 withdrawal circuit..."
# compile anchor poseidon_anchor_5 5
# copy_to_fixtures anchor poseidon_anchor_5 5 anchor
#
# echo "Compiling Webb style Poseidon anchor 6 withdrawal circuit..."
# compile anchor poseidon_anchor_6 6
# copy_to_fixtures anchor poseidon_anchor_6 6 anchor
#
# echo "Compiling Webb style Poseidon anchor 32 withdrawal circuit..."
# compile anchor poseidon_anchor_32 32
# copy_to_fixtures anchor poseidon_anchor_32 32 anchor

# ###
# # WEBB SEMPAHORES
# ###
# echo "Compiling Webb style Semaphore anchor 2 withdrawal circuit..."
# compile semaphore semaphore_anchor_2 2
# copy_to_fixtures semaphore semaphore_anchor_2 2 semaphore

###
# WEBB VANCHORS
###

# echo "Compiling Webb style Poseidon vanchor 2 circuit w/ 2 inputs"
# compile vanchor_2 poseidon_vanchor_2_2 2
# copy_to_fixtures vanchor_2 poseidon_vanchor_2_2 2 vanchor_2
#
# echo "Compiling Webb style Poseidon vanchor 2 circuit w/ 16 inputs"
# compile vanchor_16 poseidon_vanchor_16_2 2
# copy_to_fixtures vanchor_16 poseidon_vanchor_16_2 2 vanchor_16
#
# echo "Compiling Webb style Poseidon vanchor 8 circuit w/ 2 inputs"
# compile vanchor_2 poseidon_vanchor_2_8 8
# copy_to_fixtures vanchor_2 poseidon_vanchor_2_8 8 vanchor_2
#
# echo "Compiling Webb style Poseidon vanchor 8 circuit w/ 16 inputs"
# compile vanchor_16 poseidon_vanchor_16_8 8
# copy_to_fixtures vanchor_16 poseidon_vanchor_16_8 8 vanchor_16

# echo "Compiling Poseidon4 test gadget"
# compile poseidon4 poseidon4_test 4
# copy_to_fixtures poseidon4 poseidon4_test 4 none

###
# WEBB IDENTITY-VANCHORS
###

# echo "Compiling Webb style Poseidon identity-vanchor 2 circuit w/ 2 inputs"
# compile identity_vanchor_2 identity_vanchor_2_2 2
# copy_to_fixtures identity_vanchor_2 identity_vanchor_2_2 2 identity_vanchor_2

# echo "Compiling Webb style Poseidon identity-vanchor 2 circuit w/ 16 inputs"
# compile identity_vanchor_16 identity_vanchor_16_2 2
# copy_to_fixtures identity_vanchor_16 identity_vanchor_16_2 2 identity_vanchor_16

# echo "Compiling Webb style Poseidon identity-vanchor 8 circuit w/ 2 inputs"
# compile identity_vanchor_2 identity_vanchor_2_8 8
# copy_to_fixtures identity_vanchor_2 identity_vanchor_2_8 8 identity_vanchor_2

# echo "Compiling Webb style Poseidon identity-vanchor 8 circuit w/ 16 inputs"
# compile identity_vanchor_16 identity_vanchor_16_8 8
# copy_to_fixtures identity_vanchor_16 identity_vanchor_16_8 8 identity_vanchor_16

###
# WEBB MASP-VANCHORS
###

# echo "Compiling Webb style multi-asset Poseidon vanchor 2 circuit w/ 2 inputs"
# compile masp_vanchor_2 masp_vanchor_2_2 2
# copy_to_fixtures masp_vanchor_2 masp_vanchor_2_2 2 masp_vanchor_2

# echo "Compiling Webb style multi-asset Poseidon vanchor 8 circuit w/ 2 inputs"
# compile masp_vanchor_2 masp_vanchor_2_8 8
# copy_to_fixtures masp_vanchor_2 masp_vanchor_2_8 8 masp_vanchor_2

# echo "Compiling Webb style multi-asset Poseidon vanchor 2 circuit w/ 16 inputs"
# compile masp_vanchor_16 masp_vanchor_16_2 2
# copy_to_fixtures masp_vanchor_16 masp_vanchor_16_2 2 masp_vanchor_16

# echo "Compiling Webb style multi-asset Poseidon vanchor 8 circuit w/ 2 inputs"
# compile masp_vanchor_16 masp_vanchor_16_8 8
# copy_to_fixtures masp_vanchor_16 masp_vanchor_16_8 8 masp_vanchor_16

###
# WEBB MASP-VANCHORS
###

# echo "Compiling Webb style multi-asset vanchor forest 2 circuit w/ 2 inputs"
# compile vanchor_forest_2 vanchor_forest_2_2 2
# copy_to_fixtures vanchor_forest_2 vanchor_forest_2_2 2 vanchor_forest_2

# echo "Compiling Webb style multi-asset vanchor forest 8 circuit w/ 2 inputs"
# compile vanchor_forest_2 vanchor_forest_2_8 8
# copy_to_fixtures vanchor_forest_2 vanchor_forest_2_8 8 vanchor_forest_2
# #
# echo "Compiling Webb style multi-asset vanchor forest 2 circuit w/ 16 inputs"
# compile vanchor_forest_16 vanchor_forest_16_2 2
# copy_to_fixtures vanchor_forest_16 vanchor_forest_16_2 2 vanchor_forest_16 
# #
# echo "Compiling Webb style multi-asset vanchor forest 8 circuit w/ 2 inputs"
# compile vanchor_forest_16 vanchor_forest_16_8 8
# copy_to_fixtures vanchor_forest_16 vanchor_forest_16_8 8 vanchor_forest_16 

# echo "Compiling Poseidon4 test gadget"
# compile poseidon4 poseidon4_test 4
# copy_to_fixtures poseidon4 poseidon4_test 4 none
# Keypair and Signature Circuits

# echo "Compiling Keypair Circuit"
# compile keypair keypair_test 0
# copy_to_fixtures keypair keypair_test 0 none
#
# echo "Compiling Signature Circuit"
# compile signature signature_test
# copy_to_fixtures signature signature_test 0 none

###
# WEBB ANONIMITY MINING REWARD SYSTEM
###

# echo "Compiling anonimity mining circuit"
# compile reward_2 reward_30_2 30
# copy_to_fixtures reward_2 reward_30_2 30 reward_2

# echo "Compiling anonimity mining circuit"
# compile reward_8 reward_30_8 30
# copy_to_fixtures reward_8 reward_30_8 30 reward_8

# ###
# # WEBB MASP SWAP SYSTEM
# ###

echo "Compiling swap circuit 30 2"
compile swap_2 swap_30_2 30
copy_to_fixtures swap_2 swap_30_2 30 swap_2

echo "Compiling swap circuit 30 8"
compile swap_8 swap_30_8 30
copy_to_fixtures swap_8 swap_30_8 30 swap_8