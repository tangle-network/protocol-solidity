import { HardhatUserConfig } from 'hardhat/types';
import { HARDHAT_ACCOUNTS } from './hardhatAccounts.js';
import 'hardhat-artifactor';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-truffle5';
import '@primitivefi/hardhat-dodoc';
import { subtask } from 'hardhat/config';

import poseidonContract from 'circomlibjs/src/poseidon_gencontract.js';

const buildPoseidon = async (numInputs: number) => {
  //@ts-ignore
  await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonContract.createCode(numInputs));
};

subtask('typechain-generate-types', async (taskArgs, hre, runSuper) => {
  // overwrite the artifact before generating types
  await buildPoseidon(2);
  await buildPoseidon(3);
  await buildPoseidon(5);
  await runSuper();
});

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      accounts: HARDHAT_ACCOUNTS,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.5',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 60000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: 'USD',
    gasPrice: 21,
  },
};

export default config;
