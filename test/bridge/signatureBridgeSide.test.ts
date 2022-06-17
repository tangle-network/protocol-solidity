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
import { fetchComponentsFromFilePaths, getChainIdType, ZkComponents } from '../../packages/utils/src';
import { PoseidonT3__factory } from '../../packages/contracts';
import { GovernedTokenWrapper, TokenWrapperHandler } from '../../packages/tokens/src';
import { BigNumber, Wallet } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
 
describe('SignatureBridgeSideConstruction', () => {
 
  let zkComponents: ZkComponents;
 
  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
    );
  })

  it('should create the signature bridge side which can affect the anchor state', async () => {
    const wallet = ethers.Wallet.createRandom();
    const initialGovernor = wallet;
    const signers = await ethers.getSigners();
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor, admin);
  })
});

describe('SignatureBridgeSide use', () => {

  let zkComponents: ZkComponents;
  let wallet: Wallet;
  let initialGovernor: Wallet;
  let admin: SignerWithAddress;
  let signers: SignerWithAddress[];
  let bridgeSide: SignatureBridgeSide;

  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
    );
    signers = await ethers.getSigners();
  })

  beforeEach(async () => {
    wallet = ethers.Wallet.createRandom();
    initialGovernor = wallet;
    admin = signers[1];
    bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor, admin);
  })

  it('should set resource with signature', async () => {
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
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toNumber(), 1);
  })
 
  it('execute anchor proposal', async () => {
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
    //Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create Treasury and TreasuryHandler
    const treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], admin);
    const treasury = await Treasury.createTreasury(treasuryHandler.contract.address, admin);
    await bridgeSide.setTreasuryHandler(treasuryHandler);

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


  it('bridge nonce should update upon setting resource with sig', async () => {
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
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '1');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '2');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '3');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '4');

    await bridgeSide.connectAnchorWithSignature(anchor);
    assert.strictEqual((await bridgeSide.contract.proposalNonce()).toString(), '5');
  })
 })

 describe('Rescue Tokens Tests for ERC20 Tokens', () => {
  let zkComponents: ZkComponents;
  let sourceAnchor: Anchor;
  let anchorHandler: AnchorHandler;
  let erc20TokenInstance: MintableToken;
  let bridgeSide: SignatureBridgeSide;
  let wrappingFee: number;
  let signers;
  let governedToken;
  let treasuryHandler;
  let treasury;
  const zeroAddress = "0x0000000000000000000000000000000000000000";

 
  before(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
    );
  })

  beforeEach(async() => {
    const wallet = ethers.Wallet.createRandom();
    const initialGovernor = wallet;
    signers = await ethers.getSigners();
    const admin = signers[1];
    bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor, admin);

    // Create Treasury and TreasuryHandler
    treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], admin);
    treasury = await Treasury.createTreasury(treasuryHandler.contract.address, admin);
    await bridgeSide.setTreasuryHandler(treasuryHandler);
    await bridgeSide.setTreasuryResourceWithSignature(treasury);

    // Deploy TokenWrapperHandler
    const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

    // Create ERC20 Token
    erc20TokenInstance = await MintableToken.createToken('testToken', 'TEST', admin);
    await erc20TokenInstance.mintTokens(admin.address, '100000000000000000000000');

    // Create a GovernedTokenWrapper
    governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
      `webbETH-test-1`,
      `webbETH-test-1`,
      zeroAddress,
      tokenWrapperHandler.contract.address,
      '10000000000000000000000000',
      true,
      admin,
    );

    // Set bridgeSide handler to tokenWrapperHandler
    bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

    // Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
    await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);

    wrappingFee = 10;
    // Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(governedToken, wrappingFee);

    // Check that fee actually changed
    assert.strictEqual((await governedToken.contract.getFee()).toString(), '10');
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '1');

    // Execute Proposal to add that token to the governedToken
    await bridgeSide.executeAddTokenProposalWithSig(governedToken, erc20TokenInstance.contract.address);

    // Check that governedToken contains the added token
    assert((await governedToken.contract.getTokens()).includes(erc20TokenInstance.contract.address));
    
    assert.strictEqual((await governedToken.contract.proposalNonce()).toString(), '2');

    // Create an anchor whose token is the governedToken
    // Wrap and Deposit ERC20 liquidity into that anchor

    // Create the Hasher and Verifier for the chain
    const hasherFactory = new PoseidonT3__factory(admin);
    let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
    await hasherInstance.deployed();

    const verifier = await Verifier.createVerifier(admin);

    anchorHandler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, [], [], admin);

    let anchorDenomination = 1000000000000;
    sourceAnchor = await Anchor.createAnchor(
      verifier.contract.address,
      hasherInstance.address,
      anchorDenomination.toString(),
      30,
      governedToken.contract.address,
      anchorHandler.contract.address,
      5,
      zkComponents,
      admin
    );

    await governedToken.grantMinterRole(sourceAnchor.contract.address);
    await erc20TokenInstance.approveSpending(governedToken.contract.address);
    await erc20TokenInstance.approveSpending(sourceAnchor.contract.address);
    
    await TruffleAssert.reverts(
     sourceAnchor.wrapAndDeposit(erc20TokenInstance.contract.address, wrappingFee, getChainIdType(await admin.getChainId())),
     'Fee Recipient cannot be zero address'
    ); 

    // Change Fee Recipient to treasury Address
    await bridgeSide.executeFeeRecipientProposalWithSig(governedToken, treasury.contract.address);

    // For ERC20 Tests
    await sourceAnchor.wrapAndDeposit(erc20TokenInstance.contract.address, wrappingFee, getChainIdType(await admin.getChainId()));

    // Anchor Denomination amount should go to TokenWrapper
    assert.strictEqual((await erc20TokenInstance.getBalance(governedToken.contract.address)).toString(), anchorDenomination.toString());

    // The wrapping fee should be transferred to the treasury
    assert.strictEqual((await erc20TokenInstance.getBalance(treasury.contract.address)).toString(), parseInt((anchorDenomination * (wrappingFee / (100 - wrappingFee))).toString()).toString());

    assert.strictEqual((await governedToken.contract.balanceOf(sourceAnchor.contract.address)).toString(), anchorDenomination.toString());
  })

  it('should rescue tokens', async () => {
   let balTreasuryBeforeRescue = await erc20TokenInstance.getBalance(treasury.contract.address);
   let to = signers[2].address;
   let balToBeforeRescue = await erc20TokenInstance.getBalance(to);

   await bridgeSide.executeRescueTokensProposalWithSig(treasury, erc20TokenInstance.contract.address, to, BigNumber.from('500'));

   let balTreasuryAfterRescue = await erc20TokenInstance.getBalance(treasury.contract.address);
   let balToAfterRescue = await erc20TokenInstance.getBalance(to);

   assert.strictEqual(balTreasuryBeforeRescue.sub(balTreasuryAfterRescue).toString(),'500');

   assert.strictEqual(balToAfterRescue.sub(balToBeforeRescue).toString(),'500');

   assert.strictEqual((await treasury.contract.proposalNonce()).toString(), '1');
  })
  
  it('should rescue all tokens when amount to rescue is larger than treasury balance', async () => {
   let balTreasuryBeforeRescue = await erc20TokenInstance.getBalance(treasury.contract.address);
   let to = signers[2].address;
   let balToBeforeRescue = await erc20TokenInstance.getBalance(to);

   await bridgeSide.executeRescueTokensProposalWithSig(treasury, erc20TokenInstance.contract.address, to, BigNumber.from('500000000000000000000000'));

   let balTreasuryAfterRescue = await erc20TokenInstance.getBalance(treasury.contract.address);
   let balToAfterRescue = await erc20TokenInstance.getBalance(to);

   // balTreasuryAfterRescue = 0
   assert.strictEqual(balTreasuryBeforeRescue.sub(balTreasuryAfterRescue).toString(), balTreasuryBeforeRescue.toString());

   // Should be balTreasuryBeforeRescue, since all tokens are transferred to the to address
   assert.strictEqual(balToAfterRescue.sub(balToBeforeRescue).toString(),balTreasuryBeforeRescue.toString());

   assert.strictEqual((await treasury.contract.proposalNonce()).toString(), '1');
  })
})

