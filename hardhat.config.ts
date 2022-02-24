import { HardhatUserConfig } from 'hardhat/types';
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
  // @ts-ignore
  dodoc: {
  include: ["FixedDepositAnchor", "AnchorBase", "LinkableAnchor", "AnchorHandler", "IAnchor", "IAnchorTrees", "ILinkableAnchor", "VAnchorEncodeInputs", "GovernedTokenWrapper", "TokenWrapperHandler", "Hasher", , "MerkleTreePoseidon", "MerkleTreeWithHistoryPoseidon", "Poseidon", "SnarkConstants", "LinkableVAnchor", "VAnchor", "VAnchorBase", "AnchorProxy", "Bridge"]
  }
};

export default config;
