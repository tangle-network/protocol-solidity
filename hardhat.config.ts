import { subtask, task } from "hardhat/config";
import "hardhat-artifactor";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-truffle5";
import "hardhat-circom";


// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

export default {
  solidity: "0.8.0",
  circom: {
    // (optional) Base path for files being read, defaults to `./circuits/`
    inputBasePath: "./circuits/",
    // (optional) Base path for files being output, defaults to `./circuits/`
    outputBasePath: "./artifacts/circuits/",
    // (required) The final ptau file, relative to inputBasePath, from a Phase 1 ceremony
    ptau: "./artifacts/build/bridge-poseidon/pot12_final.ptau",
    // (required) Each object in this array refers to a separate circuit
    circuits: [
      {
        // (required) The name of the circuit
        name: "bridge-poseidon-withdraw",
        // (optional) Input path for circuit file, inferred from `name` if unspecified
        circuit: "bridgePoseidon/withdraw.circom",
        // Used when specifying `--deterministic` instead of the default of all 0s
        beacon: "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      },
    ],
  },
};
