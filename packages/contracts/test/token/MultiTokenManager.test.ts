/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';

// Convenience wrapper classes for contract classes
import { ERC20 as ERC20Class, FungibleTokenWrapper } from '@webb-tools/tokens';
import { MultiFungibleTokenManager, Registry } from '@webb-tools/tokens';

describe('MultiFungibleTokenManager', () => {
  let token: ERC20Class;
  let multiTokenMgr: MultiFungibleTokenManager;
  let registry: Registry;
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

    token = await ERC20Class.createERC20PresetMinterPauser(tokenName, tokenSymbol, wallet);
    multiTokenMgr = await MultiFungibleTokenManager.createMultiFungibleTokenManager(
      sender,
    );

    registry = await Registry.createRegistry(sender);
    await registry.initialize(
      multiTokenMgr.contract.address,
      '0',
      sender.address,
      sender.address,
      sender.address,
    );

    assert(registry.contract.initialized(), 'Registry not initialized');
    assert(multiTokenMgr.contract.initialized(), 'MultiTokenManager not initialized');
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual((await multiTokenMgr.contract.proposalNonce()).toNumber(), 0);
      assert.strictEqual(await multiTokenMgr.contract.registry(), sender.address);
      assert.strictEqual(await registry.contract.registryHandler(), sender.address);
    });
  });

  describe('#registerToken', () => {
    it('should fail to register token through the registry', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const nonce = 1;
      const tokenHandler = sender.address;
      const assetIdentifier = 1;
      const feePercentage = 0;
      await expect(
        registry.registerToken(
          nonce,
          tokenHandler,
          assetIdentifier,
          wrappedTokenName,
          wrappedTokenSymbol,
          salt,
          limit,
          feePercentage,
          true
        )
      ).to.be.revertedWith('Only governor can call this function');
    });

    it('should transfer ownership to the registry and register a token', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const nonce = 1;
      const tokenHandler = sender.address;
      const assetIdentifier = 1;
      const feePercentage = 0;
      await multiTokenMgr.setRegistry(registry.contract.address);
      assert.strictEqual(await multiTokenMgr.contract.registry(), registry.contract.address);
      assert.strictEqual(await registry.contract.registryHandler(), sender.address);
      await registry.registerToken(
        nonce,
        tokenHandler,
        assetIdentifier,
        wrappedTokenName,
        wrappedTokenSymbol,
        salt,
        limit,
        feePercentage,
        true
      );
    });

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
        true
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
