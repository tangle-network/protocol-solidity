const assert = require('assert');
import { ethers } from 'hardhat';
import { HARDHAT_ACCOUNTS } from '../../hardhatAccounts.js';
const TruffleAssert = require('truffle-assertions');

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  DeterministicDeployFactory as DeterministicDeployFactoryContract,
  DeterministicDeployFactory__factory,
} from '@webb-tools/contracts';

import {
  hexToU8a,
  fetchComponentsFromFilePaths,
  getChainIdType,
  ZkComponents,
  u8aToHex,
} from '@webb-tools/utils';
import { startGanacheServer } from '@webb-tools/test-utils';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  Utxo,
  Keypair,
  MerkleTree,
  randomBN,
  toFixedHex,
  generateVariableWitnessInput,
  getVAnchorExtDataHash,
  generateWithdrawProofCallData,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import { VAnchor, PoseidonHasher } from '@webb-tools/anchors';
import { Verifier } from '@webb-tools/vbridge';
import { writeFileSync } from 'fs';

const path = require('path');

describe.only('Should deploy verifiers to the same address', () => {
  let anchor: VAnchor;
  let deployer: DeterministicDeployFactoryContract;

  const levels = 30;
  let fee = BigInt('100000000000000000');
  let recipient = '0x1111111111111111111111111111111111111111';
  let verifier1: Verifier;
  let verifier2: Verifier;
  let sender: SignerWithAddress;
  const FIRST_CHAIN_ID = 31337;
  const SECOND_CHAIN_ID = 10000;
  let ganacheServer2: any;
  let ganacheProvider2 = new ethers.providers.JsonRpcProvider(
    `http://localhost:${SECOND_CHAIN_ID}`
  );
  ganacheProvider2.pollingInterval = 1;
  let ganacheWallet1 = new ethers.Wallet(
    HARDHAT_ACCOUNTS[1].privateKey,
    ganacheProvider2
  );
  let ganacheWallet2 = new ethers.Wallet(
    'c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
    ganacheProvider2
  );
  const chainID1 = getChainIdType(FIRST_CHAIN_ID);
  const chainID2 = getChainIdType(SECOND_CHAIN_ID);

  before('setup networks', async () => {
      ganacheServer2 = await startGanacheServer(SECOND_CHAIN_ID, SECOND_CHAIN_ID, [
        {
          balance: '0x1000000000000000000000',
          secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
        },
        {
          balance: '0x1000000000000000000000',
          secretKey: '0x' + HARDHAT_ACCOUNTS[1].privateKey,
        },
      ]);
      const signers = await ethers.getSigners();
      const wallet = signers[1];
      let b1 = await wallet.provider.getBalance(wallet.address)
      let b2 = await ganacheWallet1.provider.getBalance(ganacheWallet1.address)
      let b3 = await ganacheWallet2.provider.getBalance(ganacheWallet2.address)
      sender = wallet;

   })

  describe('#deploy deployer', () => {
    it.only('should deploy to the same address', async () => {
      const Deployer1 = new DeterministicDeployFactory__factory(sender)
      const deployer1 = await Deployer1.deploy();
      await deployer1.deployed();

      const Deployer2 = new DeterministicDeployFactory__factory(ganacheWallet1)
      const deployer2 = await Deployer2.deploy();
      await deployer2.deployed();
      assert.strictEqual(deployer1.address, deployer2.address)
    })
  })
  describe('#deploy verifier', () => {
    let deployer1: DeterministicDeployFactoryContract
    let deployer2: DeterministicDeployFactoryContract
    before('should setup deployers', async () => {
      const Deployer1 = new DeterministicDeployFactory__factory(sender)
      deployer1 = await Deployer1.deploy();
      await deployer1.deployed();

      const Deployer2 = new DeterministicDeployFactory__factory(ganacheWallet1)
      deployer2 = await Deployer2.deploy();
      await deployer2.deployed();
      assert.strictEqual(deployer1.address, deployer2.address)
    })
    it.only('should deploy verifiers to the same address using different wallets', async () => {
      const salt = '666'
      verifier1 = await Verifier.create2Verifier(deployer1, salt, sender);
      console.log("Verifier1 deployed to: ", verifier1.contract.address)
      verifier2 = await Verifier.create2Verifier(deployer2, salt, ganacheWallet2);
      console.log("Verifier2 deployed to: ", verifier2.contract.address)
      assert.strictEqual(verifier1.contract.address, verifier2.contract.address)
    })
  })
});
