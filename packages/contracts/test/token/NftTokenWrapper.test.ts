/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers, expect } from 'hardhat';
import { ERC721 as ERC721Class, NftTokenWrapper as NftTokenWrapperClass } from '@webb-tools/tokens';

describe('NftTokenWrapper', () => {
  let token: ERC721Class;
  let wrappedNft: NftTokenWrapperClass;
  let sender: SignerWithAddress;
  const tokenName = 'Webb Spider Punks';
  const tokenSymbol = 'SPDR';
  const uri = 'https://example.com/token/{id}.json';

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    token = await ERC721Class.createERC721(tokenName, tokenSymbol, sender);
    wrappedNft = await NftTokenWrapperClass.createNftTokenWrapper(uri, sender.address, sender);
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual(await token.contract.name(), tokenName);
      assert.strictEqual(await token.contract.symbol(), tokenSymbol);

      assert.strictEqual((await wrappedNft.contract.proposalNonce()).toNumber(), 0);
      assert.strictEqual(await wrappedNft.contract.handler(), sender.address);
      assert.strictEqual(await wrappedNft.contract.uri(0), 'https://example.com/token/{id}.json');
    });
  });

  describe('#wrap', () => {
    it('should fail to wrap', async () => {
      const nonExistantTokenId = 1;
      await expect(
        wrappedNft.wrap721(nonExistantTokenId, token.contract.address)
      ).to.be.revertedWith('ERC721: invalid token ID');
    });

    it('should wrap/unwrap an ERC721 token with a token id', async () => {
      const tokenId = 1;
      assert.strictEqual(
        (await wrappedNft.contract.balanceOf(sender.address, tokenId)).toNumber(),
        0
      );
      await token.mint(sender.address);
      await token.approve(wrappedNft.contract.address, tokenId);
      await wrappedNft.wrap721(tokenId, token.contract.address);
      assert.strictEqual(
        (await token.contract.balanceOf(wrappedNft.contract.address)).toNumber(),
        1
      );
      assert.strictEqual(
        (await wrappedNft.contract.balanceOf(sender.address, tokenId)).toNumber(),
        1
      );

      await wrappedNft.unwrap721(tokenId, token.contract.address);
      assert.strictEqual(
        (await token.contract.balanceOf(wrappedNft.contract.address)).toNumber(),
        0
      );
      assert.strictEqual(
        (await wrappedNft.contract.balanceOf(sender.address, tokenId)).toNumber(),
        0
      );
      assert.strictEqual((await token.contract.balanceOf(sender.address)).toNumber(), 1);
    });
  });
});
