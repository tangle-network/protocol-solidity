/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import { artifacts, assert, contract } from "hardhat";
import { toBN } from "web3-utils";
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const AnchorHandlerContract = artifacts.require("AnchorHandler");
const Anchor = artifacts.require("FixedDepositAnchor");
const Hasher = artifacts.require("PoseidonT3");
const Verifier = artifacts.require('Verifier');
const Verifier2 = artifacts.require('Verifier2');
const Verifier3 = artifacts.require('Verifier3');
const Verifier4 = artifacts.require('Verifier4');
const Verifier5 = artifacts.require('Verifier5');
const Verifier6 = artifacts.require('Verifier6');
const Token = artifacts.require("ERC20Mock");

contract('Bridge - [voteUpdateProposal with relayerThreshold == 3]', async (accounts) => {
  const originChainID = 1;
  const destinationChainID = 2;
  const relayer1Address = accounts[0];
  const relayer2Address = accounts[1];
  const relayer3Address = accounts[2];
  const relayer4Address = accounts[3];
  const relayer1Bit = 1 << 0;
  const relayer2Bit = 1 << 1;
  const relayer3Bit = 1 << 2;
  const depositerAddress = accounts[4];
  const relayerThreshold = 3;
  const expectedFinalizedEventStatus = 2;
  const expectedExecutedEventStatus = 3;
  const merkleTreeHeight = 31;
  const sender = accounts[5]

  let merkleRoot;
  let expectedUpdateNonce = 1;
  let OriginChainAnchorInstance;
  let DestChainAnchorInstance;
  let v2, v3, v4, v5, v6;
  let hasher, verifier;
  let token;
  let tokenDenomination = '1000'; // 1 ether

  let BridgeInstance;
  let DestinationAnchorHandlerInstance;
  let data = '';
  let dataHash = '';
  let resourceID = '';
  let initialResourceIDs;
  let initialContractAddresses;

  let vote, executeProposal;

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
        100,
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

    OriginChainAnchorInstance = await Anchor.new(
      sender,
      token.address,
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      MAX_EDGES,
    { from: sender });
    DestChainAnchorInstance = await Anchor.new(
      sender,
      token.address,
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      MAX_EDGES,
    { from: sender });
    
    await token.mint(sender, toBN(tokenDenomination).mul(toBN(10)));
    await token.increaseAllowance(OriginChainAnchorInstance.address, 1000000000, { from: sender });
    let { logs } = await OriginChainAnchorInstance.deposit('0x11111', { from: sender });
    let latestLeafIndex = logs[0].args.leafIndex;
    merkleRoot = await OriginChainAnchorInstance.getLastRoot();
    resourceID = Helpers.createResourceID(OriginChainAnchorInstance.address, originChainID);
    initialResourceIDs = [resourceID];
    initialContractAddresses = [DestChainAnchorInstance.address];

    DestinationAnchorHandlerInstance = await AnchorHandlerContract.new(
      BridgeInstance.address,
      initialResourceIDs,
      initialContractAddresses,
    );

    await DestChainAnchorInstance.setHandler(DestinationAnchorHandlerInstance.address, await DestChainAnchorInstance.getProposalNonce() + 1, { from: sender });

    data = Helpers.createUpdateProposalData(originChainID, latestLeafIndex, merkleRoot, DestChainAnchorInstance.address, destinationChainID);
    dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));

    await Promise.all([
      BridgeInstance.adminSetResource(DestinationAnchorHandlerInstance.address, resourceID, DestChainAnchorInstance.address)
    ]);

    vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer });
    executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID, { from: relayer });
  });

  it('[sanity] bridge configured with threshold and relayers', async () => {
    assert.equal(await BridgeInstance._chainID(), destinationChainID)

    assert.equal(await BridgeInstance._relayerThreshold(), relayerThreshold)

    assert.equal((await BridgeInstance._totalRelayers()).toString(), '4')
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

  it('should revert because depositerAddress is not a relayer', async () => {
    await TruffleAssert.reverts(vote(depositerAddress), "sender doesn't have relayer role");
  });

  it("updateProposal shouldn't be voted on if it has a Passed status", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    await TruffleAssert.passes(vote(relayer2Address));

    await TruffleAssert.passes(vote(relayer3Address));

    await TruffleAssert.reverts(vote(relayer4Address), 'proposal already passed/executed/cancelled');
  });

  it("updateProposal shouldn't be voted on if it has a Transferred status", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    await TruffleAssert.passes(vote(relayer2Address));

    await TruffleAssert.passes(vote(relayer3Address));

    await TruffleAssert.passes(executeProposal(relayer1Address));

    await TruffleAssert.reverts(vote(relayer4Address), 'proposal already passed/executed/cancelled');

  });

  it("relayer shouldn't be able to vote on a updateProposal more than once", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    await TruffleAssert.reverts(vote(relayer1Address), 'relayer already voted');
  });

  it("Should be able to create a proposal with a different hash", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    await TruffleAssert.passes(
      BridgeInstance.voteProposal(
        originChainID, expectedUpdateNonce,
        resourceID, Ethers.utils.keccak256(dataHash),
        { from: relayer2Address }));
  });

  it("Relayer's vote should be recorded correctly - yes vote", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    const updateProposalAfterFirstVote = await BridgeInstance.getProposal(
      originChainID, expectedUpdateNonce, dataHash);
    assert.equal(updateProposalAfterFirstVote._yesVotesTotal, 1);
    assert.equal(updateProposalAfterFirstVote._yesVotes, relayer1Bit);
    assert.strictEqual(updateProposalAfterFirstVote._status, '1');

    await TruffleAssert.passes(vote(relayer2Address));

    const updateProposalAfterSecondVote = await BridgeInstance.getProposal(
      originChainID, expectedUpdateNonce, dataHash);
    assert.equal(updateProposalAfterSecondVote._yesVotesTotal, 2);
    assert.equal(updateProposalAfterSecondVote._yesVotes, relayer1Bit + relayer2Bit);
    assert.strictEqual(updateProposalAfterSecondVote._status, '1');

    await TruffleAssert.passes(vote(relayer3Address));

    const updateProposalAfterThirdVote = await BridgeInstance.getProposal(
      originChainID, expectedUpdateNonce, dataHash);
    assert.equal(updateProposalAfterThirdVote._yesVotesTotal, 3);
    assert.equal(updateProposalAfterThirdVote._yesVotes, relayer1Bit + relayer2Bit + relayer3Bit);
    assert.strictEqual(updateProposalAfterThirdVote._status, '2');

    await TruffleAssert.passes(executeProposal(relayer1Address));

    const updateProposalAfterExecute = await BridgeInstance.getProposal(
      originChainID, expectedUpdateNonce, dataHash);
    assert.equal(updateProposalAfterExecute._yesVotesTotal, 3);
    assert.equal(updateProposalAfterExecute._yesVotes, relayer1Bit + relayer2Bit + relayer3Bit);
    assert.strictEqual(updateProposalAfterExecute._status, '3');
  });

  it("Relayer's address should be marked as voted for proposal", async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    const hasVoted = await BridgeInstance._hasVotedOnProposal.call(
      Helpers.nonceAndId(expectedUpdateNonce, originChainID), dataHash, relayer1Address);
    assert.isTrue(hasVoted);
  });

  it('UpdateProposalFinalized event should be emitted when proposal status updated to passed after numYes >= relayerThreshold', async () => {
    await TruffleAssert.passes(vote(relayer1Address));
    await TruffleAssert.passes(vote(relayer2Address));

    const voteTx = await vote(relayer3Address);

    TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
      return event.originChainID.toNumber() === originChainID &&
        event.nonce.toNumber() === expectedUpdateNonce &&
        event.status.toNumber() === expectedFinalizedEventStatus &&
        event.dataHash === dataHash
    });
  });

  it('UpdateProposalVote event fired when proposal vote made', async () => {
    const voteTx = await vote(relayer1Address);

    TruffleAssert.eventEmitted(voteTx, 'ProposalVote', (event) => {
      return event.originChainID.toNumber() === originChainID &&
        event.nonce.toNumber() === expectedUpdateNonce &&
        event.status.toNumber() === 1
    });
  });

  it('Execution successful', async () => {
    await TruffleAssert.passes(vote(relayer1Address));

    await TruffleAssert.passes(vote(relayer2Address));

    const voteTx = await vote(relayer3Address);

    TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
      return event.originChainID.toNumber() === originChainID &&
        event.nonce.toNumber() === expectedUpdateNonce &&
        event.status.toNumber() === expectedFinalizedEventStatus &&
        event.dataHash === dataHash
    });

    const executionTx = await executeProposal(relayer1Address)

    TruffleAssert.eventEmitted(executionTx, 'ProposalEvent', (event) => {
      return event.originChainID.toNumber() === originChainID &&
        event.nonce.toNumber() === expectedUpdateNonce &&
        event.status.toNumber() === expectedExecutedEventStatus &&
        event.dataHash === dataHash
    });
  });

  it('Proposal cannot be executed twice', async () => {
    await vote(relayer1Address);
    await vote(relayer2Address);
    await vote(relayer3Address);
    await executeProposal(relayer1Address);
    await TruffleAssert.reverts(executeProposal(relayer1Address), "Proposal must have Passed status");
  });

  it('Execution requires active proposal', async () => {
    await TruffleAssert.reverts(BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, '0x0', { from: relayer1Address }), "Proposal must have Passed status");
  });

  it('Voting requires resourceID that is mapped to a handler', async () => {
    await TruffleAssert.reverts(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, '0x0', dataHash, { from: relayer1Address }), "no handler for resourceID");
  });

  it("executed proposal cannot be cancelled", async () => {
    await TruffleAssert.passes(vote(relayer1Address));
    await TruffleAssert.passes(vote(relayer2Address));
    await TruffleAssert.passes(vote(relayer3Address));

    await TruffleAssert.passes(BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID));
    await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal cannot be cancelled")
  });
});
