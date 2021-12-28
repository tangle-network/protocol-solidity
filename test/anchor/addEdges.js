/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');

const Anchor = artifacts.require("FixedDepositAnchor");
const Hasher = artifacts.require("PoseidonT3");
const Verifier = artifacts.require('Verifier');
const Verifier2 = artifacts.require('Verifier2');
const Verifier3 = artifacts.require('Verifier3');
const Verifier4 = artifacts.require('Verifier4');
const Verifier5 = artifacts.require('Verifier5');
const Verifier6 = artifacts.require('Verifier6');
const Token = artifacts.require("ERC20Mock");

// This test does NOT include all getter methods, just
// getters that should work with only the constructor called
contract('LinkableAnchor - [add edges]', async accounts => {
  let AnchorInstance;
  let hasher;
  let v2, v3, v4, v5, v6;
  let verifier;
  let token;
  const merkleTreeHeight = 31;
  const maxRoots = 1;
  const sender = accounts[0];
  let tokenDenomination = '1000000000000000000'; // 1 ether
  // function stubs
  let setHandler;
  let updateEdge;
  const MAX_EDGES = 1;

  beforeEach(async () => {
    hasher = await Hasher.new();
    await Promise.all([
      Verifier2.new().then(instance => v2 = instance),
      Verifier3.new().then(instance => v3 = instance),
      Verifier4.new().then(instance => v4 = instance),
      Verifier5.new().then(instance => v5 = instance),
      Verifier6.new().then(instance => v6 = instance),
    ]);
    verifier = await Verifier.new(
      v2.address,
      v3.address,
      v4.address,
      v5.address,
      v6.address
    );
    token = await Token.new();
    await token.mint(sender, tokenDenomination);
    AnchorInstance = await Anchor.new(
      verifier.address,
      hasher.address,
      tokenDenomination,
      merkleTreeHeight,
      token.address,
      accounts[0],
      MAX_EDGES
    );

    setHandler = (handler, sender) => AnchorInstance.setHandler(handler, {
      from: sender
    });

    updateEdge = (edge, sender) => AnchorInstance.updateEdge(
      edge.sourceChainID,
      edge.root,
      edge.latestLeafIndex,
      { from: sender }
    )
  });

  it('LinkableAnchor should have same bridge & admin & handler on init', async () => {
    assert(await AnchorInstance.handler() == accounts[0]);
  });

  it('LinkableAnchor edges should be modifiable by handler only', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));
    await TruffleAssert.reverts(updateEdge(edge, accounts[1]), "sender is not the handler");

    const roots = await AnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(roots.length, maxRoots);
    assert.strictEqual(roots[0], edge.root);
  });

  it('LinkableAnchor edges should update edgeIndex', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));

    assert(await AnchorInstance.edgeIndex(edge.sourceChainID) == 0);
  });

  it('LinkableAnchor should fail to add an edge at capacity', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
    };

    const edge1 = {
      sourceChainID: '0x02',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));
    assert(await AnchorInstance.edgeIndex(edge.sourceChainID) == 0);

    await TruffleAssert.reverts(updateEdge(edge1, accounts[0], 'This Anchor is at capacity'));
  });

  it('latestNeighborRoots should return correct roots', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));

    const roots = await AnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(roots.length, maxRoots);
    assert.strictEqual(roots[0], edge.root);
  });

  it('Adding edge should emit correct EdgeAddition event', async () => {
    const edge = {
      sourceChainID: '0x01',
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
    };

    const result = await updateEdge(edge, accounts[0]);

    TruffleAssert.eventEmitted(result, 'EdgeAddition', (ev) => {
      return ev.chainID == parseInt(edge.sourceChainID, 16) &&
       ev.latestLeafIndex == edge.latestLeafIndex && ev.merkleRoot == edge.root
    });
  });
});

