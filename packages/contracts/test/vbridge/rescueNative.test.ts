/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
const assert = require('assert');
const path = require('path');
import { ethers } from 'hardhat';

import { SignatureBridgeSide } from '@webb-tools/vbridge';
import { VAnchor, AnchorHandler, PoseidonHasher } from '@webb-tools/anchors';
import { Verifier } from '@webb-tools/anchors';
import {
  Treasury,
  TreasuryHandler,
  FungibleTokenWrapper,
  TokenWrapperHandler,
} from '@webb-tools/tokens';
import { getChainIdType, vanchorFixtures, ZkComponents } from '@webb-tools/utils';
import { CircomUtxo, Keypair } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { HARDHAT_PK_1 } from '../../hardhatAccounts.js';
import { VAnchorTree } from '@webb-tools/contracts';

describe('Rescue Tokens Tests for Native ETH', () => {
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  let srcAnchor: VAnchor;
  let anchorHandler: AnchorHandler;
  let admin = new ethers.Wallet(HARDHAT_PK_1, ethers.provider);
  let bridgeSide: SignatureBridgeSide<VAnchorTree>;
  let wrappingFee: number;
  let signers;
  let fungibleToken: FungibleTokenWrapper;
  let treasury;
  let treasuryHandler;
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const chainID1 = getChainIdType(31337);
  let maxEdges = 1;

  before(async () => {
    zkComponents2_2 = await vanchorFixtures[22]();
    zkComponents16_2 = await vanchorFixtures[162]();
  });

  beforeEach(async () => {
    signers = await ethers.getSigners();
    bridgeSide = await SignatureBridgeSide.createBridgeSide(admin);

    // Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    // Create Treasury and TreasuryHandler
    treasuryHandler = await TreasuryHandler.createTreasuryHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );
    treasury = await Treasury.createTreasury(treasuryHandler.contract.address, admin);
    await bridgeSide.setTreasuryHandler(treasuryHandler);
    await bridgeSide.setTreasuryResourceWithSignature(treasury);

    // Create a FungibleTokenWrapper
    fungibleToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      0,
      admin.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      true,
      admin
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    // Connect resourceID of FungibleTokenWrapper with TokenWrapperHandler
    await bridgeSide.setFungibleTokenResourceWithSignature(fungibleToken);

    wrappingFee = 10;
    // Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(fungibleToken, wrappingFee);

    // Check that fee actually changed
    assert.strictEqual((await fungibleToken.contract.getFee()).toString(), '10');

    // Create an anchor whose token is the fungibleToken
    // Wrap and Deposit ERC20 liquidity into that anchor

    // Create the Hasher and Verifier for the chain
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(admin);

    const verifier = await Verifier.createVerifier(admin);

    anchorHandler = await AnchorHandler.createAnchorHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    let depositAmount = 1e7;
    srcAnchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      30,
      hasherInstance.contract.address,
      anchorHandler.contract.address,
      fungibleToken.contract.address,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      admin
    );

    await fungibleToken.grantMinterRole(srcAnchor.contract.address);
    bridgeSide.setAnchorHandler(anchorHandler);
    // Connect resourceID of srcAnchor with AnchorHandler on the SignatureBridge
    await bridgeSide.setAnchorResourceWithSignature(srcAnchor);
    await bridgeSide.executeMinWithdrawalLimitProposalWithSig(
      srcAnchor,
      BigNumber.from(0).toString()
    );
    await bridgeSide.executeMaxDepositLimitProposalWithSig(
      srcAnchor,
      BigNumber.from(1e8).toString()
    );

    // Define inputs/outputs for transact function
    const depositUtxo = await CircomUtxo.generateUtxo({
      curve: 'Bn254',
      backend: 'Circom',
      amount: depositAmount.toString(),
      originChainId: chainID1.toString(),
      chainId: chainID1.toString(),
      keypair: new Keypair(),
    });

    // Change Fee Recipient to treasury Address
    await bridgeSide.executeFeeRecipientProposalWithSig(fungibleToken, treasury.contract.address);

    // For Native ETH Tests
    await srcAnchor.transact([], [depositUtxo], '0', '0', zeroAddress, zeroAddress, zeroAddress, {
      [chainID1.toString()]: [],
    });

    // Anchor Denomination amount should go to TokenWrapper
    assert.strictEqual(
      (await ethers.provider.getBalance(fungibleToken.contract.address)).toString(),
      depositAmount.toString()
    );

    // The wrapping fee should be transferred to the treasury
    assert.strictEqual(
      (await ethers.provider.getBalance(treasury.contract.address)).toString(),
      parseInt((depositAmount * (wrappingFee / (10000 - wrappingFee))).toString()).toString()
    );

    assert.strictEqual(
      (await fungibleToken.contract.balanceOf(srcAnchor.contract.address)).toString(),
      depositAmount.toString()
    );
  });

  it('should rescue native eth', async () => {
    let balTreasuryBeforeRescue = await ethers.provider.getBalance(treasury.contract.address);
    let to = signers[2].address;
    let balToBeforeRescue = await ethers.provider.getBalance(to);

    await bridgeSide.executeRescueTokensProposalWithSig(
      treasury,
      zeroAddress,
      to,
      BigNumber.from('500')
    );

    let balTreasuryAfterRescue = await ethers.provider.getBalance(treasury.contract.address);
    let balToAfterRescue = await ethers.provider.getBalance(to);

    assert.strictEqual(balTreasuryBeforeRescue.sub(balTreasuryAfterRescue).toString(), '500');

    assert.strictEqual(balToAfterRescue.sub(balToBeforeRescue).toString(), '500');

    assert.strictEqual((await treasury.contract.proposalNonce()).toString(), '1');
  });

  it('should rescue all native eth when amountToRescue greater than treasury balance', async () => {
    let balTreasuryBeforeRescue = await ethers.provider.getBalance(treasury.contract.address);
    let to = signers[2].address;
    let balToBeforeRescue = await ethers.provider.getBalance(to);

    await bridgeSide.executeRescueTokensProposalWithSig(
      treasury,
      zeroAddress,
      to,
      BigNumber.from('500000000000000')
    );

    let balTreasuryAfterRescue = await ethers.provider.getBalance(treasury.contract.address);
    let balToAfterRescue = await ethers.provider.getBalance(to);

    // balTreasuryAfterRescue = 0
    assert.strictEqual(
      balTreasuryBeforeRescue.sub(balTreasuryAfterRescue).toString(),
      balTreasuryBeforeRescue.toString()
    );

    // Should be balTreasuryBeforeRescue, since all tokens are transferred to the to address
    assert.strictEqual(
      balToAfterRescue.sub(balToBeforeRescue).toString(),
      balTreasuryBeforeRescue.toString()
    );

    assert.strictEqual((await treasury.contract.proposalNonce()).toString(), '1');
  });
});
