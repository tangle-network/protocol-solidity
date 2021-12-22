/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 
 // Convenience wrapper classes for contract classes
 import { Anchor, AnchorHandler, Verifier } from '../../packages/fixed-bridge/src';
 import { SignatureBridgeSide } from '../../packages/fixed-bridge/src/SignatureBridgeSide'
 import { MintableToken } from '@webb-tools/tokens';
 import { fetchComponentsFromFilePaths, ZkComponents } from '@webb-tools/utils';
 import { PoseidonT3__factory } from '../../typechain';
 import { GovernedTokenWrapper } from '../../packages/tokens/src/GovernedTokenWrapper';
 import { TokenWrapperHandler } from '../../packages/tokens/src/TokenWrapperHandler';
 //import { AnchorHandler as AnchorHandlerContract } from '@webb-tools/contracts';
 
 describe('BridgeSideConstruction', () => {
 
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
     const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, 0, 100, admin);
   })

   it('should set resource with signature', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, 0, 100, admin);

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
      admin.address,
      admin.address,
      admin.address,
      5,
      zkComponents,
      admin
    );

    await tokenInstance.approveSpending(anchor.contract.address);

    await bridgeSide.setAnchorHandler(anchorHandler);
    //Function call below sets resource with signature
    await bridgeSide.connectAnchorWithSignature(anchor);
  })
 
  it('execute anchor proposal', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, 0, 100, admin);

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
      admin.address,
      admin.address,
      admin.address,
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
      bridgeSide.contract.address,
      admin.address,
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
    await bridgeSide.executeAnchorProposalWithSig(sourceAnchor, destAnchor);
  })

  it.only('execute fee proposal', async () => {
    const signers = await ethers.getSigners();
    const initialGovernor = signers[1];
    const admin = signers[1];
    const bridgeSide = await SignatureBridgeSide.createBridgeSide(initialGovernor.address, 0, 100, admin);

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
    await bridgeSide.setGTResourceWithSignature(governedToken);

    //Execute change fee proposal
    await bridgeSide.executeFeeProposalWithSig(governedToken, 5);

    //Check that fee actually changed
    //assert.strictEqual(governedToken.contract.get().toString(), 5);
  })

 })