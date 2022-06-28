import { HardhatUserConfig } from 'hardhat/types';
import { ethers } from 'hardhat';
import "hardhat-artifactor";
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers'
import "@nomiclabs/hardhat-truffle5";
import '@primitivefi/hardhat-dodoc';
import { subtask } from 'hardhat/config'

import poseidonContract from "circomlibjs/src/poseidon_gencontract.js";

const buildPoseidon = async (numInputs: number) => {
  //@ts-ignore
  await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonContract.createCode(numInputs));
}

subtask('typechain-generate-types',
  async (taskArgs, hre, runSuper) => {

    // overwrite the artifact before generating types
    await buildPoseidon(2);
    await runSuper();
  }
)

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      // Specify hardhat account balances for deterministic privateKeys for governor interactions
      accounts:
        [
          {
            privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
            balance: '10000000000000000000000'
          },
          {
            privateKey: '0x0000000000000000000000000000000000000000000000000000000000000002',
            balance: '10000000000000000000000'
          },
          {
            privateKey: '0x0000000000000000000000000000000000000000000000000000000000000003',
            balance: '10000000000000000000000'
          },
          {
            privateKey: '0x0000000000000000000000000000000000000000000000000000000000000004',
            balance: '10000000000000000000000'
          }
        ]
    }
  },
  solidity: {
    compilers: [{
      version: "0.8.5",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        }
      }
    }],
  },
  mocha: {
    timeout: 60000
  },
  // @ts-ignore
  dodoc: {
    include: ["FixedDepositAnchor", "AnchorBase", "LinkableAnchor", "AnchorHandler", "IAnchor", "IAnchorTrees", "ILinkableAnchor", "VAnchorEncodeInputs", "GovernedTokenWrapper", "TokenWrapperHandler", "Hasher", , "MerkleTreePoseidon", "MerkleTreeWithHistoryPoseidon", "Poseidon", "SnarkConstants", "LinkableVAnchor", "VAnchor", "VAnchorBase", "AnchorProxy", "Bridge"]
  },
};

export default config;
