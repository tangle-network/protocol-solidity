compile_phase2 () {
    local outdir="$1" circuit="$2" pathToCircuitDir="$3" maxPhase1Constraints="$4"
    mkdir -p $1

    echo "Setting up Phase 2 ceremony for $2"
    echo "Outputting circuit_final.zkey and verifier.sol to $1"

    npx snarkjs plonk setup "$pathToCircuitDir/$circuit.r1cs" ./protocol-solidity-fixtures/ptau/pot$maxPhase1Constraints\_final.ptau "$outdir/circuit_final.zkey"
    npx snarkjs zkey export verificationkey "$outdir/circuit_final.zkey" "$outdir/verification_key.json"  
    snarkjs zkey export solidityverifier "$outdir/circuit_final.zkey" $outdir/verifier.sol
    # npx snarkjs wtns calculate "$3/$2_js/$2.wasm" "$1/input.json" "$1/witness.wtns"
    #npx snarkjs wtns debug "$3/$2_js/$2.wasm" "$1/input.json" "$1/witness.wtns" "$3/$2_js/$2.sym" --trigger --get --set
    echo -e "Done!\n"
}

move_verifiers_and_metadata () {
    local outdir="$1" size="$2" anchorType="$3"
    if [[ ! -f contracts/verifiers/$anchorType/ ]]; then
        mkdir -p contracts/verifiers/$anchorType
    fi
    cp $outdir/verifier.sol contracts/verifiers/$anchorType/"Verifier$size.sol"
    # sed -i s/'pragma solidity ^0.8.18;'/'pragma solidity ^0.8.18;'/ contracts/verifiers/$anchorType/"Verifier$size.sol"
    sed -i s/"contract PlonkVerifier"/"contract PlonkVerifier$size"/ contracts/verifiers/$anchorType/"Verifier$size.sol"
    sed -i s/"uint16 constant n"/"uint32 constant n"/ contracts/verifiers/$anchorType/"Verifier$size.sol"
}

move_verifiers_and_metadata_vanchor () {
    local indir="$1" size="$2" anchorType="$3" nIns="$4"
    if [[ ! -f contracts/verifiers/$anchorType/ ]]; then
        mkdir -p contracts/verifiers/$anchorType
    fi

    cp $indir/verifier.sol contracts/verifiers/$anchorType/"Verifier$size\_$nIns.sol"
    sed -i s/"contract PlonkVerifier"/"contract Verifier$size\_$nIns"/ contracts/verifiers/$anchorType/"Verifier$size\_$nIns.sol"
    sed -i s/"uint16 constant n"/"uint32 constant n"/ contracts/verifiers/$anchorType/"Verifier$size\_$nIns.sol"

}
