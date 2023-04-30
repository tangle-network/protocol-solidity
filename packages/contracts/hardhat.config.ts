import { HardhatUserConfig } from 'hardhat/types';
import 'hardhat-artifactor';
import 'hardhat-gas-reporter';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-truffle5';
import { subtask } from 'hardhat/config';
import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from 'hardhat/builtin-tasks/task-names';
import { HARDHAT_ACCOUNTS } from '@webb-tools/utils';
import poseidonContract from 'circomlibjs/src/poseidon_gencontract.js';

require('dotenv').config({ path: __dirname + '/.env' });

const buildPoseidon = async (numInputs: number) => {
  //@ts-ignore
  await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonContract.createCode(numInputs));
};

/// Overwrite the artifact before generating types
subtask('typechain-generate-types', async (taskArgs, hre, runSuper) => {
  console.log('Overwriting poseidon bytecode');
  await buildPoseidon(1);
  await buildPoseidon(2);
  await buildPoseidon(3);
  await buildPoseidon(5);
  await runSuper();
});

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
