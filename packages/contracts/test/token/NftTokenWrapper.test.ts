/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';

// Convenience wrapper classes for contract classes
import { ERC721Mock as ERC721 } from '../../typechain/ERC721Mock';
import { ERC721Mock__factory as ERC721__factory } from '../../typechain/factories/ERC721Mock__factory';
import { NftTokenWrapper } from '../../typechain/NftTokenWrapper';
import { NftTokenWrapper__factory } from '../../typechain/factories/NftTokenWrapper__factory';

describe('NftTokenManager', () => {
  let token: ERC721;
  let wrappedNft: NftTokenWrapper;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  let sender: SignerWithAddress;
  const tokenName = 'Webb Spider Punks';
  const tokenSymbol = 'SPDR';
  const wrappedTokenName = 'Wrapped Webb Spider Punks';
  const wrappedTokenSymbol = 'wSPDR';

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    const ercFactory = new ERC721__factory(wallet);
    token = await ercFactory.deploy();
    await token.deployed();

    const factory = new NftTokenWrapper__factory(wallet);
    const uri = 'https://example.com/token/{id}.json';
    wrappedNft = await factory.deploy(uri);
    await wrappedNft.deployed();
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual(await token.name(), tokenName);
      assert.strictEqual(await token.symbol(), tokenSymbol);

      assert.strictEqual((await wrappedNft.proposalNonce()).toNumber(), 0);
      assert.strictEqual(await wrappedNft.governor(), sender.address);
      assert.strictEqual(await wrappedNft.uri(0), 'https://example.com/token/{id}.json');
    });
  });

  describe('#wrap', () => {
    it('should fail to wrap', async () => {
      const nonExistantTokenId = 1;
      await expect(wrappedNft.wrap721(nonExistantTokenId, token.address)).to.be.revertedWith(
        'ERC721: invalid token ID'
      );
    });

    it('should wrap/unwrap an ERC721 token with a token id', async () => {
      const tokenId = 1;
      assert.strictEqual((await wrappedNft.balanceOf(sender.address, tokenId)).toNumber(), 0);
      await token.mint(sender.address);
      await token.approve(wrappedNft.address, tokenId);
      await wrappedNft.wrap721(tokenId, token.address);
      assert.strictEqual((await token.balanceOf(wrappedNft.address)).toNumber(), 1);
      assert.strictEqual((await wrappedNft.balanceOf(sender.address, tokenId)).toNumber(), 1);

      await wrappedNft.unwrap721(tokenId, token.address);
      assert.strictEqual((await token.balanceOf(wrappedNft.address)).toNumber(), 0);
      assert.strictEqual((await wrappedNft.balanceOf(sender.address, tokenId)).toNumber(), 0);
      assert.strictEqual((await token.balanceOf(sender.address)).toNumber(), 1);
    });
  });
});
