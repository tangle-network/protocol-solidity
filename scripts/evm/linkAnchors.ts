require('dotenv').config();
import { ethers } from 'ethers';

import { WEBB__factory } from '../../typechain/factories/WEBB__factory';
import { WEBBAnchor2__factory } from '../../typechain/factories/WEBBAnchor2__factory';
import { Bridge__factory } from '../../typechain/factories/Bridge__factory';
const helpers = require('../../test/helpers');

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function getAllContracts(originWallet: any, destWallet: any) {
  return {
    chain1Anchor: WEBBAnchor2__factory.connect(process.env.CHAIN_1_WEBBAnchor!, originWallet.provider),
    chain1WebbToken: WEBB__factory.connect(process.env.CHAIN_1_WEBB!, originWallet.provider),
    chain1Bridge: Bridge__factory.connect(process.env.CHAIN_1_Bridge!, originWallet.provider),
    chain2Anchor: WEBBAnchor2__factory.connect(process.env.CHAIN_2_WEBBAnchor!, destWallet.provider),
    chain2WebbToken: WEBB__factory.connect(process.env.CHAIN_2_WEBB!, destWallet.provider),
    chain2Bridge: Bridge__factory.connect(process.env.CHAIN_2_Bridge!, destWallet.provider),
  };
}

interface Options {
  originProvider: ethers.providers.Provider;
  originAnchor: ethers.Contract;
  destAnchor: ethers.Contract;
  destBridge: ethers.Contract;
  originWallet: ethers.Wallet;
}

async function proposeAndExecute({
  originProvider,
  originAnchor,
  destAnchor,
  destBridge,
  originWallet,
}: Options) {
  const originChainID = await originWallet.getChainId();
  const originBlockHeight = await originProvider.getBlockNumber();
  const originMerkleRoot = await originAnchor.getLastRoot();
  // create correct update proposal data for the deposit on origin chain
  const updateData = helpers.createUpdateProposalData(originChainID, originBlockHeight, originMerkleRoot);
  const dataHash = ethers.utils.keccak256(destAnchor.address + updateData.substr(2));
  
  const resourceId = helpers.createResourceID(originAnchor.address, originChainID);
  await destBridge.voteProposal(
    originChainID,
    '1',
    resourceId,
    dataHash,
  );

  await destBridge.executeProposal(
    originChainID,
    '1',
    updateData,
    resourceId,
  );
  
  console.log('origin merkle root', originMerkleRoot);
  console.log('destination neighbor roots', await destAnchor.getNeighborRoots());
}

async function run() {
  const chain1Provider = new ethers.providers.JsonRpcProvider(`${process.env.CHAIN_1_ENDPOINT}`);
  const chain2Provider = new ethers.providers.JsonRpcProvider(`${process.env.CHAIN_2_ENDPOINT}`);
  const chain1Wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, chain1Provider);
  const chain2wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, chain2Provider);
  const options = await getAllContracts(chain1Wallet, chain2wallet);
  await proposeAndExecute({
    originProvider: chain1Provider,
    originAnchor: options.chain1Anchor,
    destAnchor: options.chain2Anchor,
    destBridge: options.chain2Bridge,
    originWallet: chain1Wallet,
  });
}

run();
