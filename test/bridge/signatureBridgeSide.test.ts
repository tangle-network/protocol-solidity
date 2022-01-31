/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 const TruffleAssert = require('truffle-assertions');
 
 // Convenience wrapper classes for contract classes
 import { Verifier, SignatureBridgeSide } from '../../packages/bridges/src';
 import { Anchor, AnchorHandler } from '../../packages/anchors/src';
 import { MintableToken, Treasury, TreasuryHandler } from '../../packages/tokens/src';
 import { fetchComponentsFromFilePaths, ZkComponents } from '../../packages/utils/src';
 import { PoseidonT3__factory } from '../../packages/contracts';
 import { GovernedTokenWrapper, TokenWrapperHandler } from '../../packages/tokens/src';
 
 describe('SignatureBridgeSideConstruction', () => {
 
   let zkComponents: ZkComponents;
 
   before(async () => {
     zkComponents = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
     );
   })
 
   it('should create the signature bridge side which can affect the anchor state', async () => {
     const signers = await ethers.getSigners();
     const initialGovernor = signers[1];
     const admin = signers[1];
     const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);
   })

   it('should set resource with signature', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

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
    await bridgeSide.connectAnchorWithSignature(anchor);
    //Check that proposal nonce is updated on anchor contract since handler prposal has been executed
    assert.strictEqual(await anchor.contract.getProposalNonce(), 1);
  })
 
  it('execute anchor proposal', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

    // Create the Hasher and Verifier for the chain
    const hasherFactory = new PoseidonT3__factory(admin);
    let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
    await hasherInstance.deployed();

    const verifier = await Verifier.createVerifier(admin);

    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    const anchorHandler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, [], [], admin);

    const sourceAnchor = await Anchor.createAnchor(
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

    const destAnchor = await Anchor.createAnchor(
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

    await tokenInstance.approveSpending(destAnchor.contract.address);
    await tokenInstance.approveSpending(sourceAnchor.contract.address);

    await bridgeSide.setAnchorHandler(anchorHandler);
    bridgeSide.setResourceWithSignature(destAnchor);
    await sourceAnchor.deposit(await admin.getChainId());
    const destResourceID = await destAnchor.createResourceId();
    await bridgeSide.executeAnchorProposalWithSig(sourceAnchor, destResourceID);
  })

  it('execute fee proposal', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], admin);
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, admin);
    bridgeSide.setTreasuryHandler(treasuryHandler);

    // Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);
    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);
    //Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(governedToken, 5);
    //Check that fee actually changed
    assert.strictEqual((await governedToken.contract.getFee()).toString(), '5');
  })

  it('execute cannot set fee > 100', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], admin);
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, bridgeSide.admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);

    //Execute change fee proposal
    await TruffleAssert.reverts(
      bridgeSide.executeFeeProposalWithSig(governedToken, 101),
      'invalid fee percentage'
    );
  })

  it('execute add token proposal', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], bridgeSide.admin);
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, bridgeSide.admin);
    
    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);

    //Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposalWithSig(governedToken, tokenInstance.contract.address);

    //Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(tokenInstance.contract.address));
  })

  it('execute remove token proposal', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], bridgeSide.admin);
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, bridgeSide.admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);


    // Add a Token---------

    //Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposalWithSig(governedToken, tokenInstance.contract.address);

    //Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(tokenInstance.contract.address));
    //End Add a Token--------

    //Remove a Token
    await bridgeSide.executeRemoveTokenProposalWithSig(governedToken, tokenInstance.contract.address);

    assert((await governedToken.contract.getTokens()).length === 0);  
  })

  it('check nonce is increasing across multiple proposals', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], bridgeSide.admin);
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, bridgeSide.admin);

    //Create a GovernedTokenWrapper
    const governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      treasury.contract.address,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      false,
      admin,
    );

    //Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    //Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);

    //Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(governedToken, 5);

    //Check that fee actually changed
    assert.strictEqual((await governedToken.contract.getFee()).toString(), '5');
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '1');

    //Create an ERC20 Token
    const tokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await tokenInstance.mintTokens(admin.address, '100000000000000000000000');

    //Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposalWithSig(governedToken, tokenInstance.contract.address);

    //Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(tokenInstance.contract.address));
    //End Add a Token--------
assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '2');

    //Remove a Token
    await bridgeSide.executeRemoveTokenProposalWithSig(governedToken, tokenInstance.contract.address);

    assert((await governedToken.contract.getTokens()).length === 0);  
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '3');
  })


  it('nonce should update upon handler proposal executing', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, admin);

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
    await bridgeSide.connectAnchorWithSignature(anchor);
    //Check that proposal nonce is updated on anchor contract since handler prposal has been executed
    assert.strictEqual(await anchor.contract.getProposalNonce(), 1);

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 2);

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 3);

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 4);

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual(await anchor.contract.getProposalNonce(), 5);
  })


 })