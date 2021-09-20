require('dotenv').config();
import { ethers } from 'ethers';

import { WEBB__factory } from '../../typechain/factories/WEBB__factory';
import { WEBBAnchor2__factory } from '../../typechain/factories/WEBBAnchor2__factory';
import { Bridge__factory } from '../../typechain/factories/Bridge__factory';
import { WEBB } from '../../typechain/WEBB';
import { depositAnchor } from './depositAnchor';
import { AnchorHandler__factory } from '../../typechain/factories/AnchorHandler__factory';
const helpers = require('../../test/helpers');

async function getAllContracts(originWallet: any, destWallet: any) {
  return {
    chain1Anchor: WEBBAnchor2__factory.connect(process.env.CHAIN_1_WEBBAnchor!, originWallet),
    chain1WebbToken: WEBB__factory.connect(process.env.CHAIN_1_WEBB!, originWallet),
    chain1Bridge: Bridge__factory.connect(process.env.CHAIN_1_Bridge!, originWallet),
    chain1AnchorHandler: AnchorHandler__factory.connect(process.env.CHAIN_1_AnchorHandler!, originWallet),
    chain2Anchor: WEBBAnchor2__factory.connect(process.env.CHAIN_2_WEBBAnchor!, destWallet),
    chain2WebbToken: WEBB__factory.connect(process.env.CHAIN_2_WEBB!, destWallet),
    chain2Bridge: Bridge__factory.connect(process.env.CHAIN_2_Bridge!, destWallet),
    chain2AnchorHandler: AnchorHandler__factory.connect(process.env.CHAIN_2_AnchorHandler!, destWallet),
  };
}

interface Options {
  originAnchor: ethers.Contract;
  originToken: ethers.Contract;
  originAnchorHandler: ethers.Contract;
  originWallet: ethers.Wallet;
  destAnchor: ethers.Contract;
  destBridge: ethers.Contract;
  destAnchorHandler: ethers.Contract;
  destWallet: ethers.Wallet;
}

async function depositAndProposeAndExecute({
  originAnchor,
  originToken,
  originAnchorHandler,
  originWallet,
  destAnchor,
  destBridge,
  destAnchorHandler,
  destWallet,
}: Options) {
  let receipt = await depositAnchor(originAnchor.address, originToken.address, originWallet);
  // @ts-ignore
  const data = receipt.events[2].args;
  // @ts-ignore
  const updateNonce = data[1];
  const originBlockHeight = receipt.blockNumber;

  const originChainID = await originWallet.getChainId();
  const originMerkleRoot = await originAnchor.getLastRoot();
  // create correct update proposal data for the deposit on origin chain
  const updateData = helpers.createUpdateProposalData(originChainID, originBlockHeight, originMerkleRoot);
  console.log('Created update data w/ args', originChainID, originBlockHeight, originMerkleRoot, updateData)
  const dataHash = ethers.utils.keccak256(destAnchorHandler.address + updateData.substr(2));
  // create destination resourceID to create proposals to update against
  const destChainId = await destWallet.getChainId();
  const resourceId = helpers.createResourceID(destAnchor.address, destChainId);
  let tx = await destBridge.voteProposal(
    originChainID,
    updateNonce,
    resourceId,
    dataHash,
    { gasLimit: '0x5B8D80' },
  );
  let result = await tx.wait();
  tx = await destBridge.executeProposal(
    originChainID,
    updateNonce,
    updateData,
    resourceId,
    { gasLimit: '0x5B8D80' },
  );
  result = await tx.wait();
  console.log('origin merkle root', originMerkleRoot);
  console.log('destination neighbor roots', await destAnchor.getLatestNeighborRoots());
}

async function run() {
  const chain1Provider = new ethers.providers.JsonRpcProvider(`${process.env.CHAIN_1_ENDPOINT}`);
  const chain2Provider = new ethers.providers.JsonRpcProvider(`${process.env.CHAIN_2_ENDPOINT}`);
  const chain1Wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, chain1Provider);
  const chain2Wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, chain2Provider);
  const options = await getAllContracts(chain1Wallet, chain2Wallet);
  await depositAndProposeAndExecute({
    originAnchor: options.chain1Anchor,
    originToken: options.chain1WebbToken,
    originAnchorHandler: options.chain1AnchorHandler,
    originWallet: chain1Wallet,
    destAnchor: options.chain2Anchor,
    destBridge: options.chain2Bridge,
    destAnchorHandler: options.chain2AnchorHandler,
    destWallet: chain2Wallet,
  });

  await depositAndProposeAndExecute({
    originAnchor: options.chain2Anchor,
    originToken: options.chain2WebbToken,
    originAnchorHandler: options.chain2AnchorHandler,
    originWallet: chain2Wallet,
    destAnchor: options.chain1Anchor,
    destBridge: options.chain1Bridge,
    destAnchorHandler: options.chain1AnchorHandler,
    destWallet: chain1Wallet,
  });
}

run();
