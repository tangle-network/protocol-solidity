#!/bin/sh

# First remove Foundry contract from `out` artifacts
rm -rf out/Vm.sol/
rm -rf out/Strings.sol/
rm -rf out/Std*.sol/
rm -rf out/*.t.sol/
rm -rf out/Safe*.sol/
rm -rf out/*Math.sol/
rm -rf out/*Test.sol/
rm -rf out/EnumerableSet.sol/
rm -rf out/ECDSA.sol/
rm -rf out/console2.sol/
rm -rf out/Counters.sol/
rm -rf out/Context.sol/
rm -rf out/draft*.sol/

# Then generate typechain artifacts
typechain --target=ethers-v6 --out-dir ./typechain/ ./out/**/*.json