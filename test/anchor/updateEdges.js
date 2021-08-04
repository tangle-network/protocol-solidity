/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 const TruffleAssert = require('truffle-assertions');
 const Ethers = require('ethers');
 
 const Helpers = require('../helpers');
 const assert = require('assert');
 
 const LinkableAnchorContract = artifacts.require("LinkableERC20AnchorPoseidon2");
 const Verifier = artifacts.require("VerifierPoseidonBridge");
 const Hasher = artifacts.require("PoseidonT3");
 const Token = artifacts.require("ERC20Mock");
 const USDTToken = artifacts.require('IUSDT')
 
 // This test does NOT include all getter methods, just 
 // getters that should work with only the constructor called
 contract('LinkableAnchor - [update edges]', async accounts => {
   const chainID = 1;
   const linkedChainIDs = [2,3,4,5];
   let ADMIN_ROLE;
   
   let LinkableAnchorInstance;
   let HasherFactory;
   let hasher
   let verifier
   let anchor
   let token
   let usdtToken
   let badRecipient
   const merkleTreeHeight = 31;
   const maxRoots = 100;
   const sender = accounts[0]
   const operator = accounts[0]
   const levels = 16
   let tokenDenomination = '1000000000000000000' // 1 ether
   // function stubs
   let setHandler;
   let setBridge;
   let addEdge;
   let updateEdge;
 
   beforeEach(async () => {
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
 
     setHandler = (handler, sender) => LinkableAnchorInstance.setHandler(handler, {
       from: sender
     });
 
     setBridge = (bridge, sender) => LinkableAnchorInstance.setBridge(bridge, {
       from: sender
     });
 
     addEdge = (edge, sender) => LinkableAnchorInstance.addEdge(
       edge.sourceChainID,
       edge.root,
       edge.height,
       { from: sender }
     )
 
     updateEdge = (edge, sender) => LinkableAnchorInstance.updateEdge(
       edge.sourceChainID,
       edge.root,
       edge.height,
       { from: sender }
     )
   });
 
   it('LinkablechorAn should have same bridge & admin & handler on init', async () => {
     assert(await LinkableAnchorInstance.admin() == accounts[0]);
     assert(await LinkableAnchorInstance.bridge() == accounts[0]);
     assert(await LinkableAnchorInstance.handler() == accounts[0]);
   });
 
   it('LinkableAnchor handler should only be updatable by bridge only', async () => {
     await TruffleAssert.passes(setHandler(accounts[1], accounts[0]));
     await TruffleAssert.reverts(setHandler(accounts[0], accounts[1]), "sender is not the bridge");
   });
 
   it('LinkableAnchor bridge should only be updatable by admin only', async () => {
     await TruffleAssert.passes(setBridge(accounts[1], accounts[0]));
     await TruffleAssert.reverts(setBridge(accounts[0], accounts[1]), "sender is not the admin");
   });

   it('LinkableAnchor edges should be modifiable by handler only (checks newHeight > oldHeight)', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 100,
    };
    const edgeUpdated = {
      sourceChainID: '0x01',
      root: '0x2222111111111111111111111111111111111111111111111111111111111111',
      height: 101,
    };

    await TruffleAssert.passes(addEdge(edge, accounts[0]));
    await TruffleAssert.passes(updateEdge(edgeUpdated, accounts[0]));
    await TruffleAssert.reverts(updateEdge(edgeUpdated, accounts[1]), "sender is not the handler");
   });

   it('LinkableAnchor edges should be modifiable only if edge exists beforehand', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 100,
    };
    const edgeUpdated = {
      sourceChainID: '0x02',
      root: '0x2222111111111111111111111111111111111111111111111111111111111111',
      height: 101,
    };
    await TruffleAssert.passes(addEdge(edge, accounts[0]));
    await TruffleAssert.reverts(updateEdge(edgeUpdated, accounts[0]));
   });

   it('getLatestNeighborRoots should return updated values', async () => {
     const edge = {
       sourceChainID: '0x01',
       root: '0x1111111111111111111111111111111111111111111111111111111111111111',
       height: 100,
     };
     const edgeUpdated = {
      sourceChainID: '0x01',
       root: '0x2222111111111111111111111111111111111111111111111111111111111111',
       height: 101,
     };
     await TruffleAssert.passes(addEdge(edge, accounts[0]));

     const roots = await LinkableAnchorInstance.getLatestNeighborRoots();
     assert.strictEqual(roots.length, 1);
     assert.strictEqual(roots[0], edge.root);

     await TruffleAssert.passes(updateEdge(edgeUpdated, accounts[0]));
     
     const rootsUpdated = await LinkableAnchorInstance.getLatestNeighborRoots();
     assert.strictEqual(rootsUpdated.length, 1); 
     assert.strictEqual(rootsUpdated[0], edgeUpdated.root);
   });
   
   it('Updating edge should emit correct EdgeUpdate event', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 100,
    };
    const edgeUpdated = {
      sourceChainID: '0x01',
      root: '0x2222111111111111111111111111111111111111111111111111111111111111',
      height: 101,
    };

    await addEdge(edge, accounts[0]);
    const result = await updateEdge(edgeUpdated, accounts[0]);
    TruffleAssert.eventEmitted(result, 'EdgeUpdate', (ev) => {
      return ev.chainID == parseInt(edgeUpdated.sourceChainID, 16) && 
      ev.height == edgeUpdated.height && ev.merkleRoot == edgeUpdated.root
    });
  });

  it('Updating edge should emit correct RootHistoryUpdate event', async () => {
    const edge = {  
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 100,
    };
    const edgeUpdated = {
        sourceChainID: '0x01',

        root: '0x2222111111111111111111111111111111111111111111111111111111111111',
        height: 101,
      };
    await addEdge(edge, accounts[0]);
    const result = await updateEdge(edgeUpdated, accounts[0]);
    const roots = await LinkableAnchorInstance.getLatestNeighborRoots();
    
    TruffleAssert.eventEmitted(result, 'RootHistoryUpdate', (ev) => {
      return ev.roots[0]  == roots[0]
    });
  });
});
