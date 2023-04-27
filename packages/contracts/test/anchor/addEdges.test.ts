/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

import { BigNumber } from 'ethers';
import { artifacts, contract, assert } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

const Anchor = artifacts.require('LinkableAnchorMock');
const Hasher = artifacts.require('KeccakHasher');
const Verifier = artifacts.require('Verifier');
const Verifier2 = artifacts.require('Verifier2');
const Verifier3 = artifacts.require('Verifier3');
const Verifier4 = artifacts.require('Verifier4');
const Verifier5 = artifacts.require('Verifier5');
const Verifier6 = artifacts.require('Verifier6');
const Token = artifacts.require('ERC20Mock');

// This test does NOT include all getter methods, just
// getters that should work with only the constructor called
contract('LinkableAnchor - [add edges]', async (accounts) => {
  let AnchorInstance;
  let hasher;
  let v2, v3, v4, v5, v6;
  let verifier;
  let token;
  const merkleTreeHeight = 31;
  const maxRoots = 1;
  const sender = accounts[0];
  let tokenDenomination = '1000'; // 1 ether
  // function stubs
  let setHandler;
  let updateEdge;
  const MAX_EDGES = 1;

  beforeEach(async () => {
    hasher = await Hasher.new();
    await Promise.all([
      Verifier2.new().then((instance) => (v2 = instance)),
      Verifier3.new().then((instance) => (v3 = instance)),
      Verifier4.new().then((instance) => (v4 = instance)),
      Verifier5.new().then((instance) => (v5 = instance)),
      Verifier6.new().then((instance) => (v6 = instance)),
    ]);
    verifier = await Verifier.new(v2.address, v3.address, v4.address, v5.address, v6.address);
    token = await Token.new();
    await token.mint(sender, tokenDenomination);
    AnchorInstance = await Anchor.new(
      sender,
      verifier.address,
      hasher.address,
      merkleTreeHeight,
      MAX_EDGES
    );
    await AnchorInstance.initialize();

    setHandler = (handler, sender, proposalNonce) =>
      AnchorInstance.setHandler(handler, proposalNonce + 1, {
        from: sender,
      });

    updateEdge = (edge, sender) =>
      AnchorInstance.updateEdge(edge.root, edge.latestLeafIndex, edge.srcResourceID, {
        from: sender,
      });
  });

  it('LinkableAnchor should have same bridge & admin & handler on init', async () => {
    assert((await AnchorInstance.handler()) == accounts[0]);
  });

  it('LinkableAnchor edges should be modifiable by handler only', async () => {
    const edge = {
      root: BigNumber.from('0x1111111111111111111111111111111111111111111111111111111111111111'),
      latestLeafIndex: 1,
      srcResourceID: '0x1111111111111111111111111111111111111111111111111111001000000001',
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));
    await TruffleAssert.reverts(updateEdge(edge, accounts[1]), 'sender is not the handler');

    const roots = await AnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(roots.length, maxRoots);
    assert.strictEqual(roots[0].toString(), edge.root);
  });

  it('LinkableAnchor edges should update edgeIndex', async () => {
    const edge = {
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
      srcResourceID: '0x1111111111111111111111111111111111111111111111111111001000000001',
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));

    assert((await AnchorInstance.edgeIndex('0x01')) == 0);
  });

  it('LinkableAnchor should fail to add an edge at capacity', async () => {
    const edge = {
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
      srcResourceID: '0x1111111111111111111111111111111111111111111111111111001000000001',
    };

    const edge1 = {
      root: '0x1111111111111111111111111111111111111111111111111111111111111111',
      latestLeafIndex: 1,
      srcResourceID: '0x1111111111111111111111111111111111111111111111111111001000000001',
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));
    assert((await AnchorInstance.edgeIndex('0x01')) == 0);

    await TruffleAssert.reverts(
      updateEdge(edge1, accounts[0], 'LinkableAnchor: This Anchor is at capacity')
    );
  });

  it('latestNeighborRoots should return correct roots', async () => {
    const edge = {
      root: BigNumber.from('0x1111111111111111111111111111111111111111111111111111111111111111'),
      latestLeafIndex: 1,
      srcResourceID: '0x1111111111111111111111111111111111111111111111111111001000000001',
    };

    await TruffleAssert.passes(updateEdge(edge, accounts[0]));
    const roots = await AnchorInstance.getLatestNeighborRoots();
    assert.strictEqual(roots.length, maxRoots);
    assert.strictEqual(roots[0].toString(), edge.root.toString());
  });

  it('Adding edge should emit correct EdgeAddition event', async () => {
    const edge = {
      sourceChainID: BigNumber.from('0x100000000001'),
      root: BigNumber.from('0x1111111111111111111111111111111111111111111111111111111111111111'),
      latestLeafIndex: BigNumber.from(1),
      srcResourceID: '0x1111111111111111111111111111111111111111111111111111100000000001',
    };

    const result = await updateEdge(edge, accounts[0]);

    TruffleAssert.eventEmitted(result, 'EdgeAddition', (ev) => {
      return (
        ev.chainID.toString() == edge.sourceChainID.toString() &&
        ev.latestLeafIndex.toString() == edge.latestLeafIndex &&
        ev.merkleRoot.toString() == edge.root
      );
    });
  });
});
