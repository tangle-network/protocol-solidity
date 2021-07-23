/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');
 
 const Helpers = require('../helpers');
 
 const BridgeContract = artifacts.require("Bridge");
 const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");
 const ERC20HandlerContract = artifacts.require("ERC20Handler");
 const LinkableAnchorContract = artifacts.require("LinkableERC20Anchor");
 const Verifier = artifacts.require("Verifier");
 const Hasher = artifacts.require("HasherMock");
 const Token = artifacts.require("ERC20Mock");
 


 contract('Bridge - [create a update proposal (voteProposal) with relayerThreshold = 1]', async (accounts) => {
     const originChainRelayerAddress = accounts[1];
     const originChainRelayerAddress2 = accounts[4];
     const originChainRelayerBit = 1 << 0;
     const depositerAddress = accounts[2];
     const destinationRecipientAddress = accounts[3];
     const originChainID = 1;
     const destinationChainID = 2;
     const expectedUpdateNonce = 1;
     const relayerThreshold = 1;
     const expectedCreateEventStatus = 1;
     const merkleTreeHeight = 31;
     const newLeafIndex = 1;
     const maxRoots = 100;
     const sender = accounts[0]
     const operator = accounts[0]
 
    
     let ADMIN_ROLE;
     let merkleRoot;
     let LinkableAnchorInstance;
     let hasher;
     let verifier;
     let anchor;
     let token;
     let tokenDenomination = '1000'; 
     // function stubs
     let setHandler;
     let setBridge;
     let addEdge;
     let updateEdge;

     let BridgeInstance;
     let DestinationERC20MintableInstance;
     let resourceID;
     let data = '';
     let dataHash = '';
     let initialResourceIDs;
     let initialContractAddresses;
     let burnableContractAddresses;
     

     beforeEach(async () => {
         await Promise.all([
             ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance),
             BridgeContract.new(originChainID, [originChainRelayerAddress, originChainRelayerAddress2], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance)
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
         initialResourceIDs = [];
         initialContractAddresses = [];
         burnableContractAddresses = [];
 
         resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, destinationChainID);
 
         DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
 
         await BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address);
         
         data = Helpers.createUpdateProposalData(newLeafIndex, merkleRoot);
         dataHash = Ethers.utils.keccak256(data);
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
         ));
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
         ));
     });

     it("updateProposal shouldn't be created by a different address if it has an Active status", async () => {
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
             { from: originChainRelayerAddress2}
         ));
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
                 event.depositNonce.toNumber() === expectedUpdateNonce &&
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
     const destinationRecipientAddress = accounts[3];
     const originChainID = 1;
     const destinationChainID = 2;
     const expectedUpdateNonce = 1;
     const relayerThreshold = 2;
     const expectedCreateEventStatus = 1;
     const merkleTreeHeight = 31;
     const newLeafIndex = 1;
     const maxRoots = 100;
     const sender = accounts[0]
     const operator = accounts[0]
 
     let ADMIN_ROLE;
     let merkleRoot;
     let LinkableAnchorInstance;
     let hasher;
     let verifier;
     let anchor;
     let token;
     let tokenDenomination = '1000';
     // function stubs
     let setHandler;
     let setBridge;
     let addEdge;
     let updateEdge;

     let BridgeInstance;
     let DestinationERC20MintableInstance;
     let resourceID;
     let data = '';
     let dataHash = '';
     let initialResourceIDs;
     let initialContractAddresses;
     let burnableContractAddresses;
     

     beforeEach(async () => {
         await Promise.all([
             ERC20MintableContract.new("token", "TOK").then(instance => DestinationERC20MintableInstance = instance),
             BridgeContract.new(originChainID, [originChainRelayerAddress, originChainRelayerAddress2], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance)
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
         
         initialResourceIDs = [];
         initialContractAddresses = [];
         burnableContractAddresses = [];
 
         resourceID = Helpers.createResourceID(DestinationERC20MintableInstance.address, destinationChainID);
 
         DestinationERC20HandlerInstance = await ERC20HandlerContract.new(BridgeInstance.address, initialResourceIDs, initialContractAddresses, burnableContractAddresses);
 
         await BridgeInstance.adminSetResource(DestinationERC20HandlerInstance.address, resourceID, DestinationERC20MintableInstance.address);
         
         data = Helpers.createUpdateProposalData(newLeafIndex, merkleRoot);
         dataHash = Ethers.utils.keccak256(data);
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
         ));
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
         ));
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
                 event.depositNonce.toNumber() === expectedUpdateNonce &&
                 event.status.toNumber() === expectedCreateEventStatus &&
                 event.dataHash === dataHash
         });
     });
 });