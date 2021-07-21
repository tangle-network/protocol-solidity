import { subtask, task } from "hardhat/config";
import "hardhat-artifactor";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-truffle5";
// const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");
// const path = require("path");
// const fs = require('fs')
// const genContractMiMC = require('circomlib/src/mimcsponge_gencontract.js');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

// Whenever we compile solidity, compile the hashers as well
// subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, hre, runSuper) => {
  
//   // compile the hashers into their respective artifacts
//   console.log("Compiling the hashers here with dirname: " + __dirname);

//   const hasherMiMCSponge220path = path.join(__dirname, 'build', 'hashers', 'HasherMiMCSponge220.json')

//   const contract = {
//     contractName: 'HasherMiMCSponge220',
//     abi: genContractMiMC.abi,
//     bytecode: genContractMiMC.createCode('mimcsponge', 220),
//   }

//   fs.writeFileSync(hasherMiMCSponge220path, JSON.stringify(contract));

//   return runSuper();
// })

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

export default {
  solidity: "0.8.0",
};
