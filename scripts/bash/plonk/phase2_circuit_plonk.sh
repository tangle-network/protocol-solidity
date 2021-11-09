compile_phase2 () {
    local outdir="$1" circuit="$2" pathToCircuitDir="$3" maxPhase1Constraints="$4"
    mkdir -p $1

    echo "Setting up Phase 2 ceremony for $2"
    echo "Outputting circuit_final.zkey and verifier.sol to $1"

    npx snarkjs plonk setup "$3/$2.r1cs" ./build/ptau/pot$4_final.ptau "$1/circuit_final.zkey"
    npx snarkjs zkey export verificationkey "$1/circuit_final.zkey" "$1/verification_key.json"  
    snarkjs zkey export solidityverifier "$1/circuit_final.zkey" $1/verifier.sol
    # npx snarkjs wtns calculate "$3/$2_js/$2.wasm" "$1/input.json" "$1/witness.wtns"
    #npx snarkjs wtns debug "$3/$2_js/$2.wasm" "$1/input.json" "$1/witness.wtns" "$3/$2_js/$2.sym" --trigger --get --set
    echo -e "Done!\n"
}

move_verifiers_and_metadata () {
    local outdir="$1" size="$2"
    cp $1/circuit_final.zkey protocol-solidity-fixtures/fixtures/$2/plonk/circuit_final.zkey
    cp $1/verifier.sol contracts/verifiers/bridge/plonk/"Verifier$2.sol"
}
