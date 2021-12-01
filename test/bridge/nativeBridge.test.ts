/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';

const path = require('path');

// Convenience wrapper classes for contract classes
import { Bridge, BridgeInput, Anchor, AnchorDeposit} from '@webb-tools/fixed-bridge'
import { fetchComponentsFromFilePaths, ZkComponents } from '@webb-tools/utils';
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';
import { startGanacheServer } from '../helpers/startGanacheServer';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.only('multichain tests for native', () => {
  describe('two sided bridge tests', () => {
    // setup ganache networks
    let PRIVATE_KEY = '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e'
    let ganacheServer2: any;
    let ganacheAccount = [
      {
        balance: ethers.utils.parseEther('1000').toHexString(),
        secretKey: PRIVATE_KEY,
      },
    ]
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet(PRIVATE_KEY, ganacheProvider2);

    let zkComponents: ZkComponents;

    before('setup networks', async () => {
      ganacheServer2 = startGanacheServer(8545, 1337, ganacheAccount);
      await sleep(2000);

      zkComponents = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
        path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
        path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
      );
    });

    describe('NativeBridge Sunny day', () => {
      it('should wrapAndDeposit and unwrapAndWithdraw', async () => {
        const bridge2WebbEthInput: BridgeInput = {
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
          wallets: {
            31337: signers[1],
            1337: ganacheWallet2,
          }
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
      })
    })

    describe('NativeBridgeUse bridgedWithdraw', () => {
      let bridge: Bridge;
      let nativeDeposit: AnchorDeposit;
      const chainId1 = 31337;
      const chainId2 = 1337;

      beforeEach(async () => {
        const bridge2WebbEthInput: BridgeInput = {
          anchorInputs: {
            asset: {
              [chainId1]: ['0'],
              [chainId2]: ['0x0000000000000000000000000000000000000000'],
            },
            anchorSizes: ['1000000000000000000', '100000000000000000000', '10000000000000000000000'],
          },
          chainIDs: [chainId1, chainId2]
        };

        const signers = await ethers.getSigners();

        const deploymentConfig = {
          wallets: {
            [chainId1]: signers[1],
            [chainId2]: ganacheWallet2,
          }
        };
        bridge = await Bridge.deployBridge(bridge2WebbEthInput, deploymentConfig, zkComponents);

        // Should be able to retrieve individual anchors
        const anchorSize = '1000000000000000000';

        // wrap and deposit on the bridge
        nativeDeposit = await bridge.wrapAndDeposit(chainId1, '0x0000000000000000000000000000000000000000', anchorSize, ganacheWallet2);
      });

      it('should be able to withdraw webb tokens even if no deposits on dest chain', async () => {
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        // get the starting balance of webb tokens on dest chain
        const webbTokenAddress = bridge.getWebbTokenAddress(chainId1);
        const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress, signers[2]);
        const webbStartingBalance = await webbToken.getBalance(signers[2].address);

        // withdraw and unwrap from the first native deposit
        const event = await bridge.withdraw(nativeDeposit, anchorSize, signers[2].address, signers[2].address, signers[1]);
        const webbEndingBalance = await webbToken.getBalance(signers[2].address);
        assert.deepEqual(webbEndingBalance.eq(webbStartingBalance.add(anchorSize)), true);
      })
    })

    after('terminate networks', () => {
      ganacheServer2.close(console.error);
    });
  });

  describe('six sided bridge tests', () => {
    // setup ganache networks
    let PRIVATE_KEY = '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e'

    let ganacheServer2: any;
    let ganacheAccount = [
      {
        balance: ethers.utils.parseEther('1000').toHexString(),
        secretKey: PRIVATE_KEY,
      },
    ]
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:8545');
    let ganacheWallet2 = new ethers.Wallet(PRIVATE_KEY, ganacheProvider2);

    let ganacheServer3: any;
    let ganacheServer4: any;
    let ganacheServer5: any;
    let ganacheServer6: any;

    let zkComponents: ZkComponents;
    
    before('setup networks', async () => {
      ganacheServer2 = startGanacheServer(8545, 1337, ganacheAccount);
      ganacheServer3 = startGanacheServer(3333, 3333, ganacheAccount);
      ganacheServer4 = startGanacheServer(4444, 4444, ganacheAccount);
      ganacheServer5 = startGanacheServer(5555, 5555, ganacheAccount);
      ganacheServer6 = startGanacheServer(6666, 6666, ganacheAccount);

      await sleep(2000);

      zkComponents = await fetchComponentsFromFilePaths(
        path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
        path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
        path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
      );
    });

    describe('NativeBridgeUse bridgedWithdraw', () => {
      let bridge: Bridge;
      let nativeDeposit: AnchorDeposit;
      const chainId1 = 31337;
      const chainId2 = 1337;
      const chainId3 = 3333;
      const chainId4 = 4444;
      const chainId5 = 5555;
      const chainId6 = 6666;

      beforeEach(async () => {
        const bridge6WebbEthInput: BridgeInput = {
          anchorInputs: {
            asset: {
              [chainId1]: ['0'],
              [chainId2]: ['0x0000000000000000000000000000000000000000'],
              [chainId3]: ['0x0000000000000000000000000000000000000000'],
              [chainId4]: ['0x0000000000000000000000000000000000000000'],
              [chainId5]: ['0x0000000000000000000000000000000000000000'],
              [chainId6]: ['0x0000000000000000000000000000000000000000'],
            },
            anchorSizes: ['1000000000000000000'],
          },
          chainIDs: [chainId1, chainId2, chainId3, chainId4, chainId5, chainId6]
        };

        const signers = await ethers.getSigners();

        const ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:3333')
        const ganacheWallet3 = new ethers.Wallet(PRIVATE_KEY, ganacheProvider3);
        const ganacheProvider4 = new ethers.providers.JsonRpcProvider('http://localhost:4444')
        const ganacheWallet4 = new ethers.Wallet(PRIVATE_KEY, ganacheProvider4);
        const ganacheProvider5 = new ethers.providers.JsonRpcProvider('http://localhost:5555')
        const ganacheWallet5 = new ethers.Wallet(PRIVATE_KEY, ganacheProvider5);
        const ganacheProvider6 = new ethers.providers.JsonRpcProvider('http://localhost:6666')
        const ganacheWallet6 = new ethers.Wallet(PRIVATE_KEY, ganacheProvider6);

        const deploymentConfig = {
          wallets: {
            [chainId1]: signers[1],
            [chainId2]: ganacheWallet2,
            [chainId3]: ganacheWallet3,
            [chainId4]: ganacheWallet4,
            [chainId5]: ganacheWallet5,
            [chainId6]: ganacheWallet6,
          }
        };
        bridge = await Bridge.deployBridge(bridge6WebbEthInput, deploymentConfig, zkComponents);

        // Should be able to retrieve individual anchors
        const anchorSize = '1000000000000000000';

        // wrap and deposit on the bridge
        nativeDeposit = await bridge.wrapAndDeposit(chainId1, '0x0000000000000000000000000000000000000000', anchorSize, ganacheWallet2);
      });

      it('should be able to withdraw webb tokens even if no deposits on dest chain', async () => {
        const signers = await ethers.getSigners();
        const anchorSize = '1000000000000000000';

        // get the starting balance of webb tokens on dest chain
        const webbTokenAddress = bridge.getWebbTokenAddress(chainId1);
        const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress, signers[2]);
        const webbStartingBalance = await webbToken.getBalance(signers[2].address);

        // withdraw and unwrap from the first native deposit
        const event = await bridge.withdraw(nativeDeposit, anchorSize, signers[2].address, signers[2].address, signers[1]);
        const webbEndingBalance = await webbToken.getBalance(signers[2].address);
        assert.deepEqual(webbEndingBalance.eq(webbStartingBalance.add(anchorSize)), true);
      })
    });

    after('terminate networks', () => {
      ganacheServer2.close(console.error);
      ganacheServer3.close(console.error);
      ganacheServer4.close(console.error);
      ganacheServer5.close(console.error);
      ganacheServer6.close(console.error);
    });
  });
})
