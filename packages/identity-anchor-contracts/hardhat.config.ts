import { HardhatUserConfig } from 'hardhat/types';
import 'hardhat-artifactor';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-truffle5';
import { subtask } from 'hardhat/config';

import { poseidon_gencontract as poseidonContract } from 'circomlibjs';
import { HARDHAT_ACCOUNTS } from '@webb-tools/utils';

require('dotenv').config({ path: __dirname + '/.env' });

const buildPoseidon = async (numInputs: number) => {
  //@ts-ignore
  await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonContract.createCode(numInputs));
};

/// Overwrite the artifact before generating types
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
        version: '0.8.18',
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
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false,
    dontOverrideCompile: false,
  },
};

export default config;
