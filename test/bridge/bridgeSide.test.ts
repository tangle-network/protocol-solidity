/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';

// Convenience wrapper classes for contract classes
import BridgeSide from '../../lib/bridge/BridgeSide';
import Anchor from '../../lib/bridge/Anchor';
import MintableToken from '../../lib/bridge/MintableToken';
import Verifier from '../../lib/bridge/Verifier';
import { fetchComponentsFromFilePaths, getHasherFactory } from '../../lib/bridge/utils';
import { ZkComponents } from '../../lib/bridge/types';

describe('BridgeSideConstruction', () => {

  let zkComponents: ZkComponents;

  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm',
      '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js',
      '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey',
    );
  })

  it('should create the bridge side which can affect the anchor state', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const relayer = signers[1];
    const recipient = signers[1];

    const bridgeSide = BridgeSide.createBridgeSide([relayer.address], 1, 0, 100, admin);

    // Create the Hasher and Verifier for the chain
    const hasherFactory = await getHasherFactory(admin);
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
