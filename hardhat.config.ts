import { subtask, task } from "hardhat/config";
import { HardhatUserConfig } from 'hardhat/types';
import "hardhat-artifactor";
import '@typechain/hardhat';
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-truffle5";

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    compilers: [{
      version: "0.8.0",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        }
      }
    }],
  },
};

export default config;
