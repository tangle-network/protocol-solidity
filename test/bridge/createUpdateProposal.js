/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const AnchorHandlerContract = artifacts.require("AnchorHandler");
const LinkableAnchorContract = artifacts.require("LinkableERC20AnchorPoseidon2");
const Verifier = artifacts.require("VerifierPoseidonBridge");
const Hasher = artifacts.require("PoseidonT3");
const Token = artifacts.require("ERC20Mock");


contract('Bridge - [create a update proposal (voteProposal) with relayerThreshold = 1]', async (accounts) => {
  const originChainRelayerAddress = accounts[1];
  const originChainRelayerAddress2 = accounts[4];
  const originChainRelayerBit = 1 << 0;
  const depositerAddress = accounts[2];
  const originChainID = 1;
  const destinationChainID = 2;
  const expectedUpdateNonce = 1;
  const relayerThreshold = 1;
  const expectedCreateEventStatus = 1;
  const merkleTreeHeight = 31;
  const blockHeight = 1;
  const maxRoots = 100;
  const sender = accounts[0]

  let merkleRoot;
  let LinkableAnchorInstance;
  let hasher;
  let verifier;
  let token;
  let tokenDenomination = '1000'; 

  let BridgeInstance;
  let DestinationAnchorHandlerInstance;
  let resourceID;
  let data = '';
  let dataHash = '';
  let initialResourceIDs;
  let initialContractAddresses;

  beforeEach(async () => {
    await Promise.all([
      BridgeContract.new(originChainID, [
        originChainRelayerAddress,
        originChainRelayerAddress2],
        relayerThreshold,
        0,
        100
      ).then(instance => BridgeInstance = instance),
      Hasher.new().then(instance => hasher = instance),
      Verifier.new().then(instance => verifier = instance),
      Token.new().then(instance => token = instance),
    ]);

    LinkableAnchorInstance = await LinkableAnchorContract.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      maxRoots,
      token.address,
    );
    
    await token.mint(sender, tokenDenomination);
    await token.increaseAllowance(LinkableAnchorInstance.address, 1000000000, {from: sender});
    await LinkableAnchorInstance.deposit('0x1111111111111111111111111111111111111111111111111111111111111111', {from: sender});
    merkleRoot = await LinkableAnchorInstance.getLastRoot();
    
    resourceID = Helpers.createResourceID(LinkableAnchorInstance.address, originChainID);
    initialResourceIDs = [resourceID];
    initialContractAddresses = [LinkableAnchorInstance.address];

    DestinationAnchorHandlerInstance = await AnchorHandlerContract.new(
      BridgeInstance.address,
      initialResourceIDs,
      initialContractAddresses,
    );

    data = Helpers.createUpdateProposalData(originChainID, blockHeight, merkleRoot);
    dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));

    await Promise.all([
      BridgeInstance.adminSetResource(DestinationAnchorHandlerInstance.address, resourceID, DestinationAnchorHandlerInstance.address)
    ]);
  });

  it('should create updateProposal successfully', async () => {
    TruffleAssert.passes(await BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    ));
  });

  it('should revert because updaterAddress is not a relayer', async () => {
    await TruffleAssert.reverts(BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: depositerAddress }
    ), "sender doesn't have relayer role");
  });

  it("updateProposal shouldn't be created if it has a passedstatus", async () => {
    await TruffleAssert.passes(BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    ));

    await TruffleAssert.reverts(BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    ), "proposal already passed/executed/cancelled");
  });

  it("getProposal should be called successfully", async () => {
    await TruffleAssert.passes(BridgeInstance.getProposal(
      destinationChainID, expectedUpdateNonce, dataHash
    ));
  });

  it('updateProposal should be created with expected values', async () => {
    const expectedUpdateProposal = {
      _yesVotes: originChainRelayerBit.toString(),
      _yesVotesTotal: '1',
      _status: '2' // passed
    };

    await BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    );

    const updateProposal = await BridgeInstance.getProposal(
      destinationChainID, expectedUpdateNonce, dataHash);
    Helpers.assertObjectsMatch(expectedUpdateProposal, Object.assign({}, updateProposal));
  });

  it('originChainRelayerAddress should be marked as voted for proposal', async () => {
    await BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    );
    const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
      Helpers.nonceAndId(expectedUpdateNonce, destinationChainID), dataHash, originChainRelayerAddress);
    assert.isTrue(hasVoted);
  });

  it('UpdateProposal Created event should be emitted with expected values', async () => {
    const proposalTx = await BridgeInstance.voteProposal(
      originChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    );

    TruffleAssert.eventEmitted(proposalTx, 'ProposalEvent', (event) => {
      return event.originChainID.toNumber() === originChainID &&
        event.nonce.toNumber() === expectedUpdateNonce &&
        event.status.toNumber() === expectedCreateEventStatus &&
        event.dataHash === dataHash
    });
  });
});

