/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';

// Convenience wrapper classes for contract classes
import { ERC20 as ERC20Class, GovernedTokenWrapper } from '@webb-tools/tokens';
import { MultiGovernedTokenManager } from '../../typechain/MultiGovernedTokenManager';
import { Registrar__factory } from '../../typechain/factories/Registrar__factory';
import { MultiGovernedTokenManager__factory } from '../../typechain/factories/MultiGovernedTokenManager__factory';
import { Registrar } from '../../typechain/Registrar';

describe('MultiGovernedTokenManager', () => {
  let token: ERC20Class;
  let multiTokenMgr: MultiGovernedTokenManager;
  let registry: Registrar;
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
    const factory = new MultiGovernedTokenManager__factory(wallet);
    multiTokenMgr = await factory.deploy();
    await multiTokenMgr.deployed();

    const registryFactory = new Registrar__factory(wallet);
    registry = await registryFactory.deploy();
    await registry.deployed();
    await registry['initialize(address,address)'](multiTokenMgr.address, multiTokenMgr.address);
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual((await multiTokenMgr.proposalNonce()).toNumber(), 0);
      assert.strictEqual(await multiTokenMgr.governor(), sender.address);
      assert.strictEqual(await registry.governor(), sender.address);
    });
  });

  describe('#registerToken', () => {
    it('should fail to register token through the registry', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      await expect(
        registry.registerToken(wrappedTokenName, wrappedTokenSymbol, salt, limit, true)
      ).to.be.revertedWith('Only governor can call this function');
    });

    it('should transfer ownership to the registry and register a token', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      await multiTokenMgr.setGovernor(registry.address);
      assert.strictEqual(await multiTokenMgr.governor(), registry.address);
      assert.strictEqual(await registry.governor(), sender.address);
      await registry.registerToken(wrappedTokenName, wrappedTokenSymbol, salt, limit, true);
    });

    it('should create a new token', async () => {
      const salt = ethers.utils.formatBytes32String('1');
      const limit = ethers.utils.parseEther('1000');
      const tx = await multiTokenMgr.registerToken(
        wrappedTokenName,
        wrappedTokenSymbol,
        salt,
        limit,
        true
      );
      await tx.wait();
      const wrappedTokenAddress = await multiTokenMgr.wrappedTokens(0);
      const wrappedToken = GovernedTokenWrapper.connect(wrappedTokenAddress, sender);
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
