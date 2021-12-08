/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 
 // Convenience wrapper classes for contract classes
 import { GovernedTokenWrapper } from '@webb-tools/tokens';
 import { Governable__factory } from '../../typechain';
 
 describe('Governable Contract', () => {
  let governableInstance;
  let sender;
  let nextGovernor;

  before(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    nextGovernor = signers[1];
    // create poseidon hasher
    const govFactory = new Governable__factory(wallet);
    governableInstance = await govFactory.deploy();
    await governableInstance.deployed();
  });
 
  it.only('should check governor', async () => {
    assert.strictEqual((await governableInstance.contract.governor()), sender.address);
  });

  it('should transfer the governor', async () => {
    return;
  });
 });
 