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
 const LinkableAnchorContract = artifacts.require("LinkableERC20Anchor");
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
     const destinationChainRecipientAddress = accounts[4];
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
                 10,).then(instance => BridgeInstance = instance),
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
         executeProposal = (relayer) => BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, { from: relayer });
     });
 
     it ('[sanity] bridge configured with threshold, relayers, and expiry', async () => {
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
 
 
     it("voting on updateProposal after threshold results in cancelled proposal", async () => {
         
 
         await TruffleAssert.passes(vote(relayer1Address));
 
         for (i=0; i<10; i++) {
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
 
 
     it("relayer can cancel proposal after threshold blocks have passed", async () => {
         await TruffleAssert.passes(vote(relayer2Address));
 
         for (i=0; i<10; i++) {
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
 
     it("relayer cannot cancel proposal before threshold blocks have passed", async () => {
         await TruffleAssert.passes(vote(relayer2Address));
 
         await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal not at expiry threshold")
     });
 
     it("admin can cancel proposal after threshold blocks have passed", async () => {
         await TruffleAssert.passes(vote(relayer3Address));
 
         for (i=0; i<10; i++) {
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
 
         for (i=0; i<10; i++) {
             await Helpers.advanceBlock();
         }
 
         await TruffleAssert.passes(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash))
         await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal cannot be cancelled")
     });
 
     it("inactive proposal cannot be cancelled", async () => {
         await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal cannot be cancelled")
     });
 
     it("executed proposal cannot be cancelled", async () => {
         await TruffleAssert.passes(vote(relayer1Address));
         await TruffleAssert.passes(vote(relayer2Address));
         await TruffleAssert.passes(vote(relayer3Address));
 
         await TruffleAssert.passes(BridgeInstance.executeProposal(originChainID, expectedUpdateNonce, data, resourceID));
         await TruffleAssert.reverts(BridgeInstance.cancelProposal(originChainID, expectedUpdateNonce, dataHash), "Proposal cannot be cancelled")
     });
 
 });
 