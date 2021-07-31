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
 const Verifier = artifacts.require("Verifier");
 const Hasher = artifacts.require("PoseidonT3");
 const Token = artifacts.require("ERC20Mock");

contract('Bridge - [voteUpdateProposal with relayerThreshold == 3]', async (accounts) => {
    const originChainID = 1;
    const destinationChainID = 2;
    const thirdChainID = 3;
    const fourthChainID = 4;
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
    const maxRoots = 1;
    const sender = accounts[5]
    const operator = accounts[5]

    let ADMIN_ROLE;
    let merkleRoot;
    let blockHeight = 1;
    let expectedUpdateNonce = 1;
    let LinkableAnchorOriginChainInstance;
    let LinkableAnchorDestChainInstance;
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
            Verifier.new().then(instance => verifier = instance),
            Token.new().then(instance => token = instance),
        ]);

        LinkableAnchorOriginChainInstance = await LinkableAnchorContract.new(
            verifier.address,
            hasher.address,
            tokenDenomination,
            merkleTreeHeight,
            originChainID,
            token.address,
        {from: sender});
        LinkableAnchorDestChainInstance = await LinkableAnchorContract.new(
            verifier.address,
            hasher.address,
            tokenDenomination,
            merkleTreeHeight,
            originChainID,
            token.address,
        {from: sender});
        
        await token.mint(sender, 1000000 * tokenDenomination);
        await token.increaseAllowance(LinkableAnchorOriginChainInstance.address, 1000000000, {from: sender});
        await LinkableAnchorOriginChainInstance.deposit('0x11111', {from: sender});
        merkleRoot = await LinkableAnchorOriginChainInstance.getLastRoot();
        resourceID = Helpers.createResourceID(LinkableAnchorOriginChainInstance.address, originChainID);
        initialResourceIDs = [resourceID];
        initialContractAddresses = [LinkableAnchorDestChainInstance.address];

        DestinationAnchorHandlerInstance = await AnchorHandlerContract.new(
            BridgeInstance.address,
            initialResourceIDs,
            initialContractAddresses,
        );

        await LinkableAnchorDestChainInstance.setHandler(DestinationAnchorHandlerInstance.address, {from: sender});
        await LinkableAnchorDestChainInstance.setBridge(BridgeInstance.address, {from: sender});
        

        data = Helpers.createUpdateProposalData(originChainID, blockHeight, merkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));

        await Promise.all([
            BridgeInstance.adminSetResource(DestinationAnchorHandlerInstance.address, resourceID, LinkableAnchorDestChainInstance.address)
        ]);
        
        vote = (relayer) => BridgeInstance.voteProposal(
            originChainID,
            expectedUpdateNonce,
            resourceID,
            dataHash,
            { from: relayer });
        executeProposal = (relayer) => BridgeInstance.executeProposal(
            originChainID,
            expectedUpdateNonce,
            data,
            resourceID,
            { from: relayer });
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

    it("Executing an updateProposal should addEdge", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));
        await TruffleAssert.passes(executeProposal(relayer1Address));

        const roots = await LinkableAnchorDestChainInstance.getLatestNeighborRoots();
    
        assert.strictEqual(roots.length, maxRoots);
        assert.strictEqual(roots[0], merkleRoot);

    });
    
    it("Voting on a proposal with a resourceID not mapped to a handler (and AnchorContract) should fail", async () => {
        faultyResourceID = Helpers.createResourceID(LinkableAnchorDestChainInstance.address, originChainID);
        await TruffleAssert.reverts(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, faultyResourceID , dataHash, { from: relayer1Address}),
            "no handler for resourceID");

    });

    it("Executing an updateProposal for existing edge should updateEdge", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));
        await TruffleAssert.passes(executeProposal(relayer1Address));

        await LinkableAnchorOriginChainInstance.deposit('0x22222', {from: sender});
        merkleRoot = await LinkableAnchorOriginChainInstance.getLastRoot();
        data = Helpers.createUpdateProposalData(originChainID, blockHeight + 10, merkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));
        expectedUpdateNonce++;
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer1Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer2Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer3Address }));
        await TruffleAssert.passes(BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID, { from: relayer2Address }));
        
        const newRoots = await LinkableAnchorDestChainInstance.getLatestNeighborRoots();
        // bridge between ONLY 2 chains means neighbors should be length 1
        assert.strictEqual(newRoots.length, maxRoots);
        assert.strictEqual(newRoots[0], merkleRoot);

    });

    it("Executing an updateProposal for existing edge with lesser or equal height should fail", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));
        await TruffleAssert.passes(executeProposal(relayer1Address));

        await LinkableAnchorOriginChainInstance.deposit('0x22222', {from: sender});
        merkleRoot = await LinkableAnchorOriginChainInstance.getLastRoot();
        data = Helpers.createUpdateProposalData(originChainID, blockHeight, merkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));
        expectedUpdateNonce++;
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer1Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer2Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer3Address }));
        await TruffleAssert.reverts(
            BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID, { from: relayer2Address }),
            "New height must be greater");

    });

    it("updateProposal for adding more than allowed edges should fail with capacity error", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));
        await TruffleAssert.passes(executeProposal(relayer1Address));

        hasher = await Hasher.new();
        verifier = await Verifier.new();
        token = await Token.new();
        await token.mint(sender, tokenDenomination);
        LinkableAnchorThirdChainInstance = await LinkableAnchorContract.new(
            verifier.address,
            hasher.address,
            tokenDenomination,
            merkleTreeHeight,
            originChainID,
            token.address,
            {from: sender}
        );
        await token.increaseAllowance(LinkableAnchorThirdChainInstance.address, 1000000000, {from: sender});
        await LinkableAnchorThirdChainInstance.deposit('0x023888', {from: sender});
        
        newMerkleRoot = await LinkableAnchorThirdChainInstance.getLastRoot();
        data = Helpers.createUpdateProposalData(thirdChainID, blockHeight, newMerkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));
        expectedUpdateNonce++;

        await TruffleAssert.passes(BridgeInstance.voteProposal(thirdChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer1Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(thirdChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer2Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(thirdChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer3Address }));
        await TruffleAssert.reverts(
            BridgeInstance.executeProposal(thirdChainID, expectedUpdateNonce, data, resourceID, { from: relayer3Address }),
            "This Anchor is at capacity"
        );
        
        const newRoots = await LinkableAnchorDestChainInstance.getLatestNeighborRoots();
        // bridge between ONLY 2 chains means neighbors should be length 1
        assert.strictEqual(newRoots.length, maxRoots);
        assert.strictEqual(newRoots[0], merkleRoot);

    });

    it("updateProposal for adding more edges than maxRoots (1) should fail", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));
        await TruffleAssert.passes(executeProposal(relayer1Address));

        hasher = await Hasher.new();
        verifier = await Verifier.new();
        token = await Token.new();
        await token.mint(sender, tokenDenomination);
        LinkableAnchorThirdChainInstance = await LinkableAnchorContract.new(
            verifier.address,
            hasher.address,
            tokenDenomination,
            merkleTreeHeight,
            originChainID,
            token.address,
            {from: sender}
        );
        await token.mint(sender, 1000000 * tokenDenomination);
        await token.increaseAllowance(LinkableAnchorThirdChainInstance.address, 1000000000, {from: sender});
        await LinkableAnchorThirdChainInstance.deposit('0x023888', {from: sender});
        
        newMerkleRoot = await LinkableAnchorThirdChainInstance.getLastRoot();
        data = Helpers.createUpdateProposalData(thirdChainID, blockHeight, newMerkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));
        expectedUpdateNonce++;

        await TruffleAssert.passes(BridgeInstance.voteProposal(thirdChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer1Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(thirdChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer2Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(thirdChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer3Address }));
        await TruffleAssert.reverts(
            BridgeInstance.executeProposal(thirdChainID, expectedUpdateNonce, data, resourceID, { from: relayer3Address }),
            "This Anchor is at capacity",
        );
    });
    
    it("updateProposal for updating an edge on anchor with 1 existing edge should work", async () => {
        await TruffleAssert.passes(vote(relayer1Address));
        await TruffleAssert.passes(vote(relayer2Address));
        await TruffleAssert.passes(vote(relayer3Address));
        await TruffleAssert.passes(executeProposal(relayer1Address));

        await LinkableAnchorOriginChainInstance.deposit('0x22222', {from: sender});
        merkleRoot = await LinkableAnchorOriginChainInstance.getLastRoot();
        data = Helpers.createUpdateProposalData(originChainID, blockHeight + 10, merkleRoot);
        dataHash = Ethers.utils.keccak256(DestinationAnchorHandlerInstance.address + data.substr(2));
        expectedUpdateNonce++;

        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer1Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer2Address }));
        await TruffleAssert.passes(BridgeInstance.voteProposal(originChainID, expectedUpdateNonce, resourceID, dataHash, { from: relayer3Address }));
        await TruffleAssert.passes(BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID, { from: relayer2Address }));
        
        newRoots = await LinkableAnchorDestChainInstance.getLatestNeighborRoots();

        // bridge between ONLY 2 chains means neighbors should be length 1
        assert.strictEqual(newRoots.length, maxRoots);
        assert.strictEqual(newRoots[0], merkleRoot);

    });

});