/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');

const Anchor = artifacts.require("Anchor2");
const Verifier = artifacts.require("VerifierPoseidonBridge");
const Hasher = artifacts.require("PoseidonT3");
const Token = artifacts.require("ERC20Mock");

// This test does NOT include all getter methods, just
// getters that should work with only the constructor called
contract('LinkableAnchor - [add edges]', async accounts => {
  let AnchorInstance;
  let hasher
  let verifier
  let token
  const merkleTreeHeight = 31;
  const maxRoots = 1;
  const sender = accounts[0]
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
    AnchorInstance = await Anchor.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      token.address,
      accounts[0],
      accounts[0],
      accounts[0],
    );

    setHandler = (handler, sender) => AnchorInstance.setHandler(handler, {
      from: sender
    });

    setBridge = (bridge, sender) => AnchorInstance.setBridge(bridge, {
      from: sender
    });

    addEdge = (edge, sender) => AnchorInstance.addEdge(
      edge.sourceChainID,
      edge.root,
      edge.height,
      { from: sender }
    )

    updateEdge = (edge, sender) => AnchorInstance.updateEdge(
      edge.sourceChainID,
      edge.root,
      edge.height,
      { from: sender }
    )
  });

  it('LinkableAnchor should have same bridge & admin & handler on init', async () => {
    assert(await AnchorInstance.admin() == accounts[0]);
    assert(await AnchorInstance.bridge() == accounts[0]);
    assert(await AnchorInstance.handler() == accounts[0]);
  });

  it('LinkableAnchor handler should only be updatable by bridge only', async () => {
    await TruffleAssert.passes(setHandler(accounts[1], accounts[0]));
    await TruffleAssert.reverts(setHandler(accounts[0], accounts[1]), "sender is not the bridge");
  });

  it('LinkableAnchor bridge should only be updatable by admin only', async () => {
    await TruffleAssert.passes(setBridge(accounts[1], accounts[0]));
    await TruffleAssert.reverts(setBridge(accounts[0], accounts[1]), "sender is not the admin");
  });

  it('LinkableAnchor edges should be modifiable by handler only', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    await TruffleAssert.passes(addEdge(edge, accounts[0]));
    await TruffleAssert.reverts(addEdge(edge, accounts[1]), "sender is not the handler");

    const roots = await AnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(roots.length, maxRoots);
    assert.strictEqual(roots[0], edge.root);
  });

  it('LinkableAnchor edges should update edgeIndex', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    await TruffleAssert.passes(addEdge(edge, accounts[0]));

    assert(await AnchorInstance.edgeIndex(edge.sourceChainID) == 0);
  });

  it('LinkableAnchor should fail to add an edge at capacity', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    const edge1 = {
      sourceChainID: '0x02',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    await TruffleAssert.passes(addEdge(edge, accounts[0]));
    assert(await AnchorInstance.edgeIndex(edge.sourceChainID) == 0);

    await TruffleAssert.reverts(addEdge(edge1, accounts[0], 'This Anchor is at capacity'));
  });

  it('latestNeighborRoots should return correct roots', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    await TruffleAssert.passes(addEdge(edge, accounts[0]));

    const roots = await AnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(roots.length, maxRoots);
    assert.strictEqual(roots[0], edge.root);
  });

  it('Adding edge should emit correct EdgeAddition event', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    const result = await addEdge(edge, accounts[0]);

    TruffleAssert.eventEmitted(result, 'EdgeAddition', (ev) => {
      return ev.chainID == parseInt(edge.sourceChainID, 16) &&
       ev.height == edge.height && ev.merkleRoot == edge.root
    });
  });

  it('Adding edge should emit correct RootHistoryUpdate event', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      height: 1,
    };

    const result = await addEdge(edge, accounts[0]);
    const roots = await AnchorInstance.getLatestNeighborRoots();

    TruffleAssert.eventEmitted(result, 'RootHistoryUpdate', (ev) => {
      return ev.roots[0] == roots[0]
    });
  });
});

