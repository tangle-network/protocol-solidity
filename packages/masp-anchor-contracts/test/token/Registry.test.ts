/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
import '@nomicfoundation/hardhat-chai-matchers';
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { FungibleTokenWrapper } from '@webb-tools/tokens';
import {
  MultiFungibleTokenManager,
  MultiNftTokenManager,
  Registry,
  NftTokenWrapper,
} from '@webb-tools/masp-anchors';

describe('Registry', () => {
  let multiFungibleTokenMgr: MultiFungibleTokenManager;
  let multiNftTokenMgr: MultiNftTokenManager;
  let registry: Registry;
  let sender: SignerWithAddress;
  const wrappedTokenName = 'Wrapped Token';
  const wrappedTokenSymbol = 'wTKN';
  const wrappedTokenURI = 'www.example.com/{id}.json';

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
      expect(
        multiFungibleTokenMgr.contract.registerToken(
          tokenHandler,
          wrappedTokenName,
          wrappedTokenSymbol,
          salt,
          limit,
          feePercentage,
          true,
          sender.address
        )
      ).to.be.revertedWith('MultiTokenManagerBase: Only registry can call this function');
    });

    it('should register a fungible token through the registry', async () => {
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
      assert.strictEqual(
        (await registry.contract.wrappedAssetToId(wrappedTokenAddress)).toNumber(),
        assetIdentifier
      );

      const wrappedToken = FungibleTokenWrapper.connect(wrappedTokenAddress, sender);
      assert.strictEqual(await wrappedToken.contract.name(), wrappedTokenName);
      assert.strictEqual(await wrappedToken.contract.symbol(), wrappedTokenSymbol);
      assert.strictEqual(
        (await wrappedToken.contract.wrappingLimit()).toString(),
        limit.toString()
      );
      assert.strictEqual(await wrappedToken.contract.isNativeAllowed(), true);
    });

    it('should fail to register a token with the same assetIdentifier', async () => {
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

      expect(
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
      ).to.be.revertedWith('Registry: Asset already registered');
    });

    it('should fail to register an asset with an assetIdentifier of 0', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const nonce = 1;
      const tokenHandler = sender.address;
      const assetIdentifier = 0;
      const feePercentage = 0;
      expect(
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
      ).to.be.revertedWith('Registry: Asset identifier cannot be 0');
    });

    it('should register a non fungible token through the registry', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const nonce = 1;
      const tokenHandler = sender.address;
      const assetIdentifier = 2;
      const dummyNftAddress = sender.address;
      await registry.registerNftToken(
        nonce,
        tokenHandler,
        assetIdentifier,
        dummyNftAddress,
        wrappedTokenName,
        wrappedTokenSymbol,
        salt
      );

      const wrappedTokenAddress = await multiNftTokenMgr.contract.wrappedTokens(0);
      assert.strictEqual(
        (await registry.contract.wrappedAssetToId(wrappedTokenAddress)).toNumber(),
        assetIdentifier
      );

      const wrappedToken = NftTokenWrapper.connect(wrappedTokenAddress, sender);
      assert.strictEqual(await wrappedToken.contract.name(), wrappedTokenName);
      assert.strictEqual(await wrappedToken.contract.symbol(), wrappedTokenSymbol);
    });
  });
});
