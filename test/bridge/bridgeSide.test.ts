/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const assert = require('assert');
const path = require('path');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

// Convenience wrapper classes for contract classes
import { Verifier } from '@webb-tools/bridges';
import { Anchor, AnchorHandler } from '@webb-tools/anchors';
import { BridgeSide } from '../../packages/bridges/src/BridgeSide'
import { MintableToken } from '@webb-tools/tokens';
import { fetchComponentsFromFilePaths, ZkComponents } from '@webb-tools/utils';
import { PoseidonT3__factory } from '../../typechain';
import { GovernedTokenWrapper } from '../../packages/tokens/src/GovernedTokenWrapper';
import { TokenWrapperHandler } from '../../packages/tokens/src/TokenWrapperHandler';

describe('BridgeSideConstruction', () => {

  let zkComponents: ZkComponents;

  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
    );
  })

  it('should create the bridge side which can affect the anchor state', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const relayer = signers[1];
    const recipient = signers[1];

    const bridgeSide = await BridgeSide.createBridgeSide([relayer.address], 1, 0, 100, admin);

    // Create the Hasher and Verifier for the chain
    const hasherFactory = new PoseidonT3__factory(admin);
    let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
    await hasherInstance.deployed();

    const verifier = await Verifier.createVerifier(admin);

    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchorHandler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, [], [], admin);

    const anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      '1000000000000',
      30,
      tokenInstance.contract.address,
      anchorHandler.contract.address,
      5,
      zkComponents,
      admin
    );

    await tokenInstance.approveSpending(anchor.contract.address);

    await bridgeSide.setAnchorHandler(anchorHandler);
    // //Function call below sets resource with signature
    await bridgeSide.connectAnchor(anchor);
    //Check that proposal nonce is updated on anchor contract since handler prposal has been executed
    assert.strictEqual(await anchor.contract.getProposalNonce(), 1);
  })

  it('execute fee proposal bridgeside', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const bridgeSide = await BridgeSide.createBridgeSide([admin.address], 1, 0, 100, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResource(governedToken);

    //Vote on fee Proposal
    await bridgeSide.voteFeeProposal(governedToken, 5);

    //Execute change fee proposal
    await bridgeSide.executeFeeProposal(governedToken, 5);

    //Check that fee actually changed
    assert.strictEqual((await governedToken.contract.getFee()).toString(), '5');
  })

  it('cannot set fee > 100 bridgeside', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const bridgeSide = await BridgeSide.createBridgeSide([admin.address], 1, 0, 100, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResource(governedToken);

    //Vote on fee Proposal
    await bridgeSide.voteFeeProposal(governedToken, 101);

    await TruffleAssert.reverts(
      bridgeSide.executeFeeProposal(governedToken, 101),
      'invalid fee percentage'
    );
  })

  it('execute add token proposal bridgeside', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const bridgeSide = await BridgeSide.createBridgeSide([admin.address], 1, 0, 100, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResource(governedToken);
    
    //Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    //Vote on add token Proposal
    await bridgeSide.voteAddTokenProposal(governedToken, tokenInstance.contract.address);

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposal(governedToken, tokenInstance.contract.address);

    //Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(tokenInstance.contract.address));
  })

  it('execute remove token proposal bridgeside', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const bridgeSide = await BridgeSide.createBridgeSide([admin.address], 1, 0, 100, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResource(governedToken);
    
    //Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    //Vote on fee Proposal
    await bridgeSide.voteAddTokenProposal(governedToken, tokenInstance.contract.address);

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposal(governedToken, tokenInstance.contract.address);

    //Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(tokenInstance.contract.address));

    //Vote on remove token Proposal
    await bridgeSide.voteRemoveTokenProposal(governedToken, tokenInstance.contract.address);

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeRemoveTokenProposal(governedToken, tokenInstance.contract.address);

    assert((await governedToken.contract.getTokens()).length === 0);  
  })

  it('check nonce is incrementing across multiple executions bridgeside', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const bridgeSide = await BridgeSide.createBridgeSide([admin.address], 1, 0, 100, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResource(governedToken);

    //Vote on fee Proposal
    await bridgeSide.voteFeeProposal(governedToken, 5);

    //Execute change fee proposal
    await bridgeSide.executeFeeProposal(governedToken, 5);

    //Check that fee actually changed
    assert.strictEqual((await governedToken.contract.getFee()).toString(), '5');
    //Check nonce
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '1');

    //Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    //Vote on fee Proposal
    await bridgeSide.voteAddTokenProposal(governedToken, tokenInstance.contract.address);

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposal(governedToken, tokenInstance.contract.address);

    //Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(tokenInstance.contract.address));
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '2');

    //Vote on remove token Proposal
    await bridgeSide.voteRemoveTokenProposal(governedToken, tokenInstance.contract.address);

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeRemoveTokenProposal(governedToken, tokenInstance.contract.address);

    assert((await governedToken.contract.getTokens()).length === 0);  
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '3');
  })

  it('nonce should update upon handler proposal executing', async () => {
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const relayer = signers[1];

    const bridgeSide = await BridgeSide.createBridgeSide([relayer.address], 1, 0, 100, admin);

    // Create the Hasher and Verifier for the chain
    const hasherFactory = new PoseidonT3__factory(admin);
    let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
    await hasherInstance.deployed();

    const verifier = await Verifier.createVerifier(admin);

    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchorHandler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, [], [], admin);

    const anchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      '1000000000000',
      30,
      tokenInstance.contract.address,
      anchorHandler.contract.address,
      5,
      zkComponents,
      admin
    );

    await tokenInstance.approveSpending(anchor.contract.address);

    await bridgeSide.setAnchorHandler(anchorHandler);
    // //Function call below sets resource with signature
    await bridgeSide.connectAnchor(anchor);
    //Check that proposal nonce is updated on anchor contract since handler prposal has been executed
    assert.strictEqual(await anchor.contract.getProposalNonce(), 1);

    await bridgeSide.connectAnchor(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 2);

    await bridgeSide.connectAnchor(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 3);

    await bridgeSide.connectAnchor(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 4);
  })

})
