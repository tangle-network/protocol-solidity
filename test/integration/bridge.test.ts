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
import Bridge, { BridgeInput } from '../../lib/darkwebb/Bridge';
import Anchor from '../../lib/darkwebb/Anchor';
import MintableToken from '../../lib/darkwebb/MintableToken';
import { toFixedHex } from '../../lib/darkwebb/utils';
import { BigNumber } from '@ethersproject/bignumber';
import { Signer } from '@ethersproject/abstract-signer';

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

    let bridge2WebbEthInput: BridgeInput;
    let bridge3WebbEthInput: BridgeInput;
    let tokenName: string = 'existingERC20';
    let webbTokenName = `webb${tokenName}`;
    let tokenAbbreviation: string = 'EXIST';

    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
    let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
    let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);

    before('construction-tests', async () => {
      const signers = await ethers.getSigners();

      // Create a token to test bridge construction support for existing tokens
      const tokenInstance1 = await MintableToken.createToken(tokenName, tokenAbbreviation, signers[7]);
      const tokenInstance2 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet2);
      const tokenInstance3 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet3);

      await tokenInstance1.mintTokens(signers[1].address, '100000000000000000000000000');

      bridge2WebbEthInput = {
        anchorInputs: [
          {
            asset: {
              31337: tokenInstance1.contract.address,
              1337: tokenInstance2.contract.address,
            },
            anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
          }
        ],
        chainIDs: [31337, 1337]
      };

      bridge3WebbEthInput = {
        anchorInputs: [
          {
            asset: {
              31337: tokenInstance1.contract.address,
              1337: tokenInstance2.contract.address,
              9999: tokenInstance3.contract.address,
            },
            anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
          }
        ],
        chainIDs: [31337, 1337, 9999]
      };

    });

    it('create 2 side bridge for existing token', async () => {
      const signers = await ethers.getSigners();

      const deploymentConfig = {
        31337: signers[1],
        1337: ganacheWallet2,
      };
      const bridge = await Bridge.deployBridge(bridge2WebbEthInput, deploymentConfig);

      // Should be able to retrieve individual anchors
      const chainId1 = 31337;
      const chainId2 = 1337;
      const anchorSize = '1000000000000000000';
      const anchor1: Anchor = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
      const anchor2: Anchor = bridge.getAnchor(chainId2, webbTokenName, anchorSize)!;

      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      const webbTokenAddress = bridge.getWebbTokenAddress(chainId1, tokenName);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
      const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');

      // get the state of anchors before deposit
      const sourceAnchorRootBefore = await anchor1.contract.getLastRoot();
      const destAnchorNeighborRoot = await anchor2.contract.getLatestNeighborRoots();

      // Deposit on the bridge
      const depositNote = await bridge.deposit(chainId2, webbTokenName, anchorSize, signers[2]);
      
      // Check the state of anchors after deposit
      let edgeIndex = await anchor2.contract.edgeIndex(chainId1);

      const sourceAnchorRootAfter = await anchor1.contract.getLastRoot();
      const destAnchorEdgeAfter = await anchor2.contract.edgeList(edgeIndex);

      // make sure the roots / anchors state have changed
      assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
      assert.deepStrictEqual(ethers.BigNumber.from(0), destAnchorEdgeAfter.latestLeafIndex);
    });

    it('create 3 side bridge for existing token', async () => {
      const signers = await ethers.getSigners();

      const deploymentConfig = {
        31337: signers[1],
        1337: ganacheWallet2,
        9999: ganacheWallet3,
      };
      const bridge = await Bridge.deployBridge(bridge3WebbEthInput, deploymentConfig);

      // Should be able to retrieve individual anchors
      const chainId1 = 31337;
      const chainId2 = 1337;
      const chainId3 = 9999;
      const anchorSize = '1000000000000000000';
      const anchor1: Anchor = bridge.getAnchor(chainId1, tokenName, anchorSize)!;
      const anchor2: Anchor = bridge.getAnchor(chainId2, tokenName, anchorSize)!;
      const anchor3: Anchor = bridge.getAnchor(chainId3, tokenName, anchorSize)!;

      // get the state of anchors before deposit
      const sourceAnchorRootBefore = await anchor1.contract.getLastRoot();

      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      const webbTokenAddress = bridge.webbTokenAddresses.get(Bridge.createTokenIdString({tokenName, chainId: chainId1}));
      const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
      const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');

      // Deposit on the bridge with dest chainID and 
      const depositNote = await bridge.deposit(chainId2, webbTokenName, anchorSize, signers[2]);
      
      // Check the state of anchors after deposit
      const sourceAnchorRootAfter = await anchor1.contract.getLastRoot();
      let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
      const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
      edgeIndex = await anchor3.contract.edgeIndex(chainId1);
      const destAnchorEdge3After = await anchor3.contract.edgeList(edgeIndex);

      // make sure the roots / anchors state have changed
      assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
      assert.deepStrictEqual(destAnchorEdge2After.latestLeafIndex, destAnchorEdge3After.latestLeafIndex);
      assert.deepStrictEqual(destAnchorEdge2After.root, destAnchorEdge3After.root);
    });
  });

  describe('Bridge connection and sync', () => {

    let bridge: Bridge;

    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    beforeEach('connection-tests', async () => {
      // Create the bridge,
      const signers = await ethers.getSigners();
      
      const mintableToken1 = await MintableToken.createToken('usdc', 'USDC', signers[1]);
      const mintableToken2 = await MintableToken.createToken('usdc', 'USDC', ganacheWallet2);

      let bridge2Input = {
        anchorInputs: [
          {
            asset: {
              31337: mintableToken1.contract.address,
              1337: mintableToken2.contract.address,
            },
            anchorSizes: ['100000000000000000', '1000000000000000000', '10000000000000000000'],
          }
        ],
        chainIDs: [31337, 1337]
      };

      const deploymentConfig = {
        31337: signers[1],
        1337: ganacheWallet2,
      }

      const createdBridge = await Bridge.deployBridge(bridge2Input, deploymentConfig);

      // Export the config for connecting to the bridge
      const bridgeConfig = createdBridge.exportConfig();

      // Connect to the bridge
      // bridge = await Bridge.connectBridge(bridgeConfig);
    })

    it('should properly deposit and withdraw after connecting', async () => {
      // // Fetch information about the anchor to be updated.
      // const signers = await ethers.getSigners();
      // const tokenName = 'webbEthereum';
      // const anchorSize = '1000000000000000000';

      // const controlledAnchor2: Anchor = bridge.getAnchor(chainId1, tokenName, anchorSize)!;
      // let edgeIndex = await controlledAnchor2.contract.edgeIndex(destChainID2);
      // const destAnchorEdge2Before = await controlledAnchor2.contract.edgeList(edgeIndex);
      // const webbToken = await MintableToken.tokenFromAddress(webbTokenSrc, signers[1]);
      // const startingBalanceDest = await webbToken.getBalance(signers[1].address);

      // // Make a deposit
      // const depositNote1 = await bridge.deposit(chainId1, webbTokenName, anchorSize, ganacheWallet2);

      // // Check the leaf index is incremented
      // const destAnchorEdge2After = await controlledAnchor2.contract.edgeList(edgeIndex);
      // assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(1), destAnchorEdge2After.latestLeafIndex);

      // // Withdraw from the bridge
      // console.log('deposit: ', depositNote1);
      // await bridge.withdraw(depositNote1!, webbTokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // // Check the balance of the signer
      // const endingBalanceDest = await webbToken.getBalance(signers[1].address);
      // assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
    })
  });

  describe('2 sided bridge existing token use', () => {

    // ERC20 compliant contracts that can easily create balances for test
    let tokenName = 'existingERC20';
    let webbTokenName = `webb${tokenName}`;
    let existingToken1: MintableToken;
    let existingToken2: MintableToken;

    let bridge: Bridge;
    const chainId1 = 31337;
    const chainId2 = 1337;
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    before(async () => {
      const signers = await ethers.getSigners();

      existingToken1 = await MintableToken.createToken(tokenName, 'EXIST', signers[1]);
      // Use some other signer with provider on other chain
      existingToken2 = await MintableToken.createToken(tokenName, 'EXIST', ganacheWallet2);

      // mint some tokens to the user of the bridge
      await existingToken1.mintTokens(signers[1].address, '100000000000000000000000000');
      await existingToken2.mintTokens(ganacheWallet2.address, '100000000000000000000000000');
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();

      // create the config for the bridge
      const existingTokenBridgeConfig = {
        anchorInputs: [
          {
            asset: {
              [chainId1]: existingToken1.contract.address,
              [chainId2]: existingToken2.contract.address,
            },
            anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
          }
        ],
        chainIDs: [chainId1, chainId2]
      };

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainId1]: signers[1],
        [chainId2]: ganacheWallet2,
      }

      // deploy the bridge
      bridge = await Bridge.deployBridge(existingTokenBridgeConfig, deploymentConfig);

      // make one deposit so the edge exists
      await bridge.wrapAndDeposit(chainId2, tokenName, '1000000000000000000', signers[1]);
      await bridge.wrapAndDeposit(chainId1, tokenName, '1000000000000000000', ganacheWallet2);
    })

    describe('#bridging', () => {
      it('should withdraw successfully from latest deposit', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor2: Anchor = bridge.getAnchor(chainId2, webbTokenName, anchorSize)!;
        const anchor1: Anchor = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
        let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
        const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
        const token = await MintableToken.tokenFromAddress(existingToken2.contract.address, ganacheWallet2);
        const startingBalanceDest = await token.getBalance(signers[2].address);

        // Make a deposit
        const depositNote1 = await bridge.wrapAndDeposit(chainId2, tokenName, anchorSize, signers[1]);

        // Check the leaf index is incremented
        const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(1), destAnchorEdge2After.latestLeafIndex);

        // Check that the anchor has the appropriate amount of wrapped token balance
        const wrappedTokenAddress = bridge.getWebbTokenAddress(chainId1, tokenName);
        const wrappedToken = await MintableToken.tokenFromAddress(wrappedTokenAddress!, signers[1]);
        const anchorWrappedTokenBalance = await wrappedToken.getBalance(anchor1.contract.address);
        assert.deepStrictEqual(anchorWrappedTokenBalance, (ethers.BigNumber.from(anchorSize)).mul(2));

        // Check that the anchor's token wrapper has the appropriate amount of token balance
        const anchorTokenWrapper = await anchor1.contract.token();
        const anchorTokenWrapperBalance = await existingToken1.getBalance(anchorTokenWrapper);
        assert.deepStrictEqual(anchorTokenWrapperBalance, (ethers.BigNumber.from(anchorSize)).mul(2));

        // Withdraw from the bridge
        await bridge.withdrawAndUnwrap(depositNote1!, tokenName, anchorSize, signers[2].address, signers[2].address, ganacheWallet2);

        // Check the balance of the signer
        const endingBalanceDest = await token.getBalance(signers[2].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      })

      it('should withdraw on hardhat from ganache deposit', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor1: Anchor = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
        let edgeIndex = await anchor1.contract.edgeIndex(chainId2);
        const destAnchorEdge2Before = await anchor1.contract.edgeList(edgeIndex);
        const token = await MintableToken.tokenFromAddress(existingToken1.contract.address, signers[1]);
        const startingBalanceDest = await token.getBalance(signers[2].address);

        // Make a deposit
        const depositNote1 = await bridge.wrapAndDeposit(chainId1, tokenName, anchorSize, ganacheWallet2);

        // Check the leaf index is incremented
        const destAnchorEdge2After = await anchor1.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(1), destAnchorEdge2After.latestLeafIndex);

        // Withdraw from the bridge
        await bridge.withdrawAndUnwrap(depositNote1!, tokenName, anchorSize, signers[2].address, signers[2].address, signers[1]);

        // Check the balance of the signer
        const endingBalanceDest = await token.getBalance(signers[2].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      })

      it('should update multiple deposits and withdraw historic deposit', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor2: Anchor = bridge.getAnchor(chainId2, webbTokenName, anchorSize)!;
        let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
        const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
        const webbToken = await MintableToken.tokenFromAddress(existingToken2.contract.address, ganacheWallet2);
        const startingBalanceDest = await webbToken.getBalance(signers[1].address);

        // Make two deposits
        const depositNote1 = await bridge.wrapAndDeposit(chainId2, tokenName, anchorSize, signers[1]);
        const depositNote2 = await bridge.wrapAndDeposit(chainId2, tokenName, anchorSize, signers[1]);

        // Check the leaf index is incremented by two
        const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

        // Withdraw from the bridge with older deposit note
        await bridge.withdrawAndUnwrap(depositNote1!, tokenName, anchorSize, signers[1].address, signers[1].address, ganacheWallet2);

        // Check the balance of the other_signer.
        const endingBalanceDest = await webbToken.getBalance(signers[1].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      });

      it('should update multiple deposits and withdraw historic deposit from ganache', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor2: Anchor = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
        let edgeIndex = await anchor2.contract.edgeIndex(chainId2);
        const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
        const webbToken = await MintableToken.tokenFromAddress(existingToken1.contract.address, signers[1]);
        const startingBalanceDest = await webbToken.getBalance(signers[1].address);

        // Make two deposits
        const depositNote1 = await bridge.wrapAndDeposit(chainId1, tokenName, anchorSize, ganacheWallet2);
        const depositNote2 = await bridge.wrapAndDeposit(chainId1, tokenName, anchorSize, ganacheWallet2);

        // Check the leaf index is incremented by two
        const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

        // Withdraw from the bridge with older deposit note
        await bridge.withdrawAndUnwrap(depositNote1!, tokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

        // Check the balance of the other_signer.
        const endingBalanceDest = await webbToken.getBalance(signers[1].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      });

      it('should update with Anchor interaction', async () => {
        // const anchorSize = '1000000000000000000';
        // const controlledAnchor1: Anchor = bridge.getAnchor(chainId1, tokenName, anchorSize)!;
        // const controlledAnchor2: Anchor = bridge.getAnchor(destChainID2, tokenName, anchorSize)!;
        // let edgeIndex = await controlledAnchor2.contract.edgeIndex(chainId1);
        // const destAnchorEdge2Before = await controlledAnchor2.contract.edgeList(edgeIndex);

        // // Do a deposit on the Anchor directly
        // const deposit = await controlledAnchor1.deposit(destChainID2);

        // // Call update on the bridge

        // // Verify the linkedAnchor is properly updated
        // const destAnchorEdge2After = await controlledAnchor2.contract.edgeList(edgeIndex);
        // assert.equal(destAnchorEdge2Before.latestLeafIndex.add(1), destAnchorEdge2After.latestLeafIndex);
      })
    });
  });

  describe.skip('3 sided bridge existing token use', () => {
    // ERC20 compliant contracts that can easily create balances for test
    let tokenName = 'existingERC20';
    let existingTokenSrc1: MintableToken;
    let existingTokenSrc2: MintableToken;
    let existingTokenSrc3: MintableToken;

    // TODO: Remove these variables when contracts updated with wrap/unwrap functionality
    let webbTokenName = 'ERC20';
    let webbTokenSrc1: string;
    let webbTokenSrc2: string;
    let webbTokenSrc3: string;

    let bridge: Bridge;
    const chainId1 = 31337;
    const chainId2 = 1337;
    const chainId3 = 9999;

    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
    let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);

    before(async () => {
      const signers = await ethers.getSigners();

      existingTokenSrc1 = await MintableToken.createToken(tokenName, 'EXIST', signers[7]);
      existingTokenSrc2 = await MintableToken.createToken(tokenName, 'EXIST', ganacheWallet2);
      existingTokenSrc3 = await MintableToken.createToken(tokenName, 'EXIST', ganacheWallet3);

      // mint some tokens to the user of the bridge
      await existingTokenSrc1.mintTokens(signers[1].address, '100000000000000000000000000');
      await existingTokenSrc2.mintTokens(ganacheWallet2.address, '100000000000000000000000000');
      await existingTokenSrc3.mintTokens(ganacheWallet3.address, '100000000000000000000000000');
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();

      // create the config for the bridge
      const existingTokenBridgeConfig = {
        anchorInputs: [
          {
            asset: {
              [chainId1]: existingTokenSrc1.contract.address,
              [chainId2]: existingTokenSrc2.contract.address,
              [chainId3]: existingTokenSrc3.contract.address,
            },
            anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
          }
        ],
        chainIDs: [chainId1, chainId2, chainId3]
      };

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainId1]: signers[1],
        [chainId2]: ganacheWallet2,
        [chainId3]: ganacheWallet3,
      }
      
      // deploy the bridge
      bridge = await Bridge.deployBridge(existingTokenBridgeConfig, deploymentConfig);

      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      webbTokenSrc1 = bridge.webbTokenAddresses.get(Bridge.createTokenIdString({tokenName: webbTokenName, chainId: chainId1}))!;
      let webbToken = await MintableToken.tokenFromAddress(webbTokenSrc1, signers[1]);
      await webbToken.mintTokens(signers[1].address, '100000000000000000000000');
      webbTokenSrc2 = bridge.webbTokenAddresses.get(Bridge.createTokenIdString({tokenName: webbTokenName, chainId: chainId2}))!;
      webbToken = await MintableToken.tokenFromAddress(webbTokenSrc2, ganacheWallet2);
      await webbToken.mintTokens(ganacheWallet2.address, '100000000000000000000000');
      webbTokenSrc3 = bridge.webbTokenAddresses.get(Bridge.createTokenIdString({tokenName: webbTokenName, chainId: chainId3}))!;
      webbToken = await MintableToken.tokenFromAddress(webbTokenSrc3, ganacheWallet3);
      await webbToken.mintTokens(ganacheWallet3.address, '100000000000000000000000');

      // make deposits so edges exists
      await bridge.deposit(chainId2, webbTokenName, '1000000000000000000', signers[1]);
      await bridge.deposit(chainId3, webbTokenName, '1000000000000000000', ganacheWallet2);
      await bridge.deposit(31337, webbTokenName, '1000000000000000000', ganacheWallet3);
    })

    it.skip('should withdraw successfully from latest deposits on all chains', async () => {
      // Fetch information about the anchor to be updated.
      const signers = await ethers.getSigners();
      const anchorSize = '1000000000000000000';

      const anchor1: Anchor = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
      let edgeIndex = await anchor1.contract.edgeIndex(chainId1);
      const destAnchorEdge1Before = await anchor1.contract.edgeList(edgeIndex);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenSrc1, signers[1]);
      const startingBalanceDest = await webbToken.getBalance(signers[1].address);

      // Make a deposit on both chains
      const depositNote1 = await bridge.deposit(chainId1, webbTokenName, anchorSize, ganacheWallet2);

      // Check the leaf index is incremented
      const destAnchorEdge1After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge1Before.latestLeafIndex.add(1), destAnchorEdge1After.latestLeafIndex);

      // Withdraw from the bridge
      await bridge.withdraw(depositNote1!, webbTokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // Check the balance of the signer
      const endingBalanceAfterOneWithdraw = await webbToken.getBalance(signers[1].address);
      assert.deepStrictEqual(endingBalanceAfterOneWithdraw, startingBalanceDest.add(anchorSize));

      // make another deposit and withdraw from the third connected chain
      edgeIndex = await anchor1.contract.edgeIndex(chainId3);
      const destAnchorEdge3Before = await anchor1.contract.edgeList(edgeIndex);

      const depositNote3 = await bridge.deposit(chainId1, webbTokenName, anchorSize, ganacheWallet3);

      // Check the leaf index is incremented
      const destAnchorEdge3After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge3Before.latestLeafIndex.add(1), destAnchorEdge3After.latestLeafIndex);

      // Withdraw from the bridge
      await bridge.withdraw(depositNote3!, webbTokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // Check the balance of the signer
      const endingBalanceAfterTwoWithdraw = await webbToken.getBalance(signers[1].address);
      assert.deepStrictEqual(endingBalanceAfterTwoWithdraw, endingBalanceAfterOneWithdraw.add(anchorSize));
    }).timeout(60000);

    it.skip('should verify snarkjs on 3 side build', async () => {
      // Fetch information about the anchor to be updated.
      const signers = await ethers.getSigners();
      const anchorSize = '1000000000000000000';

      const anchor2: Anchor = bridge.getAnchor(chainId2, webbTokenName, anchorSize)!;
      let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
      const destAnchorEdge1Before = await anchor2.contract.edgeList(edgeIndex);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenSrc2, ganacheWallet2);
      const startingBalanceDest = await webbToken.getBalance(signers[1].address);

      // Make a deposit
      const depositNote1 = await bridge.deposit(chainId2, webbTokenName, anchorSize, signers[1]);

      // start making a proof for the anchor:
      // get the merkle proof from anchor1.
      const anchor1 = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
      const anchor1Roots = await anchor1.populateRootsForProof();

      const { merkleRoot, pathElements, pathIndices } = anchor1.tree.path(depositNote1.index);

      const roots = await anchor2.populateRootsForProof();

      // populate the rest of the proof from anchor2
      const input = await anchor2.generateWitnessInput(
        depositNote1.deposit,
        depositNote1.originChainId,
        '0',
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        roots,
        pathElements,
        pathIndices
      );

      const createWitness = async (data: any) => {
        const wtns = {type: "mem"};
        await snarkjs.wtns.calculate(data, path.join(
          "test",
          "fixtures/3",
          "poseidon_bridge_3.wasm"
        ), wtns);
        return wtns;
      }
      
      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('test/fixtures/3/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/3/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);
    }).timeout(60000);

    it.skip('should verify snarkjs on 3 side build with parsed solidity', async () => {
      // Fetch information about the anchor to be updated.
      const signers = await ethers.getSigners();
      const anchorSize = '1000000000000000000';

      const anchor2: Anchor = bridge.getAnchor(chainId2, webbTokenName, anchorSize)!;
      let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
      const destAnchorEdge1Before = await anchor2.contract.edgeList(edgeIndex);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenSrc2, ganacheWallet2);
      const startingBalanceDest = await webbToken.getBalance(signers[1].address);

      // Make a deposit
      const depositNote1 = await bridge.deposit(chainId2, webbTokenName, anchorSize, signers[1]);

      // start making a proof for the anchor:
      // get the merkle proof from anchor1.
      const anchor1 = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
      const anchor1Roots = await anchor1.populateRootsForProof();

      const { merkleRoot, pathElements, pathIndices } = anchor1.tree.path(depositNote1.index);

      const roots = await anchor2.populateRootsForProof();

      // populate the rest of the proof from anchor2
      const input = await anchor2.generateWitnessInput(
        depositNote1.deposit,
        depositNote1.originChainId,
        '0',
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        roots,
        pathElements,
        pathIndices
      );

      const createWitness = async (data: any) => {
        const wtns = {type: "mem"};
        await snarkjs.wtns.calculate(data, path.join(
          "test",
          "fixtures/3",
          "poseidon_bridge_3.wasm"
        ), wtns);
        return wtns;
      }
      
      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('test/fixtures/3/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/3/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      
      // assert native verification before solidity export data
      assert.strictEqual(res, true);

      // convert the proof to groth 16 solidity calldata
      const groth16ProofCallData = await Anchor.groth16ExportSolidityCallData(tempProof, tempSignals);

      // convert the proof to solidityWithdrawCalldata
      const withdrawProofCalldata = await Anchor.generateWithdrawProofCallData(groth16ProofCallData, tempSignals);

      // parse the (proof, signals) back from solidity to typescript
      // const { parsedProof: proof, parsedSignals: signals } = await Anchor.parseProofCalldata(proofCallData);



      // check the groth16 verification again

    }).timeout(60000);
  });

  describe('4 sided bridge wrap/unwrap token use', () => {
    // ERC20 compliant contracts that can easily create balances for test
    let tokenName = 'existingERC20';
    let webbTokenName = `webb${tokenName}`;
    let existingTokenSrc: MintableToken;
    let existingTokenSrc2: MintableToken;
    let existingTokenSrc3: MintableToken;
    let existingTokenSrc4: MintableToken;

    let bridge: Bridge;
    const chainId1 = 31337;
    const chainId2 = 1337;
    const chainId3 = 9999;
    const chainId4 = 4444;
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
    let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);

    let ganacheProvider4 = new ethers.providers.JsonRpcProvider('http://localhost:4444');
    let ganacheWallet4 = new ethers.Wallet('d897ca733460ea2c7cda5150926ade4a40e6828bb1cb0d38f097102530b3ef42', ganacheProvider4);

    let calculateCumulativeBalance: (userAddress: string, tokenAddress: string, webbTokenAddress: string, signer: Signer) => Promise<BigNumber>;

    before(async () => {
      const signers = await ethers.getSigners();

      existingTokenSrc = await MintableToken.createToken(tokenName, 'EXIST', signers[7]);
      existingTokenSrc2 = await MintableToken.createToken(tokenName, 'EXIST', ganacheWallet2);
      existingTokenSrc3 = await MintableToken.createToken(tokenName, 'EXIST', ganacheWallet3);
      existingTokenSrc4 = await MintableToken.createToken(tokenName, 'EXIST', ganacheWallet4);
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();

      // create the config for the bridge
      const existingTokenBridgeConfig = {
        anchorInputs: [
          {
            asset: {
              [chainId1]: existingTokenSrc.contract.address,
              [chainId2]: existingTokenSrc2.contract.address,
              [chainId3]: existingTokenSrc3.contract.address,
              [chainId4]: existingTokenSrc4.contract.address,
            },
            anchorSizes: ['1000000000000000000', '100000000000000000000'],
          }
        ],
        chainIDs: [chainId1, chainId2, chainId3, chainId4]
      };

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainId1]: signers[1],
        [chainId2]: ganacheWallet2,
        [chainId3]: ganacheWallet3,
        [chainId4]: ganacheWallet4,
      }
      
      // deploy the bridge
      bridge = await Bridge.deployBridge(existingTokenBridgeConfig, deploymentConfig);

      // Should mint tokens for test purposes
      await existingTokenSrc.mintTokens(signers[1].address, '100000000000000000000000');
      await existingTokenSrc2.mintTokens(ganacheWallet2.address, '100000000000000000000000');
      await existingTokenSrc3.mintTokens(ganacheWallet3.address, '100000000000000000000000');
      await existingTokenSrc4.mintTokens(ganacheWallet4.address, '100000000000000000000000');

      // define the calculateCumulativeBalance
      calculateCumulativeBalance = async (userAddress: string, tokenAddress: string, webbTokenAddress: string, signer: Signer) => {
        const tokenBalance = await (await MintableToken.tokenFromAddress(tokenAddress, signer)).getBalance(userAddress);
        const webbTokenBalance = await (await MintableToken.tokenFromAddress(webbTokenAddress, signer)).getBalance(userAddress);
        const totalBalance = tokenBalance.add(webbTokenBalance);
        return totalBalance;
      }
    })

    it('should withdraw successfully from latest deposits on all chains', async () => {
      const signers = await ethers.getSigners();

      // make deposits so edges exists
      await bridge.wrapAndDeposit(chainId2, tokenName, '1000000000000000000', signers[1]);
      await bridge.wrapAndDeposit(chainId3, tokenName, '1000000000000000000', ganacheWallet2);
      await bridge.wrapAndDeposit(chainId4, tokenName, '1000000000000000000', ganacheWallet3);
      await bridge.wrapAndDeposit(chainId1, tokenName, '1000000000000000000', ganacheWallet4);

      // Fetch information about the anchor to be updated.
      const anchorSize = '1000000000000000000';
      const webbTokenAddress1 = bridge.getWebbTokenAddress(chainId1, tokenName)!;
      const tokenAddress1 = existingTokenSrc.contract.address;

      const anchor1: Anchor = bridge.getAnchor(chainId1, webbTokenName, anchorSize)!;
      let edgeIndex = await anchor1.contract.edgeIndex(chainId1);
      const destAnchorEdge1Before = await anchor1.contract.edgeList(edgeIndex);
      let cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      let currentBalance = cumulativeBalance;

      // Make a deposit on the second chain
      const depositNote1 = await bridge.wrapAndDeposit(chainId1, tokenName, anchorSize, ganacheWallet2);

      // Check the leaf index is incremented
      const destAnchorEdge1After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge1Before.latestLeafIndex.add(1), destAnchorEdge1After.latestLeafIndex);

      // Withdraw from the first chain
      await bridge.withdrawAndUnwrap(depositNote1!, tokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // Check the balance of the signer
      cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      assert.deepStrictEqual(cumulativeBalance, currentBalance.add(anchorSize));
      currentBalance = cumulativeBalance;

      // make a deposit from the third connected chain
      edgeIndex = await anchor1.contract.edgeIndex(chainId3);
      const destAnchorEdge3Before = await anchor1.contract.edgeList(edgeIndex);
      const depositNote3 = await bridge.wrapAndDeposit(chainId1, tokenName, anchorSize, ganacheWallet3);

      // Check the leaf index is incremented
      const destAnchorEdge3After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge3Before.latestLeafIndex.add(1), destAnchorEdge3After.latestLeafIndex);

      // Attempting to withdraw and unwrap should fail because this anchor side does not currently have
      //      enough ERC20 token balance
      await TruffleAssert.reverts(bridge.withdrawAndUnwrap(depositNote3!, tokenName, anchorSize, signers[1].address, signers[1].address, signers[1]));
      await bridge.withdraw(depositNote3!, webbTokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

      cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      assert.deepStrictEqual(cumulativeBalance, currentBalance.add(anchorSize));
      currentBalance = cumulativeBalance;

      // make a deposit from the fourth connected chain
      edgeIndex = await anchor1.contract.edgeIndex(chainId4);
      const destAnchorEdge4Before = await anchor1.contract.edgeList(edgeIndex);
      const depositNote4 = await bridge.wrapAndDeposit(chainId1, tokenName, anchorSize, ganacheWallet4);

      // Check the leaf index is incremented
      const destAnchorEdge4After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge4Before.latestLeafIndex.add(1), destAnchorEdge4After.latestLeafIndex);

      // Withdraw from the third connected chain
      await bridge.withdraw(depositNote4!, webbTokenName, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // Check the balance of the signer
      const endingBalanceAfterThreeWithdraw = await existingTokenSrc.getBalance(signers[1].address);
      cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      assert.deepStrictEqual(cumulativeBalance, currentBalance.add(anchorSize));
      currentBalance = cumulativeBalance;
    }).timeout(60000);
  });

  after('terminate networks', () => {
    ganacheServer2.close(console.error);
    ganacheServer3.close(console.error);
  });
});