/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
const assert = require('assert');
const path = require('path');
import { ethers } from 'hardhat';
const hre = require('hardhat');
const TruffleAssert = require('truffle-assertions');

import { SignatureBridgeSide } from '@webb-tools/vbridge';
import { VAnchor, AnchorHandler, PoseidonHasher } from '@webb-tools/anchors';
import { Verifier } from '@webb-tools/anchors';
import {
  MintableToken,
  Treasury,
  TreasuryHandler,
  FungibleTokenWrapper,
  TokenWrapperHandler,
} from '@webb-tools/tokens';
import {
  fetchComponentsFromFilePaths,
  getChainIdType,
  vanchorFixtures,
  ZkComponents,
} from '@webb-tools/utils';
import { CircomUtxo, Keypair } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { HARDHAT_PK_1 } from '../../hardhatAccounts.js';
import { VAnchorTree } from '@webb-tools/contracts';

describe('SignatureBridgeSide use', () => {
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  let admin = new ethers.Wallet(HARDHAT_PK_1, ethers.provider);
  let bridgeSide: SignatureBridgeSide<VAnchorTree>;
  let maxEdges = 1;
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const chainID1 = getChainIdType(31337);

  before(async () => {
    zkComponents2_2 = await vanchorFixtures[22]();
    zkComponents16_2 = await vanchorFixtures[162]();
  });

  beforeEach(async () => {
    bridgeSide = await SignatureBridgeSide.createBridgeSide(admin);
  });

  it('should set resource with signature', async () => {
    // Create the Hasher and Verifier for the chain
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(admin);
    const verifier = await Verifier.createVerifier(admin);
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchorHandler = await AnchorHandler.createAnchorHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );
    const anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      30,
      hasherInstance.contract.address,
      anchorHandler.contract.address,
      tokenInstance.contract.address,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      admin
    );
    await tokenInstance.approveSpending(anchor.contract.address, BigNumber.from(1e7));
    bridgeSide.setAnchorHandler(anchorHandler);
    // Function call below sets resource with signature
    await bridgeSide.connectAnchorWithSignature(anchor);
    //Check that proposal nonce is updated on anchor contract since handler prposal has been executed
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toNumber(), 1);
  });

  it('execute anchor proposal', async () => {
    // Create the Hasher and Verifier for the chain
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(admin);

    const verifier = await Verifier.createVerifier(admin);

    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchorHandler = await AnchorHandler.createAnchorHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    const srcAnchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      30,
      hasherInstance.contract.address,
      anchorHandler.contract.address,
      tokenInstance.contract.address,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      admin
    );

    await tokenInstance.approveSpending(srcAnchor.contract.address, BigNumber.from(1e7));

    bridgeSide.setAnchorHandler(anchorHandler);
    const res = await bridgeSide.connectAnchorWithSignature(srcAnchor);

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
      amount: BigNumber.from(1e7).toString(),
      originChainId: chainID1.toString(),
      chainId: chainID1.toString(),
      keypair: new Keypair(),
    });
    // Transact on the bridge
    await srcAnchor.transact([], [depositUtxo], '0', '0', zeroAddress, zeroAddress, '', {
      [chainID1.toString()]: [],
    });
  });

  it('execute fee proposal', async () => {
    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, admin);

    // Create a FungibleTokenWrapper
    const fungibleToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      0,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);
    // Connect resourceID of FungibleTokenWrapper with TokenWrapperHandler
    await bridgeSide.setFungibleTokenResourceWithSignature(fungibleToken);
    // Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(fungibleToken, 5);
    // Check that fee actually changed
    assert.strictEqual((await fungibleToken.contract.getFee()).toString(), '5');
  });

  it('execute cannot set fee > 10000', async () => {
    // Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );
    const treasury = await Treasury.createTreasury(
      treasuryHandler.contract.address,
      bridgeSide.admin
    );

    // Create a FungibleTokenWrapper
    const fungibleToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      0,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    // Connect resourceID of FungibleTokenWrapper with TokenWrapperHandler
    await bridgeSide.setFungibleTokenResourceWithSignature(fungibleToken);

    // Execute change fee proposal
    await TruffleAssert.reverts(
      bridgeSide.executeFeeProposalWithSig(fungibleToken, 10001),
      'FungibleTokenWrapper: Invalid fee percentage'
    );
  });

  it('execute add token proposal', async () => {
    // Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(
      bridgeSide.contract.address,
      [],
      [],
      bridgeSide.admin
    );
    const treasury = await Treasury.createTreasury(
      treasuryHandler.contract.address,
      bridgeSide.admin
    );

    // Create a FungibleTokenWrapper
    const fungibleToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      0,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    // Connect resourceID of FungibleTokenWrapper with TokenWrapperHandler
    await bridgeSide.setFungibleTokenResourceWithSignature(fungibleToken);

    // Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    // Execute Proposal to add that token to the fungibleToken
    await bridgeSide.executeAddTokenProposalWithSig(fungibleToken, tokenInstance.contract.address);

    // Check that fungibleToken contains the added token
    assert((await fungibleToken.contract.getTokens()).includes(tokenInstance.contract.address));
  });

  it('execute remove token proposal', async () => {
    // Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(
      bridgeSide.contract.address,
      [],
      [],
      bridgeSide.admin
    );
    const treasury = await Treasury.createTreasury(
      treasuryHandler.contract.address,
      bridgeSide.admin
    );

    // Create a FungibleTokenWrapper
    const fungibleToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      0,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    // Connect resourceID of FungibleTokenWrapper with TokenWrapperHandler
    await bridgeSide.setFungibleTokenResourceWithSignature(fungibleToken);

    // Add a Token---------

    // Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    // Execute Proposal to add that token to the fungibleToken
    await bridgeSide.executeAddTokenProposalWithSig(fungibleToken, tokenInstance.contract.address);

    // Check that fungibleToken contains the added token
    assert((await fungibleToken.contract.getTokens()).includes(tokenInstance.contract.address));
    // End Add a Token--------

    // Remove a Token
    await bridgeSide.executeRemoveTokenProposalWithSig(
      fungibleToken,
      tokenInstance.contract.address
    );

    assert((await fungibleToken.contract.getTokens()).length === 0);
  });

  it('check nonce is increasing across multiple proposals', async () => {
    // Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(
      bridgeSide.contract.address,
      [],
      [],
      bridgeSide.admin
    );
    const treasury = await Treasury.createTreasury(
      treasuryHandler.contract.address,
      bridgeSide.admin
    );

    // Create a FungibleTokenWrapper
    const fungibleToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      0,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    // Connect resourceID of FungibleTokenWrapper with TokenWrapperHandler
    await bridgeSide.setFungibleTokenResourceWithSignature(fungibleToken);

    // Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(fungibleToken, 5);

    // Check that fee actually changed
    assert.strictEqual((await fungibleToken.contract.getFee()).toString(), '5');
    assert.strictEqual((await fungibleToken.contract.proposalNonce()).toString(), '1');

    // Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    // Execute Proposal to add that token to the fungibleToken
    await bridgeSide.executeAddTokenProposalWithSig(fungibleToken, tokenInstance.contract.address);

    // Check that fungibleToken contains the added token
    assert((await fungibleToken.contract.getTokens()).includes(tokenInstance.contract.address));
    // End Add a Token--------
    assert.strictEqual((await fungibleToken.contract.proposalNonce()).toString(), '2');

    // Remove a Token
    await bridgeSide.executeRemoveTokenProposalWithSig(
      fungibleToken,
      tokenInstance.contract.address
    );

    assert((await fungibleToken.contract.getTokens()).length === 0);
    assert.strictEqual((await fungibleToken.contract.proposalNonce()).toString(), '3');
  });

  it('bridge nonce should update upon setting resource with sig', async () => {
    // Create the Hasher and Verifier for the chain
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(admin);

    const verifier = await Verifier.createVerifier(admin);

    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchorHandler = await AnchorHandler.createAnchorHandler(
      bridgeSide.contract.address,
      [],
      [],
      admin
    );

    const anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      30,
      hasherInstance.contract.address,
      anchorHandler.contract.address,
      tokenInstance.contract.address,
      maxEdges,
      zkComponents2_2,
      zkComponents16_2,
      admin
    );

    await tokenInstance.approveSpending(anchor.contract.address, BigNumber.from(1e7));

    await bridgeSide.setAnchorHandler(anchorHandler);
    // Function call below sets resource with signature
    await bridgeSide.connectAnchorWithSignature(anchor);
    // Check that proposal nonce is updated on anchor contract since handler prposal has been executed
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '1');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '2');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '3');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '4');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '5');
  });
});
