import { HardhatUserConfig } from 'hardhat/types';
import "hardhat-artifactor";
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-truffle5";
import { extendConfig, subtask, task, types } from 'hardhat/config'
import { TASK_CLEAN, TASK_COMPILE, TASK_COMPILE_SOLIDITY_COMPILE_JOBS } from 'hardhat/builtin-tasks/task-names'
const poseidonGenContract = require('circomlibjs/src/poseidon_gencontract.js');
const { overwriteArtifact } = require('hardhat');

const buildPoseidon = async (numInputs: number) => {
  await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonGenContract.createCode(numInputs));
}

subtask(TASK_COMPILE_SOLIDITY_COMPILE_JOBS, 'Compiles the entire project, building all artifacts').setAction(
  async (taskArgs, { run }, runSuper) => {
    const compileSolOutput = await runSuper(taskArgs)
    await buildPoseidon(2);
    return compileSolOutput
  },
)

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
