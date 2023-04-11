/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { MaspKey } from '@webb-tools/utils';
import { EdDSA as EdDSAContract, EdDSA__factory } from '@webb-tools/contracts';
const { poseidon, babyjub, eddsa } = require('circomlibjs');

describe('EdDSA', () => {
  let sender;
  let eddsaContract;
  beforeEach(async () => {
    const signers = await ethers.getSigners();
    sender = signers[0];
    const eddsaFactory = await new EdDSA__factory(sender);
    eddsaContract = await eddsaFactory.deploy();
    await eddsaContract.deployed();
  });
  it('should verify a valid signature', async () => {});
});
