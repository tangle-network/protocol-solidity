/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

const path = require('path');
const { toBN } = require('web3-utils');

// Typechain generated bindings for contracts
import {
  ERC20Mock as Token,
  ERC20Mock__factory as TokenFactory,
  PoseidonT3__factory,
} from '../../typechain';

// Convenience wrapper classes for contract classes
import { Verifier } from '../../packages/bridges/src'
import { fetchComponentsFromFilePaths, ZkComponents, getChainIdType } from '../../packages/utils/src';
import { Anchor, AnchorProxy } from '../../packages/anchors/src';
import { toFixedHex, MerkleTree } from '@webb-tools/sdk-core';

const BN = require('bn.js');

describe('AnchorProxy', () => {
  let anchorProxy: AnchorProxy;
  let anchor1: Anchor;
  let anchor2: Anchor;
  let zkComponents: ZkComponents;

  const levels = 30;
  const value = '1000000000000000000' // 1 ether
  let tree: MerkleTree;
  const fee = BigInt((new BN(value).shrn(1)).toString());
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let recipient;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = getChainIdType(31337);
  const MAX_EDGES = 1;
  
  //dummy addresses for anchor proxy tests
  let anchorTreesDummyAddress = "0x2111111111111111111111111111111111111111"
  let governanceDummyAddress = "0x3111111111111111111111111111111111111111"

  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
    );
  })

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    const sender = wallet;
    recipient = signers[2];
    tree = new MerkleTree(levels);

    // create poseidon hasher
    const hasherFactory = new PoseidonT3__factory(sender);
    hasherInstance = await hasherFactory.deploy()

    // create poseidon verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');


    // create Anchor 1
    anchor1 = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      MAX_EDGES,
      zkComponents,
      sender,
    );

    anchor2 = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      token.address,
      sender.address,
      MAX_EDGES,
      zkComponents,
      sender,
    );
    
    const anchorList : Anchor[] = [anchor1, anchor2];

    // create Anchor Proxy
    anchorProxy = await AnchorProxy.createAnchorProxy(
      anchorTreesDummyAddress,
      governanceDummyAddress,
      anchorList,
      sender
    );

    // approve the anchor to spend the minted funds
    await token.approve(anchorProxy.contract.address, '10000000000000000000000');
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const governanceAddress = await anchorProxy.contract.governance()
      assert.strictEqual(governanceAddress.toString(), governanceDummyAddress.toString());
    });
  })

  describe('#deposit', () => {
    it('should emit event, balances should be correct', async () => {
        let { deposit, index } = await anchorProxy.deposit(anchor1.contract.address, chainID);

        const filter = anchorProxy.contract.filters.AnchorProxyDeposit(null, toFixedHex(deposit.commitment), null);
        const events = await anchorProxy.contract.queryFilter(filter, anchorProxy.contract.deployTransaction.blockNumber);

        assert.strictEqual(events[0].event, 'AnchorProxyDeposit');
        assert.strictEqual(events[0].args[1], toFixedHex(deposit.commitment));
        assert.strictEqual(events[0].args[0], anchor1.contract.address);

        const anchor1Balance = await token.balanceOf(anchor1.contract.address);
        assert.strictEqual(anchor1Balance.toString(), toBN(tokenDenomination).toString());
        const zero = 0;
        const anchorProxyBalance = await token.balanceOf(anchorProxy.contract.address);
        assert.strictEqual(anchorProxyBalance.toString(), zero.toString());
        const anchor2Balance = await token.balanceOf(anchor2.contract.address);
        assert.strictEqual(anchor2Balance.toString(), zero.toString());
    });

    it('should throw if there is a such commitment', async () => {
      const commitment = toFixedHex(42)

      await TruffleAssert.passes(anchorProxy.contract.deposit(anchor1.contract.address, commitment, '0x000000'));
      await TruffleAssert.reverts(
        anchorProxy.contract.deposit(anchor1.contract.address, commitment, '0x000000'),
        'The commitment has been submitted'
      );
    });
  })

  describe('#withdraw', () => {
    it('should work', async () => {
      const signers = await ethers.getSigners();
      const sender = signers[0];
      const relayer = signers[1];

      const balanceUserBefore = await token.balanceOf(sender.address);
      const { deposit, index } = await anchorProxy.deposit(anchor1.contract.address, chainID);

      const balanceUserAfterDeposit = await token.balanceOf(sender.address)
      const balanceAnchorAfterDeposit = await token.balanceOf(anchor1.contract.address);
      assert.strictEqual(balanceUserAfterDeposit.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());
      assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());
      const balanceRelayerBefore = await token.balanceOf(relayer.address)
      const balanceReceiverBefore = await token.balanceOf(recipient.address)
      let isSpent = await anchor1.contract.isSpent(toFixedHex(deposit.nullifierHash))
      assert.strictEqual(isSpent, false)
      let receipt = await anchorProxy.withdraw(anchor1.contract.address, deposit, index, recipient.address, relayer.address, fee, toFixedHex(0));
      const balanceAnchorAfter = await token.balanceOf(anchor1.contract.address)
      const balanceRelayerAfter = await token.balanceOf(relayer.address)
      const balanceReceiverAfter = await token.balanceOf(recipient.address)
      const feeBN = toBN(fee.toString())
      assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
      assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
      assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())

      isSpent = await anchor1.contract.isSpent(toFixedHex(deposit.nullifierHash))
      assert(isSpent);
    });  
  })
})
