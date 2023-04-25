import { HardhatUserConfig } from 'hardhat/types';
import { HARDHAT_ACCOUNTS } from './hardhatAccounts.js';
import 'hardhat-artifactor';
import 'hardhat-gas-reporter';
import 'hardhat-preprocessor';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-truffle5';
import { subtask } from 'hardhat/config';
import { removeConsoleLog } from 'hardhat-preprocessor';

import { poseidon_gencontract as poseidonContract } from 'circomlibjs';

require('dotenv').config({ path: __dirname + '/.env' });

const buildPoseidon = async (numInputs: number) => {
  //@ts-ignore
  await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonContract.createCode(numInputs));
};

/// Wverwrite the artifact before generating types
subtask('Overwrite Poseidon bytecode', async (taskArgs, hre, runSuper) => {
  await buildPoseidon(1);
  await buildPoseidon(2);
  await buildPoseidon(3);
  await buildPoseidon(5);
  await runSuper();
});

const { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } = require('hardhat/builtin-tasks/task-names');

subtask(TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS).setAction(async (_, __, runSuper) =>
  (await runSuper()).filter((path) => !path.endsWith('.t.sol'))
);

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
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
    timeout: 100000,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: 'USD',
    gasPrice: 21,
  },
  preprocess: {
    eachLine: removeConsoleLog(
      (hre) => hre.network.name !== 'hardhat' && hre.network.name !== 'localhost'
    ),
  },
};

export default config;
