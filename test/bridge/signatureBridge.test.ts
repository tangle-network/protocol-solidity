/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');
import { ethers, network } from 'hardhat';

const path = require('path');

// Convenience wrapper classes for contract classes
import { Anchor } from '@webb-tools/anchors';
import { SignatureBridge } from '@webb-tools/bridges'; 
import { BridgeInput } from '@webb-tools/interfaces';
import { MintableToken } from '@webb-tools/tokens';
import { fetchComponentsFromFilePaths, getChainIdType, ZkComponents } from '@webb-tools/utils';
import { BigNumber } from '@ethersproject/bignumber';
import { Signer } from 'ethers';
import { startGanacheServer } from '../helpers/startGanacheServer';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('multichain tests for erc20 bridges', () => {
  const chainID1 = getChainIdType(31337);
  const chainID2 = getChainIdType(1337);
  const chainID3 = getChainIdType(9999);
  // setup ganache networks
  let ganacheServer2: any;
  let ganacheServer3: any;
  let ganacheServer4: any;

  // setup zero knowledge components
  let zkComponents2: ZkComponents;
  let zkComponents3: ZkComponents;
  let zkComponents4: ZkComponents;

  before('setup networks', async () => {
    ganacheServer2 = await startGanacheServer(1337, 1337, 'congress island collect purity dentist team gas unlock nuclear pig combine sight');
    ganacheServer3 = await startGanacheServer(9999, 9999, 'aspect biology suit thought bottom popular custom rebuild recall sauce endless local');
    ganacheServer4 = await startGanacheServer(4444, 4444, 'harvest useful giraffe swim rail ostrich public awful provide amazing tank weapon');
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

  describe('SignatureBridgeConstruction', () => {
    let bridge2WebbEthInput: BridgeInput;
    let bridge3WebbEthInput: BridgeInput;
    let tokenName: string = 'existingERC20';
    let tokenAbbreviation: string = 'EXIST';
    let tokenInstance1: MintableToken;
    let tokenInstance2: MintableToken;
    let tokenInstance3: MintableToken;

    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:1337');
    ganacheProvider2.pollingInterval = 1;
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
    let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
    ganacheProvider3.pollingInterval = 1;
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
            [chainID1]: [tokenInstance1.contract.address],
            [chainID2]: [tokenInstance2.contract.address],
          },
          anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
        },
        chainIDs: [chainID1, chainID2]
      };
      
      const signers = await ethers.getSigners();

      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
      };
      const bridge = await SignatureBridge.deployFixedDepositBridge(bridge2WebbEthInput, deploymentConfig, zkComponents2);

      // Should be able to retrieve individual anchors
      const anchorSize = '1000000000000000000';
      const anchor1: Anchor = bridge.getAnchor(chainID1, anchorSize)! as Anchor;
      const anchor2: Anchor = bridge.getAnchor(chainID2, anchorSize)! as Anchor;

      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      const webbTokenAddress = bridge.getWebbTokenAddress(chainID1);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
      const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');

      // get the state of anchors before deposit
      const sourceAnchorRootBefore = await anchor1.contract.getLastRoot();

      // Deposit on the bridge
      const depositNote = await bridge.deposit(chainID2, anchorSize, signers[2]);
      
      // Check the state of anchors after deposit
      let edgeIndex = await anchor2.contract.edgeIndex(chainID1);

      const sourceAnchorRootAfter = await anchor1.contract.getLastRoot();
      const destAnchorEdgeAfter = await anchor2.contract.edgeList(edgeIndex);

      // make sure the roots / anchors state have changed
      assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
      assert.deepEqual(ethers.BigNumber.from(0), destAnchorEdgeAfter.latestLeafIndex);

      await bridge.withdraw(depositNote, anchorSize, signers[1].address, signers[1].address, ganacheWallet2);

      const webbTokenAddress2 = bridge.getWebbTokenAddress(chainID2);
      const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
      const webbTokenBalance2 = await webbToken2.getBalance(signers[1].address);

      assert.deepEqual(webbTokenBalance2, ethers.BigNumber.from(anchorSize));
    });

    it.only('create 3 side bridge for one token', async () => {
      bridge3WebbEthInput = {
        anchorInputs: {
          asset: {
            [chainID1]: [tokenInstance1.contract.address],
            [chainID2]: [tokenInstance2.contract.address],
            [chainID3]: [tokenInstance3.contract.address],
          },
          anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
        },
        chainIDs: [chainID1, chainID2, chainID3]
      };
      
      const signers = await ethers.getSigners();

      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
        [chainID3]: ganacheWallet3,
      };
      const bridge = await SignatureBridge.deployFixedDepositBridge(bridge3WebbEthInput, deploymentConfig, zkComponents3);

      // Should be able to retrieve individual anchors
      const anchorSize = '1000000000000000000';
      const anchor1: Anchor = bridge.getAnchor(chainID1, anchorSize)! as Anchor;
      const anchor2: Anchor = bridge.getAnchor(chainID2, anchorSize)! as Anchor;
      const anchor3: Anchor = bridge.getAnchor(chainID3, anchorSize)! as Anchor;

      // get the state of anchors before deposit
      const sourceAnchorRootBefore = await anchor1.contract.getLastRoot();

      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      const webbTokenAddress = bridge.webbTokenAddresses.get(chainID1);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
      const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');

      // Deposit on the bridge with dest chainID and 
      const depositNote = await bridge.deposit(chainID2, anchorSize, signers[2]);
      
      // Check the state of anchors after deposit
      const sourceAnchorRootAfter = await anchor1.contract.getLastRoot();
      let edgeIndex = await anchor2.contract.edgeIndex(chainID1);
      const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
      edgeIndex = await anchor3.contract.edgeIndex(chainID1);
      const destAnchorEdge3After = await anchor3.contract.edgeList(edgeIndex);

      // make sure the roots / anchors state have changed
      assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
      assert.deepStrictEqual(destAnchorEdge2After.latestLeafIndex, destAnchorEdge3After.latestLeafIndex);
      assert.deepStrictEqual(destAnchorEdge2After.root, destAnchorEdge3After.root);
    }).timeout(40000);

    it.only('create 2 side bridge for multiple tokens', async () => {
      bridge2WebbEthInput = {
        anchorInputs: {
          asset: {
            [chainID1]: [tokenInstance1.contract.address],
            [chainID2]: [tokenInstance2.contract.address],
          },
          anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
        },
        chainIDs: [chainID1, chainID2]
      };
    });

    it.only('create 2 side bridge for native and erc20 token', async () => {
      bridge2WebbEthInput = {
        anchorInputs: {
          asset: {
            [chainID1]: [tokenInstance1.contract.address, '0'],
            [chainID2]: [tokenInstance2.contract.address, '0x0000000000000000000000000000000000000000'],
          },
          anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
        },
        chainIDs: [chainID1, chainID2]
      };
    });
  }).timeout(50000);

  describe('2 sided bridge existing token use', () => {

    // ERC20 compliant contracts that can easily create balances for test
    let existingToken1: MintableToken;
    let existingToken2: MintableToken;

    let bridge: SignatureBridge;
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:1337');
    ganacheProvider2.pollingInterval = 1;
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

      // create the config for the bridge
      const existingTokenBridgeConfig = {
        anchorInputs: {
          asset: {
            [chainID1]: [existingToken1.contract.address],
            [chainID2]: [existingToken2.contract.address],
          },
          anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
        },
        chainIDs: [chainID1, chainID2]
      };

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
      }

      // deploy the bridge
      bridge = await SignatureBridge.deployFixedDepositBridge(existingTokenBridgeConfig, deploymentConfig, zkComponents2);

      // make one deposit so the edge exists
      await bridge.wrapAndDeposit(chainID2, existingToken1.contract.address, '1000000000000000000', signers[1]);
      await bridge.wrapAndDeposit(chainID1, existingToken2.contract.address, '1000000000000000000', ganacheWallet2);
    })

    describe('#bridging', () => {
      it.only('should withdraw successfully from latest deposit', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor2: Anchor = bridge.getAnchor(chainID2, anchorSize)! as Anchor;
        const anchor1: Anchor = bridge.getAnchor(chainID1, anchorSize)! as Anchor;
        let edgeIndex = await anchor2.contract.edgeIndex(chainID1);
        const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
        const token = await MintableToken.tokenFromAddress(existingToken2.contract.address, ganacheWallet2);
        const startingBalanceDest = await token.getBalance(signers[2].address);

        // Make a deposit
        const depositNote1 = await bridge.wrapAndDeposit(chainID2, existingToken1.contract.address, anchorSize, signers[1]);

        // Check the leaf index is incremented
        const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
        assert.deepEqual(destAnchorEdge2Before.latestLeafIndex.add(1), destAnchorEdge2After.latestLeafIndex);

        // Check that the anchor has the appropriate amount of wrapped token balance
        const wrappedTokenAddress = bridge.getWebbTokenAddress(chainID1);
        const wrappedToken = await MintableToken.tokenFromAddress(wrappedTokenAddress!, signers[1]);
        const anchorWrappedTokenBalance = await wrappedToken.getBalance(anchor1.contract.address);
        assert.deepEqual(anchorWrappedTokenBalance, (ethers.BigNumber.from(anchorSize)).mul(2));

        // Check that the anchor's token wrapper has the appropriate amount of token balance
        const anchorTokenWrapper = await anchor1.contract.token();
        const anchorTokenWrapperBalance = await existingToken1.getBalance(anchorTokenWrapper);
        assert.deepEqual(anchorTokenWrapperBalance, (ethers.BigNumber.from(anchorSize)).mul(2));

        // Withdraw from the bridge
        await bridge.withdrawAndUnwrap(depositNote1!, existingToken2.contract.address, anchorSize, signers[2].address, signers[2].address, ganacheWallet2);

        // Check the balance of the signer
        const endingBalanceDest = await token.getBalance(signers[2].address);
        assert.deepEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      })

      it.only('should withdraw on hardhat from ganache deposit', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor1: Anchor = bridge.getAnchor(chainID1, anchorSize)! as Anchor;
        let edgeIndex = await anchor1.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await anchor1.contract.edgeList(edgeIndex);
        const token = await MintableToken.tokenFromAddress(existingToken1.contract.address, signers[1]);
        const startingBalanceDest = await token.getBalance(signers[2].address);

        // Make a deposit
        const depositNote1 = await bridge.wrapAndDeposit(chainID1, existingToken2.contract.address, anchorSize, ganacheWallet2);

        // Check the leaf index is incremented
        const destAnchorEdge2After = await anchor1.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(1), destAnchorEdge2After.latestLeafIndex);

        // Withdraw from the bridge
        await bridge.withdrawAndUnwrap(depositNote1!, existingToken1.contract.address, anchorSize, signers[2].address, signers[2].address, signers[1]);

        // Check the balance of the signer
        const endingBalanceDest = await token.getBalance(signers[2].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      })

      it.only('should update multiple deposits and withdraw historic deposit', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor2: Anchor = bridge.getAnchor(chainID2, anchorSize)! as Anchor;
        let edgeIndex = await anchor2.contract.edgeIndex(chainID1);
        const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
        const webbToken = await MintableToken.tokenFromAddress(existingToken2.contract.address, ganacheWallet2);
        const startingBalanceDest = await webbToken.getBalance(signers[1].address);

        // Make two deposits
        const depositNote1 = await bridge.wrapAndDeposit(chainID2, existingToken1.contract.address, anchorSize, signers[1]);
        const depositNote2 = await bridge.wrapAndDeposit(chainID2, existingToken1.contract.address, anchorSize, signers[1]);

        // Check the leaf index is incremented by two
        const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

        // Withdraw from the bridge with older deposit note
        await bridge.withdrawAndUnwrap(depositNote1!, existingToken2.contract.address, anchorSize, signers[1].address, signers[1].address, ganacheWallet2);

        // Check the balance of the other_signer.
        const endingBalanceDest = await webbToken.getBalance(signers[1].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      });

      it.only('should update multiple deposits and withdraw historic deposit from ganache', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        const anchor2: Anchor = bridge.getAnchor(chainID1, anchorSize)! as Anchor;
        let edgeIndex = await anchor2.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await anchor2.contract.edgeList(edgeIndex);
        const webbToken = await MintableToken.tokenFromAddress(existingToken1.contract.address, signers[1]);
        const startingBalanceDest = await webbToken.getBalance(signers[1].address);

        // Make two deposits
        const depositNote1 = await bridge.wrapAndDeposit(chainID1, existingToken2.contract.address, anchorSize, ganacheWallet2);
        const depositNote2 = await bridge.wrapAndDeposit(chainID1, existingToken2.contract.address, anchorSize, ganacheWallet2);

        // Check the leaf index is incremented by two
        const destAnchorEdge2After = await anchor2.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

        // Withdraw from the bridge with older deposit note
        await bridge.withdrawAndUnwrap(depositNote1!, existingToken1.contract.address, anchorSize, signers[1].address, signers[1].address, signers[1]);

        // Check the balance of the other_signer.
        const endingBalanceDest = await webbToken.getBalance(signers[1].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(anchorSize));
      });
    });
  });

  describe('4 sided bridge wrap/unwrap token use', () => {
    // ERC20 compliant contracts that can easily create balances for test
    let existingTokenSrc: MintableToken;
    let existingTokenSrc2: MintableToken;
    let existingTokenSrc3: MintableToken;
    let existingTokenSrc4: MintableToken;

    let bridge: SignatureBridge;
    const chainId4 = 4444;
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:1337');
    ganacheProvider2.pollingInterval = 1;
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
    ganacheProvider3.pollingInterval = 1;
    let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);

    let ganacheProvider4 = new ethers.providers.JsonRpcProvider('http://localhost:4444');
    ganacheProvider4.pollingInterval = 1;
    let ganacheWallet4 = new ethers.Wallet('d897ca733460ea2c7cda5150926ade4a40e6828bb1cb0d38f097102530b3ef42', ganacheProvider4);

    let calculateCumulativeBalance: (userAddress: string, tokenAddress: string, webbTokenAddress: string, signer: Signer) => Promise<BigNumber>;

    before(async () => {
      const signers = await ethers.getSigners();

      existingTokenSrc = await MintableToken.createToken('existingERC20', 'EXIST', signers[7]);
      existingTokenSrc2 = await MintableToken.createToken('existingERC20', 'EXIST', ganacheWallet2);
      existingTokenSrc3 = await MintableToken.createToken('existingERC20', 'EXIST', ganacheWallet3);
      existingTokenSrc4 = await MintableToken.createToken('existingERC20', 'EXIST', ganacheWallet4);
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();

      // create the config for the bridge
      const existingTokenBridgeConfig: BridgeInput = {
        anchorInputs: {
          asset: {
            [chainID1]: [existingTokenSrc.contract.address],
            [chainID2]: [existingTokenSrc2.contract.address],
            [chainID3]: [existingTokenSrc3.contract.address],
            [chainId4]: [existingTokenSrc4.contract.address],
          },
          anchorSizes: ['1000000000000000000', '100000000000000000000'],
        },
        chainIDs: [chainID1, chainID2, chainID3, chainId4]
      };

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
        [chainID3]: ganacheWallet3,
        [chainId4]: ganacheWallet4,
      }
      
      // deploy the bridge
      bridge = await SignatureBridge.deployFixedDepositBridge(existingTokenBridgeConfig, deploymentConfig, zkComponents4);

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

    it.only('should withdraw successfully from latest deposits on all chains', async () => {
      const signers = await ethers.getSigners();

      // make deposits so edges exists
      await bridge.wrapAndDeposit(chainID2, existingTokenSrc.contract.address, '1000000000000000000', signers[1]);
      await bridge.wrapAndDeposit(chainID3, existingTokenSrc2.contract.address, '1000000000000000000', ganacheWallet2);
      await bridge.wrapAndDeposit(chainId4, existingTokenSrc3.contract.address, '1000000000000000000', ganacheWallet3);
      await bridge.wrapAndDeposit(chainID1, existingTokenSrc4.contract.address, '1000000000000000000', ganacheWallet4);

      // Fetch information about the anchor to be updated.
      const anchorSize = '1000000000000000000';
      const webbTokenAddress1 = bridge.getWebbTokenAddress(chainID1)!;
      const tokenAddress1 = existingTokenSrc.contract.address;

      const anchor1: Anchor = bridge.getAnchor(chainID1, anchorSize)! as Anchor;
      let edgeIndex = await anchor1.contract.edgeIndex(chainID1);
      const destAnchorEdge1Before = await anchor1.contract.edgeList(edgeIndex);
      let cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      let currentBalance = cumulativeBalance;

      // Make a deposit on the second chain
      const depositNote1 = await bridge.wrapAndDeposit(chainID1, existingTokenSrc2.contract.address, anchorSize, ganacheWallet2);

      // Check the leaf index is incremented
      const destAnchorEdge1After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge1Before.latestLeafIndex.add(1), destAnchorEdge1After.latestLeafIndex);

      // Withdraw from the first chain
      await bridge.withdrawAndUnwrap(depositNote1!, existingTokenSrc.contract.address, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // Check the balance of the signer
      cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      assert.deepStrictEqual(cumulativeBalance, currentBalance.add(anchorSize));
      currentBalance = cumulativeBalance;

      // make a deposit from the third connected chain
      edgeIndex = await anchor1.contract.edgeIndex(chainID3);
      const destAnchorEdge3Before = await anchor1.contract.edgeList(edgeIndex);
      const depositNote3 = await bridge.wrapAndDeposit(chainID1, existingTokenSrc3.contract.address, anchorSize, ganacheWallet3);

      // Check the leaf index is incremented
      const destAnchorEdge3After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge3Before.latestLeafIndex.add(1), destAnchorEdge3After.latestLeafIndex);

      // Attempting to withdraw and unwrap should fail because this anchor side does not currently have
      //      enough ERC20 token balance
      await TruffleAssert.reverts(bridge.withdrawAndUnwrap(depositNote3!, existingTokenSrc.contract.address, anchorSize, signers[1].address, signers[1].address, signers[1]));
      await bridge.withdraw(depositNote3!, anchorSize, signers[1].address, signers[1].address, signers[1]);

      cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      assert.deepStrictEqual(cumulativeBalance, currentBalance.add(anchorSize));
      currentBalance = cumulativeBalance;

      // make a deposit from the fourth connected chain
      edgeIndex = await anchor1.contract.edgeIndex(chainId4);
      const destAnchorEdge4Before = await anchor1.contract.edgeList(edgeIndex);
      const depositNote4 = await bridge.wrapAndDeposit(chainID1, existingTokenSrc4.contract.address, anchorSize, ganacheWallet4);

      // Check the leaf index is incremented
      const destAnchorEdge4After = await anchor1.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(destAnchorEdge4Before.latestLeafIndex.add(1), destAnchorEdge4After.latestLeafIndex);

      // Withdraw from the third connected chain
      await bridge.withdraw(depositNote4!, anchorSize, signers[1].address, signers[1].address, signers[1]);

      // Check the balance of the signer
      const endingBalanceAfterThreeWithdraw = await existingTokenSrc.getBalance(signers[1].address);
      cumulativeBalance = await calculateCumulativeBalance(signers[1].address, tokenAddress1, webbTokenAddress1, signers[1]);
      assert.deepStrictEqual(cumulativeBalance, currentBalance.add(anchorSize));
      currentBalance = cumulativeBalance;
    }).timeout(60000);
  });

  after('terminate networks', async () => {
    await ganacheServer2.close();
    await ganacheServer3.close();
    await ganacheServer4.close();
  });
});
