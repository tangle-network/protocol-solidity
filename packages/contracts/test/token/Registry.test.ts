/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import {
  FungibleTokenWrapper,
  MultiNftTokenManager,
  MultiFungibleTokenManager,
  Registry,
} from '@webb-tools/tokens';

describe('Registry', () => {
  let multiFungibleTokenMgr: MultiFungibleTokenManager;
  let multiNftTokenMgr: MultiNftTokenManager;
  let registry: Registry;
  let sender: SignerWithAddress;
  const tokenName = 'Token';
  const tokenSymbol = 'TKN';
  const wrappedTokenName = 'Wrapped Token';
  const wrappedTokenSymbol = 'wTKN';

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    multiFungibleTokenMgr = await MultiFungibleTokenManager.createMultiFungibleTokenManager(sender);
    multiNftTokenMgr = await MultiNftTokenManager.createMultiNftTokenManager(sender);
    registry = await Registry.createRegistry(sender);
    await registry.initialize(
      multiFungibleTokenMgr.contract.address,
      multiNftTokenMgr.contract.address,
      sender.address,
      sender.address,
      sender.address
    );

    assert(registry.contract.initialized(), 'Registry not initialized');
    assert(multiFungibleTokenMgr.contract.initialized(), 'MultiTokenManager not initialized');
    assert(multiNftTokenMgr.contract.initialized(), 'MultiNftTokenManager not initialized');
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual(await registry.contract.registryHandler(), sender.address);
      assert.strictEqual(
        await registry.contract.fungibleTokenManager(),
        multiFungibleTokenMgr.contract.address
      );
      assert.strictEqual(
        await registry.contract.nonFungibleTokenManager(),
        multiNftTokenMgr.contract.address
      );
    });
  });

  describe('#registerToken', () => {
    it('should not work to register a token with a non-registry', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const nonce = 1;
      const tokenHandler = sender.address;
      const assetIdentifier = 1;
      const feePercentage = 0;
      expect(multiFungibleTokenMgr.contract.registerToken(
        tokenHandler,
        wrappedTokenName,
        wrappedTokenSymbol,
        salt,
        limit,
        feePercentage,
        true
      )).to.be.revertedWith('MultiTokenManagerBase: Only registry can call this function');
    });

    it('should register token through the registry', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const nonce = 1;
      const tokenHandler = sender.address;
      const assetIdentifier = 1;
      const feePercentage = 0;
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

      const wrappedTokenAddress = await multiFungibleTokenMgr.contract.wrappedTokens(0);
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
