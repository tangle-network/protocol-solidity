/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import { artifacts, assert, contract } from "hardhat";
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const AnchorHandlerContract = artifacts.require("AnchorHandler");
const AnchorContract = artifacts.require("FixedDepositAnchor");
const Hasher = artifacts.require("PoseidonT3");
const Verifier = artifacts.require('Verifier');
const Verifier2 = artifacts.require('Verifier2');
const Verifier3 = artifacts.require('Verifier3');
const Verifier4 = artifacts.require('Verifier4');
const Verifier5 = artifacts.require('Verifier5');
const Verifier6 = artifacts.require('Verifier6');
const Token = artifacts.require("ERC20Mock");

contract('Bridge - [CancelUpdateProposal with relayerThreshold == 3]', async (accounts) => {
  const originChainID = 1;
  const destinationChainID = 2;
  const relayer1Address = accounts[0];
  const relayer2Address = accounts[1];
  const relayer3Address = accounts[2];
  const relayer4Address = accounts[3];
  const relayer1Bit = 1 << 0;
  const relayer2Bit = 1 << 1;
  const relayer3Bit = 1 << 2;
  const expectedUpdateNonce = 1;
  const relayerThreshold = 3;
  const merkleTreeHeight = 31;
  const sender = accounts[5]
  let merkleRoot;
  let AnchorInstance;
  let v2, v3, v4, v5, v6;
  let hasher, verifier;
  let token;
  let tokenDenomination = '1000';// 1 ether

  let BridgeInstance;
  let DestinationAnchorHandlerInstance;
  let data = '';
  let dataHash = '';
  let resourceID = '';
  let initialResourceIDs;
  let initialContractAddresses;

  let vote;
  let executeProposal;
  const MAX_EDGES = 1;

  beforeEach(async () => {
    // create all contracts
    await Promise.all([
      BridgeContract.new(destinationChainID, [
        relayer1Address,
        relayer2Address,
        relayer3Address,
        relayer4Address], 
        relayerThreshold, 
        0,
        10
      ).then(instance => BridgeInstance = instance),
      Hasher.new().then(instance => hasher = instance),
      Verifier2.new().then(instance => v2 = instance),
      Verifier3.new().then(instance => v3 = instance),
      Verifier4.new().then(instance => v4 = instance),
      Verifier5.new().then(instance => v5 = instance),
      Verifier6.new().then(instance => v6 = instance),
      Token.new().then(instance => token = instance),
    ]);
    verifier = await Verifier.new(
      v2.address,
      v3.address,
      v4.address,
      v5.address,
      v6.address
    );

    AnchorInstance = await AnchorContract.new(
      sender,
      token.address,
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      MAX_EDGES,
    );

    await token.mint(sender, tokenDenomination);
    await token.increaseAllowance(AnchorInstance.address, 1000000000, { from: sender });
    let { logs } = await AnchorInstance.deposit('0x1111111111111111111111111111111111111111111111111111111111111111', { from: sender });
    let latestLeafIndex = logs[0].args.leafIndex;
    merkleRoot = await AnchorInstance.getLastRoot();
    
    resourceID = Helpers.createResourceID(AnchorInstance.address, originChainID);
    initialResourceIDs = [resourceID];
    initialContractAddresses = [AnchorInstance.address];

    DestinationAnchorHandlerInstance = await AnchorHandlerContract.new(
      BridgeInstance.address,
      initialResourceIDs,
      initialContractAddresses,
    );

    data = Helpers.createUpdateProposalData(originChainID, latestLeafIndex, merkleRoot, '0x1111111111111111111111111111111111111111', destinationChainID);
    dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));

    await Promise.all([
      BridgeInstance.adminSetResource(DestinationAnchorHandlerInstance.address, resourceID, DestinationAnchorHandlerInstance.address)
    ]);

    vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer });
    executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID, { from: relayer });
  });

  it('[sanity] bridge configured with threshold, relayers, and expiry', async () => {
    assert.equal(await BridgeInstance._chainID(), destinationChainID)

    assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

    assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')

    assert.equal(await BridgeInstance._expiry(), 10)
  })

  it('[sanity] updateProposal should be created with expected values', async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    const expectedUpdateProposal = {
      _yesVotes: relayer1Bit.toString(),
      _yesVotesTotal: '1',
      _status: '1' // Active
    };

    const updateProposal = await BridgeInstance.getProposal(
      originChainID, expectedUpdateNonce, dataHash);

    assert.deepInclude(Object.assign({}, updateProposal), expectedUpdateProposal);
  });


  it("voting on updateProposal after expiration treshold results in cancelled proposal", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    for (var i = 0; i < 10; i++) {
      await Helpers.advanceBlock();
    }

    await TruffleAssert.passes(vote(relayer2Address));
    
    const expectedUpdateProposal = {
      _yesVotes: relayer1Bit.toString(),
      _yesVotesTotal: '1',
      _status: '4' // Cancelled
    };

    const updateProposal = await BridgeInstance.getProposal(originChainID, expectedUpdateNonce, dataHash);
    assert.deepInclude(Object.assign({}, updateProposal), expectedUpdateProposal);
    await TruffleAssert.reverts(vote(relayer3Address), "proposal already passed/executed/cancelled")
  });


  it("relayer can cancel proposal after expiration threshold blocks have passed", async () => {
    await TruffleAssert.passes(vote(relayer2Address));

    for (var i = 0; i < 10; i++) {
      await Helpers.advanceBlock();
    }

    const expectedUpdateProposal = {
      _yesVotes: relayer2Bit.toString(),
      _yesVotesTotal: '1',
      _status: '4' // Cancelled
    };

    await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash))
    const updateProposal = await BridgeInstance.getProposal(originChainID, expectedUpdateNonce, dataHash);
    assert.deepInclude(Object.assign({}, updateProposal), expectedUpdateProposal);
    await TruffleAssert.reverts(vote(relayer4Address), "proposal already passed/executed/cancelled")
  });

  it("relayer cannot cancel proposal before expiration threshold blocks have passed", async () => {
    await TruffleAssert.passes(vote(relayer2Address));

    await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal not at expiry threshold")
  });

  it("admin can cancel proposal after expiration threshold blocks have passed", async () => {
    await TruffleAssert.passes(vote(relayer3Address));

    for (var i = 0; i < 10; i++) {
      await Helpers.advanceBlock();
    }

    const expectedUpdateProposal = {
      _yesVotes: relayer3Bit.toString(),
      _yesVotesTotal: '1',
      _status: '4' // Cancelled
    };

    await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash))
    const updateProposal = await BridgeInstance.getProposal(originChainID, expectedUpdateNonce, dataHash);
    assert.deepInclude(Object.assign({}, updateProposal), expectedUpdateProposal);
    await TruffleAssert.reverts(vote(relayer2Address), "proposal already passed/executed/cancelled")
  });

  it("proposal cannot be cancelled twice", async () => {
    await TruffleAssert.passes(vote(relayer3Address));

    for (var i = 0; i < 10; i++) {
      await Helpers.advanceBlock();
    }

    await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash))
    await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal cannot be cancelled")
  });

  it("inactive proposal cannot be cancelled", async () => {
    await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal cannot be cancelled")
  });
});
