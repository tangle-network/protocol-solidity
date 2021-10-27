import { ethers } from 'ethers';
import Anchor from '../../lib/bridge/Anchor';

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

let provider = new ethers.providers.JsonRpcProvider(`http://localhost:8545`);

const wallet = new ethers.Wallet("c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e", provider);

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

  // deploy WEBB gov token first and then add to anchor
  const WebbFactory = new WEBB__factory(wallet);
  const WEBB = await WebbFactory.deploy('Webb Governance Token', 'WEBB');
  await WEBB.deployed();
  await WEBB.mint(wallet.address, '1000000000000000000000000', {
    gasLimit: '0x5B8D80',
  });

  // deploy the Hasher
  const hasherFactory = await getHasherFactory(wallet);
  let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
  await hasherInstance.deployed();

  const verifierFactory = await getVerifierFactory(wallet);
  let verifierInstance = await verifierFactory.deploy({ gasLimit: '0x5B8D80' });
  await verifierInstance.deployed();

  const webbAnchor = await Anchor.createAnchor(
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

  let tx = await WEBB.approve(webbAnchor.contract.address, "1000000000000000000000000000");
  await tx.wait();

  console.log('Anchor Created');
  const { deposit, index } = await webbAnchor.deposit();

  console.log('Deposit done');
  await webbAnchor.withdraw(deposit, index, "0x0000000000000000000000000000000000000000", '0', BigInt(0));
  console.log('done');

}

run();

