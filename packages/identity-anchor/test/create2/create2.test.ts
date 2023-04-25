const assert = require('assert');
import { ethers } from 'hardhat';
import { HARDHAT_ACCOUNTS } from '../../hardhatAccounts.js';
const TruffleAssert = require('truffle-assertions');

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  ERC20PresetMinterPauser,
} from '@webb-tools/contracts';

import { getChainIdType } from '@webb-tools/utils';
import { Semaphore } from '@webb-tools/semaphore';
import { LinkedGroup } from '@webb-tools/semaphore-group';
import { startGanacheServer } from '@webb-tools/evm-test-utils';
import {
  PoseidonHasher,
  IdentityVAnchor,
  Deployer,
} from '@webb-tools/anchors';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { IdentityVerifier } from '@webb-tools/vbridge';
import { JsonRpcProvider } from 'ethers/types/ethers.js';

const path = require('path');

describe('Should deploy verifiers to the same address', () => {
  let deployer1: Deployer;
  let deployer2: Deployer;
  let token1: ERC20PresetMinterPauser;
  let token2: ERC20PresetMinterPauser;
  let poseidonHasher1: PoseidonHasher;
  let poseidonHasher2: PoseidonHasher;
  let sender: SignerWithAddress;
  const FIRST_CHAIN_ID = 31337;
  const SECOND_CHAIN_ID = 10000;
  let ganacheServer2: any;
  let ganacheProvider2 = new JsonRpcProvider(
    `http://localhost:${SECOND_CHAIN_ID}`
  );
  ganacheProvider2.pollingInterval = 1;
  let ganacheWallet1 = new ethers.Wallet(HARDHAT_ACCOUNTS[1].privateKey, ganacheProvider2);
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
    let hardhatNonce = await wallet.provider.getTransactionCount(wallet.address, 'latest');
    let ganacheNonce = await ganacheWallet1.provider.getTransactionCount(
      ganacheWallet1.address,
      'latest'
    );
    assert(ganacheNonce <= hardhatNonce);
    while (ganacheNonce < hardhatNonce) {
      ganacheWallet1.sendTransaction({
        to: ganacheWallet2.address,
        value: ethers.utils.parseEther('0.0'),
      });
      hardhatNonce = await wallet.provider.getTransactionCount(wallet.address, 'latest');
      ganacheNonce = await ganacheWallet1.provider.getTransactionCount(
        ganacheWallet1.address,
        'latest'
      );
    }
    assert.strictEqual(ganacheNonce, hardhatNonce);
    let b1 = await wallet.provider.getBalance(wallet.address);
    let b2 = await ganacheWallet1.provider.getBalance(ganacheWallet1.address);
    let b3 = await ganacheWallet2.provider.getBalance(ganacheWallet2.address);
    sender = wallet;
  });
  describe('#deploy IdentityVAnchor', () => {
    let identityVerifier1: IdentityVerifier;
    let identityVerifier2: IdentityVerifier;
    let semaphore1: Semaphore;
    let semaphore2: Semaphore;

    it('should deploy verifiers to the same address using different wallets', async () => {
      const salt = '666';
      identityVerifier1 = await IdentityVerifier.create2Verifier(deployer1, salt, sender);
      identityVerifier2 = await IdentityVerifier.create2Verifier(deployer2, salt, ganacheWallet2);
      assert.strictEqual(identityVerifier1.contract.address, identityVerifier2.contract.address);
    });
    it('should deploy Semaphore contract to the same address using different wallets', async () => {
      const salt = '667';
      const saltHex = ethers.utils.id(salt);
      const semaphoreLevels = 20;

      semaphore1 = await Semaphore.create2Semaphore(
        deployer1,
        saltHex,
        semaphoreLevels,
        undefined,
        undefined,
        sender
      );
      semaphore2 = await Semaphore.create2Semaphore(
        deployer2,
        saltHex,
        semaphoreLevels,
        undefined,
        undefined,
        ganacheWallet2
      );
      assert.strictEqual(semaphore1.contract.address, semaphore2.contract.address);
    });
    it('should deploy IdentityVAnchor to the same address using different wallets (but same handler) ((note it needs previous test to have run))', async () => {
      const salt = '42';
      const semaphoreLevels = 20;
      const maxEdges = 1;
      const saltHex = ethers.utils.id(salt);
      const groupId = BigNumber.from(99); // arbitrary
      const defaultRoot = BigInt(
        '21663839004416932945382355908790599225266501822907911457504978515578255421292'
      );
      const group = new LinkedGroup(semaphoreLevels, maxEdges, BigInt(defaultRoot));
      const tx1 = await semaphore1.createGroup(
        groupId.toNumber(),
        semaphoreLevels,
        sender.address,
        maxEdges
      );
      const tx2 = await semaphore2.createGroup(
        groupId.toNumber(),
        semaphoreLevels,
        ganacheWallet2.address,
        maxEdges
      );
      assert.strictEqual(identityVerifier1.contract.address, identityVerifier2.contract.address);
      assert.strictEqual(poseidonHasher1.contract.address, poseidonHasher2.contract.address);
      assert.strictEqual(token1.address, token2.address);
      // same as ganacheWallet1
      const handlerAddr = sender.address;
      const vanchor1 = await IdentityVAnchor.create2IdentityVAnchor(
        deployer1,
        saltHex,
        semaphore1,
        identityVerifier1.contract.address,
        semaphoreLevels,
        poseidonHasher1.contract.address,
        handlerAddr,
        token1.address,
        maxEdges,
        groupId,
        group,
        undefined,
        undefined,
        sender
      );
      const vanchor2 = await IdentityVAnchor.create2IdentityVAnchor(
        deployer2,
        saltHex,
        semaphore2,
        identityVerifier2.contract.address,
        semaphoreLevels,
        poseidonHasher2.contract.address,
        handlerAddr,
        token2.address,
        maxEdges,
        groupId,
        group,
        undefined,
        undefined,
        ganacheWallet2
      );
      assert.strictEqual(vanchor1.contract.address, vanchor2.contract.address);
    });
  });
  after('terminate networks', async () => {
    await ganacheServer2.close();
  });
});
