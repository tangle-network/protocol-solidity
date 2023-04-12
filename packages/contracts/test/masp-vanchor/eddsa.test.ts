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
import { PoseidonHasher } from '@webb-tools/anchors';
import { Scalar } from "ffjavascript";

describe('EdDSA', () => {
  let hasher;
  let sender;
  let eddsaContract;
  beforeEach(async () => {
    const signers = await ethers.getSigners();
    sender = signers[0];
    const hasher = await PoseidonHasher.createPoseidonHasher(sender)
    const eddsaFactory = await new EdDSA__factory(sender);
    eddsaContract = await eddsaFactory.deploy(hasher.contract.address);
    await eddsaContract.deployed();
  });
  it.only('should verify a valid signature', async () => {
    const maspKey = new MaspKey();
    const message = '0x1234';
    const signature = eddsa.signPoseidon(maspKey.sk, BigInt(message));
    const result = await eddsaContract.Verify(
      maspKey.ak,
      BigInt(message),
      [signature.R8[0], signature.R8[1]],
      signature.S
    );
    assert(result)
  });
});
