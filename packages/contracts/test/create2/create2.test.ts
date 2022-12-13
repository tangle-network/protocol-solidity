const assert = require('assert');
import { ethers } from 'hardhat';
import { HARDHAT_ACCOUNTS } from '../../hardhatAccounts.js';
const TruffleAssert = require('truffle-assertions');

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  DeterministicDeployFactory as DeterministicDeployFactoryContract,
  DeterministicDeployFactory__factory,
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  VAnchorEncodeInputs__factory,
} from '@webb-tools/contracts';

import {
  getChainIdType,
} from '@webb-tools/utils';
import { startGanacheServer } from '@webb-tools/test-utils';
import { PoseidonHasher, VAnchor } from '@webb-tools/anchors';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { Verifier } from '@webb-tools/vbridge';
import { writeFileSync } from 'fs';

const path = require('path');
const encoder = (types, values) => {
  const abiCoder = ethers.utils.defaultAbiCoder;
  const encodedParams = abiCoder.encode(types, values);
  return encodedParams.slice(2);
};

const create2Address = (factoryAddress, saltHex, initCode) => {
  const create2Addr = ethers.utils.getCreate2Address(factoryAddress, saltHex, ethers.utils.keccak256(initCode));
  return create2Addr;

}



describe('Should deploy verifiers to the same address', () => {
  let deployer: DeterministicDeployFactoryContract;

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
    it('should deploy to the same address', async () => {
      console.log('sender: ', sender)
      console.log('ganache: ', ganacheWallet1)
      const Deployer1 = new DeterministicDeployFactory__factory(sender)
      const deployer1 = await Deployer1.deploy();
      await deployer1.deployed();

      const Deployer2 = new DeterministicDeployFactory__factory(ganacheWallet1)
      const deployer2 = await Deployer2.deploy();
      await deployer2.deployed();
      assert.strictEqual(deployer1.address, deployer2.address)
    })
  })
  describe('#deploy VAnchor', () => {
    let deployer1: DeterministicDeployFactoryContract
    let deployer2: DeterministicDeployFactoryContract
    let poseidonHasher1: PoseidonHasher;
    let poseidonHasher2: PoseidonHasher;

    let token1: ERC20PresetMinterPauser;
    let token2: ERC20PresetMinterPauser;
    before('should setup deployers', async () => {
      const Deployer1 = new DeterministicDeployFactory__factory(sender)
      deployer1 = await Deployer1.deploy();
      await deployer1.deployed();

      const Deployer2 = new DeterministicDeployFactory__factory(ganacheWallet1)
      deployer2 = await Deployer2.deploy();
      await deployer2.deployed();
      assert.strictEqual(deployer1.address, deployer2.address)
    })
    it('should deploy verifiers to the same address using different wallets', async () => {
      const salt = '666'
      verifier1 = await Verifier.create2Verifier(deployer1, salt, sender);
      console.log("Verifier1 deployed to: ", verifier1.contract.address)
      verifier2 = await Verifier.create2Verifier(deployer2, salt, ganacheWallet2);
      console.log("Verifier2 deployed to: ", verifier2.contract.address)
      assert.strictEqual(verifier1.contract.address, verifier2.contract.address)
    })
    it('should deploy poseidonHasher to the same address using different wallets', async () => {
      const salt = '666'
      poseidonHasher1 = await PoseidonHasher.create2PoseidonHasher(deployer1, salt, sender);
      console.log("poseidonHasher1 deployed to: ", poseidonHasher1.contract.address)
      poseidonHasher2 = await PoseidonHasher.create2PoseidonHasher(deployer2, salt, ganacheWallet2);
      console.log("poseidonHasher2 deployed to: ", poseidonHasher2.contract.address)
      assert.strictEqual(poseidonHasher1.contract.address, poseidonHasher2.contract.address)
    })
    it('should deploy ERC20PresetMinterPauser to the same address using different wallets', async () => {
      const salt = '666'
      const saltHex = ethers.utils.id(salt)
      const factory1 = new ERC20PresetMinterPauser__factory(sender)
      const factory1Bytecode = factory1['bytecode']
      const factory1InitCode = factory1Bytecode + encoder(['string', 'string'], ['test token', 'TEST'])
      // const factory1Create2Addr = create2Address(deployer.address, saltHex, factory1InitCode)
      const factory1Tx = await deployer1.deploy(factory1InitCode, saltHex);
      const factory1Receipt = await factory1Tx.wait()
      console.log("factory receipt", factory1Receipt.events)
      token1 = await factory1.attach(factory1Receipt.events[factory1Receipt.events.length - 1].args[0]);
      // poseidonHasher1 = await PoseidonHasher.create2PoseidonHasher(deployer1, salt, sender);
      console.log("tokenFactory1 deployed to: ", token1.address)
      const factory2 = new ERC20PresetMinterPauser__factory(ganacheWallet2)
      const factory2Bytecode = factory2['bytecode']
      const factory2InitCode = factory2Bytecode + encoder(['string', 'string'], ['test token', 'TEST'])
      // const factory1Create2Addr = create2Address(deployer.address, saltHex, factory1InitCode)
      const factory2Tx = await deployer2.deploy(factory2InitCode, saltHex);
      const factory2Receipt = await factory2Tx.wait()
      token2 = await factory2.attach(factory2Receipt.events[factory1Receipt.events.length - 1].args[0]);
      // poseidonHasher2 = await PoseidonHasher.create2PoseidonHasher(deployer2, salt, ganacheWallet2);
      console.log("tokenFactory2 deployed to: ", token2.address)
      assert.strictEqual(token1.address, token2.address)
    })
    it.skip('should deploy VAnchorEncodeInput library to the same address using same handler', async () => {
      const salt = '666'
      const saltHex = ethers.utils.id(salt)
      const encodeLibrary1Factory = new VAnchorEncodeInputs__factory(sender);
      const encodeLibrary1Bytecode = encodeLibrary1Factory['bytecode']
      const encodeLibrary1InitCode = encodeLibrary1Bytecode + encoder([], [])
      const factory1Create2Addr = create2Address(deployer1.address, saltHex, encodeLibrary1InitCode)
      const encodeLibrary1Tx = await deployer1.deploy(encodeLibrary1InitCode, saltHex);
      const encodeLibrary1Receipt = await encodeLibrary1Tx.wait()
      console.log("factory receipt", encodeLibrary1Receipt.events)
      const contract1 = await encodeLibrary1Factory.attach(encodeLibrary1Receipt.events[encodeLibrary1Receipt.events.length - 1].args[0]);
      // poseidonHasher1 = await PoseidonHasher.create2PoseidonHasher(deployer1, salt, sender);
      const encodeLibrary2Factory = new VAnchorEncodeInputs__factory(ganacheWallet2);
      const encodeLibrary2Bytecode = encodeLibrary2Factory['bytecode']
      const encodeLibrary2InitCode = encodeLibrary2Bytecode + encoder([], [])
      const factory2Create2Addr = create2Address(deployer2.address, saltHex, encodeLibrary2InitCode)
      const encodeLibrary2Tx = await deployer2.deploy(encodeLibrary2InitCode, saltHex);
      const encodeLibrary2Receipt = await encodeLibrary2Tx.wait()
      console.log("factory receipt", encodeLibrary2Receipt.events)
      const contract2 = await encodeLibrary1Factory.attach(encodeLibrary1Receipt.events[encodeLibrary1Receipt.events.length - 1].args[0]);
      console.log("tokenFactory2 deployed to: ", contract2.address)
      assert.strictEqual(contract1.address, factory1Create2Addr)
      assert.strictEqual(contract1.address, factory2Create2Addr)
      assert.strictEqual(contract1.address, contract2.address)
    })
    it('should deploy VAnchor to the same address using different wallets (but same handler) ((note it needs previous test to have run))', async () => {
      const salt = '666'
      const levels = 30
      const saltHex = ethers.utils.id(salt)
      assert.strictEqual(verifier1.contract.address, verifier2.contract.address)
      assert.strictEqual(poseidonHasher1.contract.address, poseidonHasher2.contract.address)
      assert.strictEqual(token1.address, token2.address)
      const vanchor1 = await VAnchor.create2VAnchor(deployer1, salt, verifier1.contract.address, levels, poseidonHasher1.contract.address, sender.address, token1.address, 1, undefined, undefined, sender)
      console.log("vanchor1 deployed to: ", vanchor1.contract.address)
      const vanchor2 = await VAnchor.create2VAnchor(deployer2, salt, verifier2.contract.address, levels, poseidonHasher2.contract.address, ganacheWallet1.address, token2.address, 1, undefined, undefined, ganacheWallet2)
      console.log("vanchor2 deployed to: ", vanchor2.contract.address)
      assert.strictEqual(vanchor1.contract.address, vanchor2.contract.address)
      // assert.strictEqual(contract1.address, factory2Create2Addr)
      // assert.strictEqual(contract1.address, contract2.address)
    })
  })
  after('terminate networks', async () => {
    await ganacheServer2.close();
  });
})
