import { HardhatUserConfig } from 'hardhat/types';
import "hardhat-artifactor";
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-truffle5";

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
