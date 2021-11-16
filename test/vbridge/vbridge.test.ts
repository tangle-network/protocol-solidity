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
 import VBridge, { VBridgeInput } from '../../lib/vbridge/VBridge';
 import VAnchor from '../../lib/vbridge/VAnchor';
 import MintableToken from '../../lib/bridge/MintableToken';
 import { toFixedHex } from '../../lib/bridge/utils';
 import { BigNumber } from '@ethersproject/bignumber';
 import { Signer } from '@ethersproject/abstract-signer';
 import { Utxo } from '../../lib/vbridge/utxo';
 //import { GovernedTokenWrapper } from '../../typechain';
 import GovernedTokenWrapper from "../../lib/bridge/GovernedTokenWrapper";
import { TokenWrapper } from '../../typechain';
 
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
 
 describe('multichain tests', () => {
 
   // setup ganache networks
   let ganacheServer2: any;
   let ganacheServer3: any;
   let ganacheServer4: any;
 
   before('setup networks', async () => {
     ganacheServer2 = startGanacheServer(8545, 1337, 'congress island collect purity dentist team gas unlock nuclear pig combine sight');
     ganacheServer3 = startGanacheServer(9999, 9999, 'aspect biology suit thought bottom popular custom rebuild recall sauce endless local');
     ganacheServer4 = startGanacheServer(4444, 4444, 'harvest useful giraffe swim rail ostrich public awful provide amazing tank weapon');
     await sleep(2000);
   });
 
   describe('BridgeConstruction', () => {
 
     let bridge2WebbEthInput: VBridgeInput;
     let bridge3WebbEthInput: VBridgeInput;
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
 
       await tokenInstance1.mintTokens(signers[2].address, '100000000000000000000000000');
     });
 
     it('create 2 side bridge for one token', async () => {
       let webbTokens1 = new Map<number, GovernedTokenWrapper | undefined>();
       webbTokens1.set(31337, null!);
       webbTokens1.set(1337, null!);
       bridge2WebbEthInput = {
         vAnchorInputs: {
           asset: {
             31337: [tokenInstance1.contract.address],
             1337: [tokenInstance2.contract.address],
           }
        },
         chainIDs: [31337, 1337],
         webbTokens: webbTokens1
       };
       
       const signers = await ethers.getSigners();
 
       const deploymentConfig = {
         31337: signers[1],
         1337: ganacheWallet2,
       };
       const vBridge = await VBridge.deployVBridge(bridge2WebbEthInput, deploymentConfig);
 
       // Should be able to retrieve individual anchors
       const chainId1 = 31337;
       const chainId2 = 1337;
       const vAnchor1: VAnchor = vBridge.getVAnchor(chainId1)!;
       const vAnchor2: VAnchor = vBridge.getVAnchor(chainId2)!;
 
       // Should be able to retrieve the token address (so we can mint tokens for test scenario)
       const webbTokenAddress = vBridge.getWebbTokenAddress(chainId1);
       const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
       const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');
 
       // get the state of anchors before deposit
       const sourceAnchorRootBefore = await vAnchor1.contract.getLastRoot();
       //console.log(sourceAnchorRootBefore);

       //Define inputs/outputs for transact function
       const depositUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainId1), chainId: BigNumber.from(chainId1)})

       //Transact on the bridge
       await vBridge.transact([], [depositUtxo], 0, '0', '0', signers[2]); 
       
       // Check the state of anchors after deposit
       let edgeIndex = await vAnchor2.contract.edgeIndex(chainId1);
 
       const sourceAnchorRootAfter = await vAnchor1.contract.getLastRoot();
       const destAnchorEdgeAfter = await vAnchor2.contract.edgeList(edgeIndex);
 
       // make sure the roots / anchors state have changed
       assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
       assert.deepStrictEqual(ethers.BigNumber.from(1), destAnchorEdgeAfter.latestLeafIndex);
 
       const transferUtxo = new Utxo({
        originChainId: BigNumber.from(chainId1),
        amount: BigNumber.from(1e7),
        keypair: depositUtxo.keypair
      });

      await vBridge.transact([depositUtxo], [transferUtxo], 0, '0', '0', signers[2]);
     });
    });

    describe('2 sided bridge existing token use', () => {
 
      // ERC20 compliant contracts that can easily create balances for test
      let existingToken1: MintableToken;
      let existingToken2: MintableToken;
  
      let vBridge: VBridge;
      const chainId1 = 31337;
      const chainId2 = 1337;
      let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
      let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
  
      before(async () => {
        const signers = await ethers.getSigners();
  
        existingToken1 = await MintableToken.createToken('existingERC20', 'EXIST', signers[1]);
        // Use some other signer with provider on other chain
        existingToken2 = await MintableToken.createToken('existingERC20', 'EXIST', ganacheWallet2);
  
        // mint some tokens to the user of the bridge
        await existingToken1.mintTokens(signers[1].address, '100000000000000000000000000');
        await existingToken2.mintTokens(ganacheWallet2.address, '100000000000000000000000000');
      })
  
      beforeEach(async () => {
        const signers = await ethers.getSigners();
        let webbTokens1 = new Map<number, GovernedTokenWrapper | undefined>();
        webbTokens1.set(31337, null!);
        webbTokens1.set(1337, null!);
        // create the config for the bridge
        const vBridgeInput = {
          vAnchorInputs: {
            asset: {
              31337: [existingToken1.contract.address],
              1337: [existingToken2.contract.address],
            }
         },
          chainIDs: [31337, 1337],
          webbTokens: webbTokens1
      }
  
        // setup the config for deployers of contracts (admins)
        const deploymentConfig = {
          [chainId1]: signers[1],
          [chainId2]: ganacheWallet2,
        }
  
        // deploy the bridge
        vBridge = await VBridge.deployVBridge(vBridgeInput, deploymentConfig);
  
        // make one deposit so the  edge exists
        const depositUtxo1 = new Utxo({amount: BigNumber.from(2e7), originChainId: BigNumber.from(chainId1), chainId: BigNumber.from(chainId2)})
        const depositUtxo2 = new Utxo({amount: BigNumber.from(2e7), originChainId: BigNumber.from(chainId2), chainId: BigNumber.from(chainId1)})

        // Should be able to retrieve the token address (so we can mint tokens for test scenario)
       const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainId1);
       const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
       const tx1 = await webbToken1.mintTokens(signers[1].address, '100000000000000000000000');

       const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainId2);
       const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
       const tx2 = await webbToken2.mintTokens(ganacheWallet2.address, '100000000000000000000000');

        //Transact on the bridge
        await vBridge.transact([], [depositUtxo1], 0, '0', '0', signers[1]); 
        await vBridge.transact([], [depositUtxo2], 0, '0', '0', ganacheWallet2); 
        //Now there is a bidirectional edge between chain1 and chain2
      })

      describe('#bridging', () => {
        it('basic ganache deposit should withdraw on hardhat', async () => {
          // Fetch information about the anchor to be updated.
          const signers = await ethers.getSigners();
  
          const vAnchor1: VAnchor = vBridge.getVAnchor(chainId1)!;
          let edgeIndex = await vAnchor1.contract.edgeIndex(chainId2);
          const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
          const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainId1);
          const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
          const signers2BalanceBefore = await webbToken1.getBalance(await signers[2].getAddress());

          //ganacheWallet2 makes a deposit with dest chain chainId1
          const ganacheDepositUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainId2), chainId: BigNumber.from(chainId1)});

          await vBridge.transact([], [ganacheDepositUtxo], 0, '0', '0', ganacheWallet2);

          //check latest leaf index is incremented
          const destAnchorEdge2After = await vAnchor1.contract.edgeList(edgeIndex);
          assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

          //withdraw ganacheWallet2 deposit on chainId1 to signers[2] address
          const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(5e6), originChainId: BigNumber.from(chainId1), chainId: BigNumber.from(chainId1)})
          await vBridge.transact([ganacheDepositUtxo], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[2]); 
          const signers2BalanceAfter = await webbToken1.getBalance(await signers[2].getAddress());
          assert.strictEqual(signers2BalanceBefore.add(5e6).toString(), signers2BalanceAfter.toString());
        })

        it.only('join and split ganache deposits and withdraw on hardhat', async () => {
          const signers = await ethers.getSigners();
  
          const vAnchor1: VAnchor = vBridge.getVAnchor(chainId1)!;
          let edgeIndex = await vAnchor1.contract.edgeIndex(chainId2);
          const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
          const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainId1);
          const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
          const signers2BalanceBefore = await webbToken1.getBalance(await signers[2].getAddress());

          //ganacheWallet2 makes a deposit with dest chain chainId1
          const ganacheDepositUtxo1 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainId2), chainId: BigNumber.from(chainId1)});
          const ganacheDepositUtxo2 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainId2), chainId: BigNumber.from(chainId1), keypair: ganacheDepositUtxo1.keypair});

          await vBridge.transact([], [ganacheDepositUtxo1], 0, '0', '0', ganacheWallet2);
          await vBridge.transact([], [ganacheDepositUtxo2], 0, '0', '0', ganacheWallet2);

          //check latest leaf index is incremented
          const destAnchorEdge2After = await vAnchor1.contract.edgeList(edgeIndex);
          assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(4), destAnchorEdge2After.latestLeafIndex);
          
          //withdraw ganacheWallet2 deposit on chainId1 to signers[2] address
          const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(5e6), originChainId: BigNumber.from(chainId1), chainId: BigNumber.from(chainId1)})
          await vBridge.transact([ganacheDepositUtxo1, ganacheDepositUtxo2], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[2]); 
          
          const signers2BalanceAfter = await webbToken1.getBalance(await signers[2].getAddress());
          assert.strictEqual(signers2BalanceBefore.add(1.5e7).toString(), signers2BalanceAfter.toString());
        })

        it.skip('should update multiple deposits and withdraw historic deposit from ganache', async () => {
          // Fetch information about the anchor to be updated.
          const signers = await ethers.getSigners();
          const anchorSize = '1000000000000000000';
  
          const anchor2: Anchor = bridge.getAnchor(chainId1, anchorSize)!;
          let edgeIndex = await anchor2.contract.edgeIndex(chainId2);
          const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
          const webbToken = await MintableToken.tokenFromAddress(existingToken1.contract.address, signers[1]);
          const startingBalanceDest = await webbToken.getBalance(signers[1].address);
  
          // Make two deposits
          const depositNote1 = await bridge.wrapAndDeposit(chainId1, existingToken2.contract.address, anchorSize, ganacheWallet2);
          const depositNote2 = await bridge.wrapAndDeposit(chainId1, existingToken2.contract.address, anchorSize, ganacheWallet2);
  
          // Check the leaf index is incremented by two
          const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
          assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);
  
          // Withdraw from the bridge with older deposit note
          await bridge.withdrawAndUnwrap(depositNote1!, existingToken1.contract.address, anchorSize, signers[1].address, signers[1].address, signers[1]);
  
          // Check the balance of the other_signer.
          const endingBalanceDest = await webbToken.getBalance(signers[1].address);
          assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
        })

        it('prevent cross-chain double spending', async () => {
          const signers = await ethers.getSigners();

          //ganacheWallet2 makes a deposit with dest chain chainId1
          const ganacheDepositUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainId2), chainId: BigNumber.from(chainId1)});

          const hardhatUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainId1), chainId: BigNumber.from(chainId1)});

          await vBridge.transact([], [ganacheDepositUtxo], 0, '0', '0', ganacheWallet2);
          await vBridge.transact([ganacheDepositUtxo], [hardhatUtxo], 0, '0', '0', signers[2]);
          await TruffleAssert.reverts(
            vBridge.transact([ganacheDepositUtxo], [hardhatUtxo], 0, '0', '0', signers[2]),
            'Input is already spent'
          );
        })
      })
    })

    after('terminate networks', () => {
      ganacheServer2.close(console.error);
      ganacheServer3.close(console.error);
      ganacheServer4.close(console.error);
    });
  });