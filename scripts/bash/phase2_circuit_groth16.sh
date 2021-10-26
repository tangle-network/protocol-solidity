compile_phase2 () {
    local outdir="$1" circuit="$2" pathToCircuitDir="$3"
    mkdir -p $1

    echo "Setting up Phase 2 ceremony for $2"
    echo "Outputting circuit_final.zkey and verifier.sol to $1"

    npx snarkjs groth16 setup "$3/$2.r1cs" ./build/ptau/pot16_final.ptau "$1/circuit_0000.zkey"
    echo "test" | npx snarkjs zkey contribute "$1/circuit_0000.zkey" "$1/circuit_0001.zkey" --name"1st Contributor name" -v
    npx snarkjs zkey verify "$3/$2.r1cs" ./build/ptau/pot16_final.ptau "$1/circuit_0001.zkey"
    npx snarkjs zkey beacon "$1/circuit_0001.zkey" "$1/circuit_final.zkey" 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f 10 -n="Final Beacon phase2"
    npx snarkjs zkey verify "$3/$2.r1cs" ./build/ptau/pot16_final.ptau "$1/circuit_final.zkey"
    npx snarkjs zkey export verificationkey "$1/circuit_final.zkey" "$1/verification_key.json"  

    snarkjs zkey export solidityverifier "$1/circuit_final.zkey" $1/verifier.sol
    # npx snarkjs wtns calculate "$3/$2_js/$2.wasm" "$1/input.json" "$1/witness.wtns"
    #npx snarkjs wtns debug "$3/$2_js/$2.wasm" "$1/input.json" "$1/witness.wtns" "$3/$2_js/$2.sym" --trigger --get --set
    echo -e "Done!\n"
}

move_verifiers_and_metadata () {
    local outdir="$1" size="$2"
    cp $1/circuit_final.zkey test/fixtures/$2/circuit_final.zkey
    cp $1/verifier.sol contracts/verifiers/bridge/"Verifier$2.sol"
}