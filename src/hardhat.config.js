"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("hardhat-artifactor");
require("@typechain/hardhat");
require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-truffle5");
const config_1 = require("hardhat/config");
const task_names_1 = require("hardhat/builtin-tasks/task-names");
const poseidonGenContract = require('circomlibjs/src/poseidon_gencontract.js');
const { overwriteArtifact } = require('hardhat');
const buildPoseidon = async (numInputs) => {
    await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonGenContract.createCode(numInputs));
};
(0, config_1.subtask)(task_names_1.TASK_COMPILE_SOLIDITY_COMPILE_JOBS, 'Compiles the entire project, building all artifacts').setAction(async (taskArgs, { run }, runSuper) => {
    const compileSolOutput = await runSuper(taskArgs);
    await buildPoseidon(2);
    return compileSolOutput;
});
const config = {
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
exports.default = config;
//# sourceMappingURL=hardhat.config.js.map