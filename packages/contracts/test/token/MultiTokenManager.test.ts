/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {ethers} from 'hardhat';

// Convenience wrapper classes for contract classes
import {
    ERC20 as ERC20Class,
} from '@webb-tools/tokens';
import {
    MultiTokenManager,
    MultiTokenManager__factory,
} from '../../typechain';
import { BigNumber } from 'ethers';
import { GovernedTokenWrapper } from 'packages/tokens/lib';
 
describe.only('MultiTokenManager', () => {
  let token: ERC20Class;
  let multiTokenMgr: MultiTokenManager;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  let sender: SignerWithAddress;
  const tokenName = 'Token';
  const tokenSymbol = 'TKN';
  const wrappedTokenName = 'Wrapped Token';
  const wrappedTokenSymbol = 'wTKN';

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    token = await ERC20Class.createERC20(tokenName, tokenSymbol, wallet);
    const factory = new MultiTokenManager__factory(wallet);
    multiTokenMgr = await factory.deploy();
    await multiTokenMgr.deployed();
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual((await multiTokenMgr.proposalNonce()).toNumber(), 0);
      assert.strictEqual(await multiTokenMgr.governor(), sender.address);
    });

    it('should create a new token', async() => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const tx = await multiTokenMgr.registerToken(
        wrappedTokenName,
        wrappedTokenSymbol,
        salt,
        limit,
        true,
      );
      const result = await tx.wait();
      console.log(result);
      // const governedToken = await GovernedTokenWrapper.connect(result.., sender);
      // assert.strictEqual(token.name, wrappedTokenName);
      // assert.strictEqual(token.symbol, wrappedTokenSymbol);
    })
  });
});
