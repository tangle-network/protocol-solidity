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
    assert.strictEqual((await governableInstance.governor()), sender.address);
  });

  it('should transfer the governor', async () => {
    let data = '0xd10151e6c7a528e187e53e615f6c7de8109f9e1e4ca30000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000017c2c0c23f685eab2dbcb0a774d5309f48b41e99cd353726b983ad64a760c212'

    let sig = '0xb3d86463550fbcc432d75483831acc4285b93d6e6871167078d732260ac9c0af0d393a0a4ad5a834114caaf77ec695d209d635aa567913dcc662ae313843279801'
    
    await governableInstance.recover(data, sig);
  });
 });
 