/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { ERC20 as ERC20Class, FungibleTokenWrapper } from '@webb-tools/tokens';
import { MultiFungibleTokenManager } from '@webb-tools/masp-anchors';

describe('MultiFungibleTokenManager', () => {
  let token: ERC20Class;
  let multiTokenMgr: MultiFungibleTokenManager;
  let sender: SignerWithAddress;
  const tokenName = 'Token';
  const tokenSymbol = 'TKN';
  const wrappedTokenName = 'Wrapped Token';
  const wrappedTokenSymbol = 'wTKN';

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    token = await ERC20Class.createERC20PresetMinterPauser(tokenName, tokenSymbol, wallet);
    multiTokenMgr = await MultiFungibleTokenManager.createMultiFungibleTokenManager(sender);
    assert(multiTokenMgr.contract.initialized(), 'MultiTokenManager not initialized');
    await multiTokenMgr.initialize(sender.address, sender.address);
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual((await multiTokenMgr.contract.proposalNonce()).toNumber(), 0);
      assert.strictEqual(await multiTokenMgr.contract.registry(), sender.address);
    });
  });

  describe('#registerToken', () => {
    it('should create a new token', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const tokenHandler = sender.address;
      const feePercentage = 0;
      const tx = await multiTokenMgr.contract.registerToken(
        tokenHandler,
        wrappedTokenName,
        wrappedTokenSymbol,
        salt,
        limit,
        feePercentage,
        true,
        sender.address
      );
      await tx.wait();
      const wrappedTokenAddress = await multiTokenMgr.contract.wrappedTokens(0);
      const wrappedToken = FungibleTokenWrapper.connect(wrappedTokenAddress, sender);
      assert.strictEqual(await wrappedToken.contract.name(), wrappedTokenName);
      assert.strictEqual(await wrappedToken.contract.symbol(), wrappedTokenSymbol);
      assert.strictEqual(
        (await wrappedToken.contract.wrappingLimit()).toString(),
        limit.toString()
      );
      assert.strictEqual(await wrappedToken.contract.isNativeAllowed(), true);
    });
  });
});
