require('dotenv').config();
const helpers = require('../../test/helpers');
import { ethers } from 'ethers';

import { WEBB__factory } from '../../typechain/factories/WEBB__factory';


import { setLinkableAnchorBridge } from './setLinkableAnchorBridge';
import { setLinkableAnchorHandler } from './setLinkableAnchorHandler';
import { depositAnchor } from './depositAnchor';
import { deployWEBBAnchor } from './deployments/deployWebbAnchor';
import { deployWebbBridge } from './deployments/deployWebbBridge';
import { deployAnchorHandler } from './deployments/deployAnchorHandler';
import { setResourceId } from './setResourceId';

const HasherContract = require('./json/PoseidonT3.json');
const VerifierContract = require('./json/VerifierPoseidonBridge.json');

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function getHasherFactory(wallet: ethers.Signer): Promise<ethers.ContractFactory> {
  const hasherContractRaw = {
    contractName: 'PoseidonT3',
    abi: HasherContract.abi,
    bytecode: HasherContract.bytecode,
  };

  const hasherFactory = new ethers.ContractFactory(hasherContractRaw.abi, hasherContractRaw.bytecode, wallet);
  return hasherFactory;
};

async function getVerifierFactory(wallet: ethers.Signer): Promise<ethers.ContractFactory> {
  const VerifierContractRaw = {
    contractName: 'Verifier',
    abi: VerifierContract.abi,
    bytecode: VerifierContract.bytecode,
  };

  const verifierFactory = new ethers.ContractFactory(VerifierContractRaw.abi, VerifierContractRaw.bytecode, wallet);
  return verifierFactory;
};

async function run() {
  const denomination = ethers.BigNumber.from('100000000000000000');
  // WARNING: ENSURE THIS MATCHES CIRCUIT HEIGHT
  const merkleTreeHeight = 30;

  const chainId = await wallet.getChainId();

  // deploy WEBB gov token first and then add to anchor
  const WebbFactory = new WEBB__factory(wallet);
  const WEBB = await WebbFactory.deploy('Webb Governance Token', 'WEBB');
  await WEBB.deployed();
  console.log(`Deployed WEBB: ${WEBB.address}`);
  await WEBB.mint(wallet.address, '1000000000000000000000000', {
    gasLimit: '0x5B8D80',
  });

  // deploy the Hasher
  const hasherFactory = await getHasherFactory(wallet);
  let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
  await hasherInstance.deployed();
  console.log(`Deployed Hasher: ${hasherInstance.address}`);

  const verifierFactory = await getVerifierFactory(wallet);
  let verifierInstance = await verifierFactory.deploy({ gasLimit: '0x5B8D80' });
  await verifierInstance.deployed();
  console.log(`Deployed Verifier: ${verifierInstance.address}`);

  const webbAnchor = await deployWEBBAnchor(
    verifierInstance.address,
    hasherInstance.address,
    denomination,
    merkleTreeHeight,
    WEBB.address,
    wallet.address,
    wallet.address,
    wallet.address,
    wallet
  );

  // transfer ownership of token/minting rights to the anchor
  const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
  const tx = await WEBB.grantRole(MINTER_ROLE, webbAnchor.address);
  await tx.wait();

  // Create the bridge
  const webbBridge = await deployWebbBridge(chainId, [wallet.address], 1, '0', 30, wallet);

  let resourceID = helpers.createResourceID(webbAnchor.address, chainId);

  const handler = await deployAnchorHandler(webbBridge.address, [resourceID], [webbAnchor.address], wallet);

  await setResourceId(webbBridge.address, webbAnchor.address, handler.address, wallet);
  await setLinkableAnchorHandler(webbAnchor.address, handler.address, wallet);
  await setLinkableAnchorBridge(webbAnchor.address, webbBridge.address, wallet);
  await depositAnchor(webbAnchor.address, WEBB.address, wallet);
}

run();
