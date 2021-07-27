/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');
 
 const Helpers = require('../helpers');
 
 const BridgeContract = artifacts.require("Bridge");
 const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
 const AnchorHandlerContract = artifacts.require("AnchorHandler");
 const LinkableAnchorContract = artifacts.require("LinkableERC20AnchorPoseidon2");
 const Verifier = artifacts.require("Verifier");
 const Hasher = artifacts.require("HasherMock");
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
    const expectedUpdateNonce = 1;
    const relayerThreshold = 3;
    const expectedFinalizedEventStatus = 2;
    const expectedExecutedEventStatus = 3;
    const merkleTreeHeight = 31;
    const newLeafIndex = 1;
    const maxRoots = 100;
    const sender = accounts[5]
    const operator = accounts[5]

    const linkedChainIDs = [2,3,4,5];
    let ADMIN_ROLE;
    let merkleRoot;
    let LinkableAnchorInstance;
    let hasher, verifier;
    let anchor;
    let token;
    let tokenDenomination = '1000'; // 1 ether
    // function stubs
    let setHandler;
    let setBridge;
    let addEdge;
    let updateEdge;

    let BridgeInstance;
    let DestinationERC20MintableInstance;
    let DestinationAnchorHandlerInstance;
    let data = '';
    let dataHash = '';
    let resourceID = '';
    let initialResourceIDs;
    let initialContractAddresses;
    let burnableContractAddresses;

    let vote, executeProposal;

     beforeEach(async () => {
        await Promise.all([
        BridgeContract.new(destinationChainID, [
            relayer1Address,
            relayer2Address,
            relayer3Address,
            relayer4Address], 
            relayerThreshold, 
            0,
            100,).then(instance => BridgeInstance = instance),
        ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance)
        ]);
        
        hasher = await Hasher.new();
        verifier = await Verifier.new();
        token = await Token.new();
        await token.mint(sender, tokenDenomination);
        LinkableAnchorInstance = await LinkableAnchorContract.new(
        verifier.address,
        hasher.address,
        tokenDenomination,
        merkleTreeHeight,
        maxRoots,
        token.address,
        );    
         
        await token.increaseAllowance(LinkableAnchorInstance.address, 1000000000, {from: sender});
        await LinkableAnchorInstance.deposit('0x1111111111111111111111111111111111111111111111111111111111111111', {from: sender});
        merkleRoot = await LinkableAnchorInstance.getLastRoot();
        
        resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, originChainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [DestinationERC20MintableInstance.address];
        burnableContractAddresses = [DestinationERC20MintableInstance.address];

        DestinationAnchorHandlerInstance = await AnchorHandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
        
        data = Helpers.createUpdateProposalData(newLeafIndex, merkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));

        await Promise.all([
            DestinationERC20MintableInstance.grantRole(await DestinationERC20MintableInstance.MINTER_ROLE(), DestinationAnchorHandlerInstance.address),
            BridgeInstance.adminSetResource(DestinationAnchorHandlerInstance.address, resourceID, DestinationERC20MintableInstance.address)
        ]);

        vote = (relayer) => BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer });
        executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID, { from: relayer });
     });

    it ('[sanity] bridge configured with threshold and relayers', async () => {
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
        await TruffleAssert.reverts(vote(depositerAddress));
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
                event.depositNonce.toNumber() === expectedUpdateNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === dataHash
        });
    });

    it('UpdateProposalVote event fired when proposal vote made', async () => {
        const voteTx = await vote(relayer1Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalVote', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedUpdateNonce &&
                event.status.toNumber() === 1
        });
    });

    it('Execution successful', async () => {
        await TruffleAssert.passes(vote(relayer1Address));

        await TruffleAssert.passes(vote(relayer2Address));

        const voteTx = await vote(relayer3Address);

        TruffleAssert.eventEmitted(voteTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
                event.depositNonce.toNumber() === expectedUpdateNonce &&
                event.status.toNumber() === expectedFinalizedEventStatus &&
                event.dataHash === dataHash
        });

        const executionTx = await executeProposal(relayer1Address)

        TruffleAssert.eventEmitted(executionTx, 'ProposalEvent', (event) => {
            return event.originChainID.toNumber() === originChainID &&
            event.depositNonce.toNumber() === expectedUpdateNonce &&
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
});
