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

  let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
  let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
  let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);

  before('setup networks', async () => {
    ganacheServer2 = startGanacheServer(8545, 1337, 'congress island collect purity dentist team gas unlock nuclear pig combine sight');
    ganacheServer3 = startGanacheServer(9999, 9999, 'aspect biology suit thought bottom popular custom rebuild recall sauce endless local');
    ganacheServer4 = startGanacheServer(4444, 4444, 'harvest useful giraffe swim rail ostrich public awful provide amazing tank weapon');
    await sleep(2000);
  });

  describe('BridgeConstruction', () => {
    let bridge2WebbEthInput: BridgeInput;

    it.only('create 2 side bridge for native token', async () => {
      bridge2WebbEthInput = {
        anchorInputs: {
          asset: {
            31337: ['0'],
            1337: ['0x0000000000000000000000000000000000000000'],
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
      const bridge = await Bridge.deployBridge(bridge2WebbEthInput, deploymentConfig);

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
      const wrappedStartingBalance = await webbToken.getBalance(signers[2].address);

      // get the state of anchors before deposit
      const sourceAnchorRootBefore = await anchor1.contract.getLastRoot();

      // Deposit on the bridge
      const depositNote = await bridge.deposit(chainId2, anchorSize, signers[2]);

      const wrappedEndingBalance = await webbToken.getBalance(signers[2].address);
      assert.deepStrictEqual(wrappedEndingBalance, wrappedStartingBalance.sub(anchorSize));

      // Check the state of anchors after deposit
      let edgeIndex = await anchor2.contract.edgeIndex(chainId1);

      const sourceAnchorRootAfter = await anchor1.contract.getLastRoot();
      let destAnchorEdgeAfter = await anchor2.contract.edgeList(edgeIndex);

      // make sure the edge exists on the anchor
      assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
      assert.deepStrictEqual(ethers.BigNumber.from(0), destAnchorEdgeAfter.latestLeafIndex);

      // get the balance of native token for the signer
      const nativeStartingBalance = await signers[2].getBalance();

      // wrap and deposit on the bridge
      const depositNative = await bridge.wrapAndDeposit(chainId2, '0x0000000000000000000000000000000000000000', anchorSize, signers[2]);

      // Check the native token has been taken from the depositor's account
      const nativeEndingBalance = await signers[2].getBalance();
      assert.equal(nativeEndingBalance.lt(nativeStartingBalance.sub(anchorSize)), true);

      destAnchorEdgeAfter = await anchor2.contract.edgeList(edgeIndex);
      assert.deepStrictEqual(ethers.BigNumber.from(1), destAnchorEdgeAfter.latestLeafIndex);

      // deposit on the other side of the bridge
      const depositNativeOther = await bridge.wrapAndDeposit(chainId1, '0x0000000000000000000000000000000000000000', anchorSize, ganacheWallet2);

      // withdraw and unwrap from the first native deposit
      const nativeOtherStartingBalance = await ganacheProvider2.getBalance(signers[2].address);
      const event = await bridge.withdrawAndUnwrap(depositNative, '0x0000000000000000000000000000000000000000', anchorSize, signers[2].address, signers[2].address, ganacheWallet2);
      const nativeOtherEndingBalance = await ganacheProvider2.getBalance(signers[2].address);
      assert.equal(nativeOtherEndingBalance.eq(nativeOtherStartingBalance.add(anchorSize)), true);
    })
  })

  // describe('2 sided bridge native only use', () => {

  //   let bridge2WebbEthInput = {
  //     anchorInputs: {
  //       asset: {
  //         31337: ['0'],
  //         1337: ['0x0000000000000000000000000000000000000000'],
  //       },
  //       anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
  //     },
  //     chainIDs: [31337, 1337]
  //   };

  //   let bridge: Bridge;
  //   const chainId1 = 31337;
  //   const chainId2 = 1337;

  //   beforeEach('deploy and deposit native: ', async () => {
  //     const signers = await ethers.getSigners();

  //     const deploymentConfig = {
  //       31337: signers[1],
  //       1337: ganacheWallet2,
  //     };
  //     bridge = await Bridge.deployBridge(bridge2WebbEthInput, deploymentConfig);
  //   })
  // })

  after('terminate networks', () => {
    ganacheServer2.close(console.error);
    ganacheServer3.close(console.error);
    ganacheServer4.close(console.error);
  });
})
