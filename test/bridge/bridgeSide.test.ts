/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
const path = require('path');
import { ethers } from 'hardhat';

// Convenience wrapper classes for contract classes
import { Anchor, BridgeSide, Verifier } from '@nepoche/fixed-bridge';
import { MintableToken } from '@nepoche/tokens';
import { fetchComponentsFromFilePaths, ZkComponents } from '@nepoche/utils';
import { PoseidonT3__factory } from '../../typechain';

describe('BridgeSideConstruction', () => {

  let zkComponents: ZkComponents;

  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
    );
  })

  it('should create the bridge side which can affect the anchor state', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const relayer = signers[1];
    const recipient = signers[1];

    const bridgeSide = BridgeSide.createBridgeSide([relayer.address], 1, 0, 100, admin);

    // Create the Hasher and Verifier for the chain
    const hasherFactory = new PoseidonT3__factory(admin);
    let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
    await hasherInstance.deployed();

    const verifier = await Verifier.createVerifier(admin);

    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      '1000000000000',
      30,
      tokenInstance.contract.address,
      admin.address,
      admin.address,
      admin.address,
      5,
      zkComponents,
      admin
    );

    await tokenInstance.approveSpending(anchor.contract.address);
  })

})
