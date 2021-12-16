/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const TruffleAssert = require('truffle-assertions');
 const assert = require('assert');
 import { ethers, network } from 'hardhat';
 
 const snarkjs = require('snarkjs')
 const fs = require('fs');
 const path = require('path');
 
 const ganache = require('ganache-cli');
 
 // Convenience wrapper classes for contract classes
 import {  Anchor } from '@webb-tools/fixed-bridge';
 import { SignatureBridge, BridgeInput } from '../../packages/fixed-bridge/src/SignatureBridge';
 import { MintableToken } from '@webb-tools/tokens';
 import { fetchComponentsFromFilePaths, ZkComponents } from '@webb-tools/utils';
 import { BigNumber } from '@ethersproject/bignumber';
 import { Signer } from 'ethers';
  
 function startGanacheServer(port: number, networkId: number, mnemonic: string) {
   const ganacheServer = ganache.server({
     port: port,
     network_id: networkId,
     _chainId: networkId,
     chainId: networkId,
     _chainIdRpc: networkId,
     mnemonic:
       mnemonic,
   });
 
   ganacheServer.listen(port);
   console.log(`Ganache Started on http://127.0.0.1:${port} ..`);
 
   return ganacheServer;
 }
 
 export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
 
 describe('signature bridge multichain tests for erc20 bridges', () => {
   // setup ganache networks
   let ganacheServer2: any;
   let ganacheServer3: any;
   let ganacheServer4: any;
 
   // setup zero knowledge components
   let zkComponents2: ZkComponents;
   let zkComponents3: ZkComponents;
   let zkComponents4: ZkComponents;
 
   before('setup networks', async () => {
     ganacheServer2 = startGanacheServer(8545, 1337, 'congress island collect purity dentist team gas unlock nuclear pig combine sight');
     ganacheServer3 = startGanacheServer(9999, 9999, 'aspect biology suit thought bottom popular custom rebuild recall sauce endless local');
     ganacheServer4 = startGanacheServer(4444, 4444, 'harvest useful giraffe swim rail ostrich public awful provide amazing tank weapon');
     await sleep(2000);
     
     zkComponents2 = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
     );
     zkComponents3 = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/3/poseidon_bridge_3.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/3/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/3/circuit_final.zkey')
     );
     zkComponents4 = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/4/poseidon_bridge_4.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/4/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/4/circuit_final.zkey')
     );
   });
 
   describe('BridgeConstruction', () => {
     let bridge2WebbEthInput: BridgeInput;
     let bridge3WebbEthInput: BridgeInput;
     let tokenName: string = 'existingERC20';
     let tokenAbbreviation: string = 'EXIST';
     let tokenInstance1: MintableToken;
     let tokenInstance2: MintableToken;
     let tokenInstance3: MintableToken;
 
     let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
     let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
     let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
     let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);
 
     before('construction-tests', async () => {
       const signers = await ethers.getSigners();
 
       // Create a token to test bridge construction support for existing tokens
       tokenInstance1 = await MintableToken.createToken(tokenName, tokenAbbreviation, signers[7]);
       tokenInstance2 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet2);
       tokenInstance3 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet3);
 
       await tokenInstance1.mintTokens(signers[1].address, '100000000000000000000000000');
     });
 
     it.only('create 2 side bridge for one token', async () => {
 
       bridge2WebbEthInput = {
         anchorInputs: {
           asset: {
             31337: [tokenInstance1.contract.address],
             1337: [tokenInstance2.contract.address],
           },
           anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
         },
         chainIDs: [31337, 1337]
       };
       
       const signers = await ethers.getSigners();
 
       const deploymentConfig = {
         31337: signers[1],
         1337: ganacheWallet2,
       };
       const bridge = await SignatureBridge.deployBridge(bridge2WebbEthInput, deploymentConfig, zkComponents2);
 
       // Should be able to retrieve individual anchors
       const chainId1 = 31337;
       const chainId2 = 1337;
       const anchorSize = '1000000000000000000';
       const anchor1: Anchor = bridge.getAnchor(chainId1, anchorSize)!;
       const anchor2: Anchor = bridge.getAnchor(chainId2, anchorSize)!;
 
       // Should be able to retrieve the token address (so we can mint tokens for test scenario)
       const webbTokenAddress = bridge.getWebbTokenAddress(chainId1);
       const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
       const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');
 
       // get the state of anchors before deposit
       const sourceAnchorRootBefore = await anchor1.contract.getLastRoot();
 
       // Deposit on the bridge
       const depositNote = await bridge.deposit(chainId2, anchorSize, signers[2]);
       
       // Check the state of anchors after deposit
       let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
 
       const sourceAnchorRootAfter = await anchor1.contract.getLastRoot();
       const destAnchorEdgeAfter = await anchor2.contract.edgeList(edgeIndex);
 
       // make sure the roots / anchors state have changed
       assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
       assert.deepEqual(ethers.BigNumber.from(0), destAnchorEdgeAfter.latestLeafIndex);
 
       await bridge.withdraw(depositNote, anchorSize, signers[1].address, signers[1].address, ganacheWallet2);
 
       const webbTokenAddress2 = bridge.getWebbTokenAddress(chainId2);
       const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
       const webbTokenBalance2 = await webbToken2.getBalance(signers[1].address);
 
       assert.deepEqual(webbTokenBalance2, ethers.BigNumber.from(anchorSize));
     });
    });
 });