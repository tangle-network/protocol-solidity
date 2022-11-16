/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
const hre = require('hardhat');
const { BigNumber } = require('ethers');
const bne = (x, e) => BigNumber.from(x + '0'.repeat(parseInt(e)));

// Convenience wrapper classes for contract classes
import { ERC20 as ERC20Class } from '@webb-tools/tokens';
import { IERC20 } from '../../typechain/IERC20';
import { AaveTokenWrapper } from '../../typechain/AaveTokenWrapper';
import { AaveTokenWrapper__factory } from '../../typechain/factories/AaveTokenWrapper__factory';
import { expect } from 'chai';

describe('AaveTokenWrapper', () => {
  let token: ERC20Class;
  let aaveToken: AaveTokenWrapper;
  let sender: SignerWithAddress;
  const tokenName = 'Token';
  const tokenSymbol = 'TKN';
  const aaveTokenName = 'Wrapped Token';
  const aaveTokenSymbol = 'wTKN';
  const aaveLendingPoolAddress = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
  let USDCAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  let aUSDCAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const DAIAddress = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
  const daiWhaleAddress = '0xf977814e90da44bfa03b6295a0616a897441acec';
  let aDAIAddress = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
  let usdc: IERC20;
  let dai: IERC20;
  let aUSDC: IERC20;
  let aDAI: IERC20;
  let signers: any;
  let daiWhaleSigner: SignerWithAddress;
  let aaveLendingPool: any;
  let aaveTokenSigner: SignerWithAddress;

  beforeEach(async () => {
    signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    const factory = new AaveTokenWrapper__factory(wallet);

    token = await ERC20Class.createERC20(tokenName, tokenSymbol, wallet);
    const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';

    // Get contracts
    aaveLendingPool = await ethers.getContractAt('IAaveLendingPool', aaveLendingPoolAddress);
    usdc = await ethers.getContractAt('IERC20', USDCAddress);
    dai = await ethers.getContractAt('IERC20', DAIAddress);
    aUSDC = await ethers.getContractAt('IERC20', aUSDCAddress);
    aDAI = await ethers.getContractAt('IERC20', aDAIAddress);
    aaveToken = await factory.deploy(aaveTokenName, aaveTokenSymbol, aaveLendingPool.address);
    await aaveToken.deployed();

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [daiWhaleAddress],
    });
    daiWhaleSigner = await ethers.getSigner(daiWhaleAddress);

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [aaveToken.address.toString()],
    });
    aaveTokenSigner = await ethers.getSigner(aaveToken.address.toString());
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      assert.strictEqual(await aaveToken.name(), aaveTokenName);
      assert.strictEqual(await aaveToken.symbol(), aaveTokenSymbol);
      assert.strictEqual(await aaveToken.governor(), sender.address);
      assert.strictEqual((await aaveToken.aaveLendingPool()).toString(), aaveLendingPoolAddress);
    });

    it('should do a basic deposit for DAI', async () => {
      let depositAmount = bne(10, 6);
      const daiBalanceAaveTokenInitial = await dai.balanceOf(aaveToken.address);
      await dai.connect(daiWhaleSigner).transfer(aaveToken.address, depositAmount);
      const daiBalancePoolPreDeposit = await dai.balanceOf(aaveToken.address);

      await aaveToken.deposit(dai.address, depositAmount);
      const daiBalancePoolPostDeposit = await dai.balanceOf(aaveToken.address);
      const aDAIBalancePoolPostDeposit = await aDAI.balanceOf(aaveToken.address);
      expect(daiBalancePoolPostDeposit).to.be.equal(0);
      expect(aDAIBalancePoolPostDeposit).to.equal(depositAmount);
    });

    it('should do a basic withdrawal for DAI', async () => {
      let depositAmount = bne(10, 18);
      const daiBalanceAaveTokenInitial = await dai.balanceOf(aaveToken.address);
      await dai.connect(daiWhaleSigner).transfer(aaveToken.address, depositAmount);
      await aaveToken.deposit(dai.address, depositAmount);

      await aaveToken.withdraw(dai.address, depositAmount);

      const daiBalancePoolPostWithdraw = await dai.balanceOf(aaveToken.address);
      const aDAIBalancePoolPostWithdraw = await aDAI.balanceOf(aaveToken.address);
      expect(daiBalancePoolPostWithdraw).to.be.equal(depositAmount);
      expect(aDAIBalancePoolPostWithdraw).to.be.lt(bne(10, 12));
    });
  });
});