contract('Bridge - [create an update proposal (voteProposal) with relayerThreshold > 1]', async (accounts) => {
  const originChainRelayerAddress = accounts[1];
  const originChainRelayerAddress2 = accounts[4];
  const originChainRelayerBit = 1 << 0;
  const depositerAddress = accounts[2];
  const originChainID = 1;
  const destinationChainID = 2;
  const expectedUpdateNonce = 1;
  const relayerThreshold = 2;
  const expectedCreateEventStatus = 1;
  const merkleTreeHeight = 31;
  const blockHeight = 1;
  const maxRoots = 100;
  const sender = accounts[0]

  let merkleRoot;
  let LinkableAnchorInstance;
  let hasher;
  let verifier;
  let token;
  let tokenDenomination = '1000';

  let BridgeInstance;
  let DestinationAnchorHandlerInstance;
  let resourceID;
  let data = '';
  let dataHash = '';
  let initialResourceIDs;
  let initialContractAddresses;

  beforeEach(async () => {
    await Promise.all([
      BridgeContract.new(originChainID, [
        originChainRelayerAddress,
        originChainRelayerAddress2],
        relayerThreshold,
        0,
        100
      ).then(instance => BridgeInstance = instance),
      Hasher.new().then(instance => hasher = instance),
      Verifier.new().then(instance => verifier = instance),
      Token.new().then(instance => token = instance),
    ]);

    LinkableAnchorInstance = await LinkableAnchorContract.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      maxRoots,
      token.address,
    );

    await token.mint(sender, tokenDenomination);
    await token.increaseAllowance(LinkableAnchorInstance.address, 1000000000, {from: sender});
    await LinkableAnchorInstance.deposit('0x1111111111111111111111111111111111111111111111111111111111111111', {from: sender});
    merkleRoot = await LinkableAnchorInstance.getLastRoot();
    
    resourceID = Helpers.createResourceID(LinkableAnchorInstance.address, originChainID);
    initialResourceIDs = [resourceID];
    initialContractAddresses = [LinkableAnchorInstance.address];

    DestinationAnchorHandlerInstance = await AnchorHandlerContract.new(
      BridgeInstance.address,
      initialResourceIDs,
      initialContractAddresses,
    );

    data = Helpers.createUpdateProposalData(originChainID, blockHeight, merkleRoot);
    dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));

    await Promise.all([
      BridgeInstance.adminSetResource(DestinationAnchorHandlerInstance.address, resourceID, DestinationAnchorHandlerInstance.address)
    ]);
  });

  it('should create updateProposal successfully', async () => {
    TruffleAssert.passes(await BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    ));
  });

  it('should revert because depositerAddress is not a relayer', async () => {
    await TruffleAssert.reverts(BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: depositerAddress }
    ), "sender doesn't have relayer role");
  });

  it("updateProposal shouldn't be created if it has an Active status", async () => {
    await TruffleAssert.passes(BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    ));

    await TruffleAssert.reverts(BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    ), "relayer already voted");
  });

  it('updateProposal should be created with expected values', async () => {
    const expectedUpdateProposal = {
      _yesVotes: originChainRelayerBit.toString(),
      _yesVotesTotal: '1',
      _status: '1' // active
    };

    await BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    );

    const updateProposal = await BridgeInstance.getProposal(
      destinationChainID, expectedUpdateNonce, dataHash);
    Helpers.assertObjectsMatch(expectedUpdateProposal, Object.assign({}, updateProposal));
  });

  it('originChainRelayerAddress should be marked as voted for proposal', async () => {
    await BridgeInstance.voteProposal(
      destinationChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    );
    const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
      Helpers.nonceAndId(expectedUpdateNonce, destinationChainID), dataHash, originChainRelayerAddress);
    assert.isTrue(hasVoted);
  });

  it('updateProposalCreated event should be emitted with expected values', async () => {
    const proposalTx = await BridgeInstance.voteProposal(
      originChainID,
      expectedUpdateNonce,
      resourceID,
      dataHash,
      { from: originChainRelayerAddress }
    );

    TruffleAssert.eventEmitted(proposalTx, 'ProposalEvent', (event) => {
      return event.originChainID.toNumber() === originChainID &&
        event.nonce.toNumber() === expectedUpdateNonce &&
        event.status.toNumber() === expectedCreateEventStatus &&
        event.dataHash === dataHash
    });
  });
});