describe('Rescue Tokens Tests for Native ETH', () => {
 let zkComponents: ZkComponents;
 let sourceAnchor: Anchor;
 let destAnchor: Anchor;
 let anchorHandler: AnchorHandler;
 let erc20TokenInstance: MintableToken;
 let bridgeSide: SignatureBridgeSide;
 let wrappingFee: number;
 let signers;
 let governedToken;
 let treasury;
 let treasuryHandler;
 const zeroAddress = "0x0000000000000000000000000000000000000000";

 before(async () => {
   zkComponents = await fetchComponentsFromFilePaths(
     path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
     path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
     path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
   );
 })

 beforeEach(async() => {
   const wallet = ethers.Wallet.createRandom();
   const initialGovernor = wallet;
   signers = await ethers.getSigners();
   const admin = signers[1];
   bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor, admin);

   // Deploy TokenWrapperHandler
   const tokenWrapperHandler = await TokenWrapperHandler.createTokenWrapperHandler(bridgeSide.contract.address, [], [], admin);

   // Create Treasury and TreasuryHandler
   treasuryHandler = await TreasuryHandler.createTreasuryHandler(bridgeSide.contract.address, [],[], admin);
   treasury = await Treasury.createTreasury(treasuryHandler.contract.address, admin);
   await bridgeSide.setTreasuryHandler(treasuryHandler);
   await bridgeSide.setTreasuryResourceWithSignature(treasury);

   // Create a GovernedTokenWrapper
   governedToken = await GovernedTokenWrapper.createGovernedTokenWrapper(
     `webbETH-test-1`,
     `webbETH-test-1`,
     zeroAddress,
     tokenWrapperHandler.contract.address,
     '10000000000000000000000000',
     true,
     admin,
   );

   // Set bridgeSide handler to tokenWrapperHandler
   bridgeSide.setTokenWrapperHandler(tokenWrapperHandler);

   // Connect resourceID of GovernedTokenWrapper with TokenWrapperHandler
   await bridgeSide.setGovernedTokenResourceWithSignature(governedToken);

   wrappingFee = 10;
   // Execute change fee proposal
   await bridgeSide.executeFeeProposalWithSig(governedToken, wrappingFee);

   // Check that fee actually changed
   assert.strictEqual((await governedToken.contract.getFee()).toString(), '10');

   // Create an anchor whose token is the governedToken
   // Wrap and Deposit ERC20 liquidity into that anchor

   // Create the Hasher and Verifier for the chain
   const hasherFactory = new PoseidonT3__factory(admin);
   let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
   await hasherInstance.deployed();

   const verifier = await Verifier.createVerifier(admin);

   anchorHandler = await AnchorHandler.createAnchorHandler(bridgeSide.contract.address, [], [], admin);

   let anchorDenomination = 1000000000000;
   sourceAnchor = await Anchor.createAnchor(
     verifier.contract.address,
     hasherInstance.address,
     anchorDenomination.toString(),
     30,
     governedToken.contract.address,
     anchorHandler.contract.address,
     5,
     zkComponents,
     admin
   );

   await governedToken.grantMinterRole(sourceAnchor.contract.address);

   await TruffleAssert.reverts(
    sourceAnchor.wrapAndDeposit(zeroAddress, wrappingFee, getChainIdType(await admin.getChainId())),
    'Fee Recipient cannot be zero address'
   ); 

   // Change Fee Recipient to treasury Address
   await bridgeSide.executeFeeRecipientProposalWithSig(governedToken, treasury.contract.address);

   // For Native ETH Tests
   await sourceAnchor.wrapAndDeposit(zeroAddress, wrappingFee, getChainIdType(await admin.getChainId()));

   // Anchor Denomination amount should go to TokenWrapper
   assert.strictEqual((await ethers.provider.getBalance(governedToken.contract.address)).toString(), anchorDenomination.toString());

   // The wrapping fee should be transferred to the treasury
   assert.strictEqual((await ethers.provider.getBalance(treasury.contract.address)).toString(), parseInt((anchorDenomination * (wrappingFee / (100 - wrappingFee))).toString()).toString());

   assert.strictEqual((await governedToken.contract.balanceOf(sourceAnchor.contract.address)).toString(), anchorDenomination.toString());
 })

 it('should rescue native eth', async () => {
   let balTreasuryBeforeRescue = await ethers.provider.getBalance(treasury.contract.address);
   let to = signers[2].address;
   let balToBeforeRescue = await ethers.provider.getBalance(to);

   await bridgeSide.executeRescueTokensProposalWithSig(treasury, zeroAddress, to, BigNumber.from('500'));

   let balTreasuryAfterRescue = await ethers.provider.getBalance(treasury.contract.address);
   let balToAfterRescue = await ethers.provider.getBalance(to);

   assert.strictEqual(balTreasuryBeforeRescue.sub(balTreasuryAfterRescue).toString(),'500');

   assert.strictEqual(balToAfterRescue.sub(balToBeforeRescue).toString(),'500');

   assert.strictEqual((await treasury.contract.proposalNonce()).toString(), '1');
 })

 it('should rescue all native eth when amountToRescue greater than treasury balance', async () => {
   let balTreasuryBeforeRescue = await ethers.provider.getBalance(treasury.contract.address);
   let to = signers[2].address;
   let balToBeforeRescue = await ethers.provider.getBalance(to);

   await bridgeSide.executeRescueTokensProposalWithSig(treasury, zeroAddress, to, BigNumber.from('500000000000000'));

   let balTreasuryAfterRescue = await ethers.provider.getBalance(treasury.contract.address);
   let balToAfterRescue = await ethers.provider.getBalance(to);

   // balTreasuryAfterRescue = 0
   assert.strictEqual(balTreasuryBeforeRescue.sub(balTreasuryAfterRescue).toString(), balTreasuryBeforeRescue.toString());

   // Should be balTreasuryBeforeRescue, since all tokens are transferred to the to address
   assert.strictEqual(balToAfterRescue.sub(balToBeforeRescue).toString(),balTreasuryBeforeRescue.toString());

   assert.strictEqual((await treasury.contract.proposalNonce()).toString(), '1');
 })
})
