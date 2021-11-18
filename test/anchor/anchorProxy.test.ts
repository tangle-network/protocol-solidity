/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

 const assert = require('assert');
 import { artifacts, ethers } from 'hardhat';
 const TruffleAssert = require('truffle-assertions');
 
 const fs = require('fs');
 const path = require('path');
 const { toBN, randomHex } = require('web3-utils');
 const Poseidon = artifacts.require('PoseidonT3');
 
 // Typechain generated bindings for contracts
 import {
   ERC20Mock as Token,
   ERC20Mock__factory as TokenFactory,
   GovernedTokenWrapper as WrappedToken,
   GovernedTokenWrapper__factory as WrappedTokenFactory,
 } from '../../typechain';
 
 // Convenience wrapper classes for contract classes
 import Anchor from '../../lib/bridge/Anchor';
 import AnchorProxy from '../../lib/bridge/AnchorProxy';
 import Verifier from '../../lib/bridge/Verifier';
import { ZkComponents } from '../../lib/bridge/types';
import { fetchComponentsFromFilePaths } from '../../lib/bridge/utils';

 const helpers = require('../../lib/bridge/utils');

 const { NATIVE_AMOUNT } = process.env
 const snarkjs = require('snarkjs')
 const bigInt = require('big-integer');
 const BN = require('bn.js');
 const F = require('circomlibjs').babyjub.F;
 const Scalar = require("ffjavascript").Scalar;
 
 
 const MerkleTree = require('../../lib/MerkleTree');

 describe('AnchorProxy', () => {
    let anchorProxy: AnchorProxy;
    let anchor1: Anchor;
    let anchor2: Anchor;
    let zkComponents: ZkComponents;
  
    const levels = 30;
    const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
    let tree: typeof MerkleTree;
    const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
    const refund = BigInt((new BN('0')).toString());
    let recipient = "0x1111111111111111111111111111111111111111";
    let verifier: Verifier;
    let hasherInstance: any;
    let token: Token;
    let wrappedToken: WrappedToken;
    let tokenDenomination = '1000000000000000000' // 1 ether
    const chainID = 31337;
    const MAX_EDGES = 1;
    let createWitness: any;
    
    //dummy addresses for anchor proxy tests
    let anchorTreesDummyAddress = "0x2111111111111111111111111111111111111111"
    let governanceDummyAddress = "0x3111111111111111111111111111111111111111"
  
    before(async () => {
      zkComponents = await fetchComponentsFromFilePaths(
        '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm',
        '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js',
        '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey',
      );
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
  
      tree = new MerkleTree(levels, null, null);
  
      // create poseidon hasher
      hasherInstance = await Poseidon.new();
  
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
        sender.address,
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
        sender.address,
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
  
      createWitness = async (data: any) => {
        const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js");
        const fileBuf = require('fs').readFileSync('./protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm');
        const wtnsCalc = await witnessCalculator(fileBuf)
        const wtns = await wtnsCalc.calculateWTNSBin(data,0);
        return wtns;
      }
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

          const filter = anchorProxy.contract.filters.AnchorProxyDeposit(null, helpers.toFixedHex(deposit.commitment), null);
          const events = await anchorProxy.contract.queryFilter(filter, anchorProxy.contract.deployTransaction.blockNumber);

          assert.strictEqual(events[0].event, 'AnchorProxyDeposit');
          assert.strictEqual(events[0].args[1], helpers.toFixedHex(deposit.commitment));
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
        const commitment = helpers.toFixedHex(42)
  
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
        const balanceReceiverBefore = await token.balanceOf(helpers.toFixedHex(recipient, 20))
  
        let isSpent = await anchor1.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
        assert.strictEqual(isSpent, false)
  
        let receipt = await anchorProxy.withdraw(anchor1.contract.address, deposit, index, recipient, relayer.address, fee, bigInt(0));
  
        const balanceAnchorAfter = await token.balanceOf(anchor1.contract.address)
        const balanceRelayerAfter = await token.balanceOf(relayer.address)
        const balanceReceiverAfter = await token.balanceOf(helpers.toFixedHex(recipient, 20))
        const feeBN = toBN(fee.toString())
        assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
        assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
        assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())
  
        isSpent = await anchor1.contract.isSpent(helpers.toFixedHex(deposit.nullifierHash))
        assert(isSpent);
      });  
    })
 })
