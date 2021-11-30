/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';

const path = require('path');

const ganache = require('ganache-cli');

// Convenience wrapper classes for contract classes
import { Bridge, BridgeInput, Anchor} from '@webb-tools/fixed-bridge'
import { fetchComponentsFromFilePaths, ZkComponents } from '@webb-tools/utils';
import { GovernedTokenWrapper } from '@webb-tools/tokens';

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

describe('multichain tests for native', () => {

  // setup ganache networks
  let ganacheServer2: any;
  let zkComponents: ZkComponents;

  let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
  let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

  before('setup networks', async () => {
    ganacheServer2 = startGanacheServer(8545, 1337, 'congress island collect purity dentist team gas unlock nuclear pig combine sight');
    await sleep(2000);

    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
    );
  });

  describe('BridgeConstruction', () => {
    let bridge2WebbEthInput: BridgeInput;

    it('create 2 side bridge for native token', async () => {
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
      const bridge = await Bridge.deployBridge(bridge2WebbEthInput, deploymentConfig, zkComponents);

      // Should be able to retrieve individual anchors
      const chainId1 = 31337;
      const chainId2 = 1337;
      const anchorSize = '1000000000000000000';
      const anchor1: Anchor = bridge.getAnchor(chainId1, anchorSize)!;
      const anchor2: Anchor = bridge.getAnchor(chainId2, anchorSize)!;

      // get the balance of native token for the signer
      const nativeStartingBalance = await signers[2].getBalance();

      // wrap and deposit on the bridge
      const depositNative = await bridge.wrapAndDeposit(chainId2, '0x0000000000000000000000000000000000000000', anchorSize, signers[2]);

      // Check the native token has been taken from the depositor's account
      const nativeEndingBalance = await signers[2].getBalance();
      assert.deepEqual(nativeEndingBalance.lt(nativeStartingBalance.sub(anchorSize)), true);

      // Check the edge of the linked anchor is updated
      let edgeIndex = await anchor2.contract.edgeIndex(chainId1);
      let destAnchorEdgeAfter = await anchor2.contract.edgeList(edgeIndex);
      assert.deepEqual(ethers.BigNumber.from(0), destAnchorEdgeAfter.latestLeafIndex);

      // Check the wrapped token has been added to the anchor's account
      const wrappedTokenAddress = bridge.getWebbTokenAddress(chainId1);
      const wrappedToken = GovernedTokenWrapper.connect(wrappedTokenAddress!, signers[2]);
      const wrappedTokenAnchorBalance = await wrappedToken.contract.balanceOf(anchor1.contract.address);
      console.log(`wrappedTokenAnchorBalance: ${wrappedTokenAnchorBalance}`);
      assert.deepEqual(wrappedTokenAnchorBalance.eq(anchorSize), true);

      // deposit on the other side of the bridge
      const depositNativeOther = await bridge.wrapAndDeposit(chainId1, '0x0000000000000000000000000000000000000000', anchorSize, ganacheWallet2);

      // withdraw and unwrap from the first native deposit
      const nativeOtherStartingBalance = await ganacheProvider2.getBalance(signers[2].address);
      const event = await bridge.withdrawAndUnwrap(depositNative, '0x0000000000000000000000000000000000000000', anchorSize, signers[2].address, signers[2].address, ganacheWallet2);
      const nativeOtherEndingBalance = await ganacheProvider2.getBalance(signers[2].address);
      assert.deepEqual(nativeOtherEndingBalance.eq(nativeOtherStartingBalance.add(anchorSize)), true);
    }).timeout(30000);
  })

  after('terminate networks', () => {
    ganacheServer2.close(console.error);
  });
})
