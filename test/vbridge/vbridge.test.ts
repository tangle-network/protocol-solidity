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
 import { getHasherFactory } from '../../lib/bridge/utils';
 import Verifier from '../../lib/bridge/Verifier';
 import MintableToken from '../../lib/bridge/MintableToken';
 
 const { NATIVE_AMOUNT } = process.env
 const snarkjs = require('snarkjs')
 const bigInt = require('big-integer');
 const BN = require('bn.js');
 const F = require('circomlibjs').babyjub.F;
 const Scalar = require("ffjavascript").Scalar;
 
 const helpers = require('../../lib/bridge/utils');
 const MerkleTree = require('../../lib/MerkleTree');
 
 describe('Anchor for 2 max edges', () => {
   let anchor: Anchor;
 
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
 
   beforeEach(async () => {
     const signers = await ethers.getSigners();
     const wallet = signers[0];
     const sender = wallet;
 
     tree = new MerkleTree(levels, null, null);
 
     // create poseidon hasher
     const hasherFactory = await getHasherFactory(wallet);
     hasherInstance = await hasherFactory.deploy();
     await hasherInstance.deployed();
 
     // create poseidon verifier
     verifier = await Verifier.createVerifier(sender);
 
     // create token
     const tokenFactory = new TokenFactory(wallet);
     token = await tokenFactory.deploy();
     await token.deployed();
     await token.mint(sender.address, '10000000000000000000000');
 
     // create Anchor
     anchor = await Anchor.createAnchor(
       verifier.contract.address,
       hasherInstance.address,
       tokenDenomination,
       levels,
       token.address,
       sender.address,
       sender.address,
       sender.address,
       MAX_EDGES,
       sender,
     );
 
     // approve the anchor to spend the minted funds
     await token.approve(anchor.contract.address, '10000000000000000000000');
 
     createWitness = async (data: any) => {
       const witnessCalculator = require("../fixtures/2/witness_calculator.js");
       const fileBuf = require('fs').readFileSync('./test/fixtures/2/poseidon_bridge_2.wasm');
       const wtnsCalc = await witnessCalculator(fileBuf)
       const wtns = await wtnsCalc.calculateWTNSBin(data,0);
       return wtns;
     }
   })
 
   describe('#constructor', () => {
     it('should initialize', async () => {
       const etherDenomination = await anchor.contract.denomination()
       assert.strictEqual(etherDenomination.toString(), toBN(value).toString());
     });
   });
 });