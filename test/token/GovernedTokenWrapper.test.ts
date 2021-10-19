/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
 import { ethers } from 'hardhat';
 const TruffleAssert = require('truffle-assertions');
 
 // Convenience wrapper classes for contract classes
 import ERC20Class from '../../lib/darkwebb/ERC20';
 import GovernedTokenWrapperClass from '../../lib/darkwebb/GovernedTokenWrapper';
 
 const helpers = require('../../lib/darkwebb/utils');
 
 describe('Anchor', () => {
  let token: ERC20Class;
  let wrappedToken: GovernedTokenWrapperClass;
  let tokenDenomination = '1000000000000000000' // 1 ether
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
    wrappedToken = await GovernedTokenWrapperClass.createGovernedTokenWrapper(
      wrappedTokenName,
      wrappedTokenSymbol,
      sender.address,
      tokenDenomination,
      false,
      wallet,
    );
  });
 
  describe('#constructor', () => {
    it.only('should initialize', async () => {
      assert.strictEqual((await wrappedToken.contract.name()), wrappedTokenName);
      assert.strictEqual((await wrappedToken.contract.symbol()), wrappedTokenSymbol);
      assert.strictEqual((await wrappedToken.contract.governor()), sender.address);
      assert.strictEqual((await wrappedToken.contract.wrappingLimit()).toString(), tokenDenomination);
      assert.strictEqual((await wrappedToken.contract.totalSupply()).toString(), '0');
    });
  });
 });