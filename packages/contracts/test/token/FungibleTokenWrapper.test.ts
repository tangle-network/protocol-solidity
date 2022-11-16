/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';

// Convenience wrapper classes for contract classes
import {
  ERC20 as ERC20Class,
  FungibleTokenWrapper as FungibleTokenWrapperClass,
} from '@webb-tools/tokens';

describe('FungibleTokenWrapper', () => {
  let token: ERC20Class;
  let wrappedToken: FungibleTokenWrapperClass;
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
    const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
    wrappedToken = await FungibleTokenWrapperClass.createFungibleTokenWrapper(
      wrappedTokenName,
      wrappedTokenSymbol,
      0,
      dummyFeeRecipient,
      sender.address,
      tokenDenomination,
      false,
      wallet
    );
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual(await wrappedToken.contract.name(), wrappedTokenName);
      assert.strictEqual(await wrappedToken.contract.symbol(), wrappedTokenSymbol);
      assert.strictEqual(await wrappedToken.contract.handler(), sender.address);
      assert.strictEqual(
        (await wrappedToken.contract.wrappingLimit()).toString(),
        tokenDenomination
      );
      assert.strictEqual((await wrappedToken.contract.totalSupply()).toString(), '0');
    });

    it('should properly calculate amountToWrap', async () => {
      const webbWrappedTokenContract = wrappedToken.contract;
      let tx = await webbWrappedTokenContract.setFee(1, 1);
      await tx.wait();
      let amountToWrap = await webbWrappedTokenContract.getAmountToWrap(
        ethers.utils.parseEther('1')
      );

      assert.strictEqual(
        amountToWrap.toString(),
        ethers.BigNumber.from('1000100010001000100').toString()
      );
    });
  });
});
