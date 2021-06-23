/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const AnchorContract = artifacts.require("Anchor");
const Verifier = artifacts.require("Verifier");
const HasherABI = require('./hasher.json');
const Token = artifacts.require("ERC20Mock");
const USDTToken = artifacts.require('IUSDT')

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Anchor - [add / update edges]', async accounts => {
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
  const sender = accounts[0]
  const operator = accounts[0]
  const levels = 16
  let tokenDenomination = '1000000000000000000' // 1 ether

  beforeEach(async () => {
    HasherFactory = new ethers.ContractFactory(HasherABI);
    hasher = await HasherFactory.deploy();
    verifier = await Verifier.new();
    token = await Token.new();
    await token.mint(sender, tokenDenomination);
    LinkableAnchorInstance = await LinkableAnchorContract.new(
      verifier.address,
      hasher.address,
      merkleTreeHeight,
      tokenDenomination,
    );
    ADMIN_ROLE = await LinkableAnchorInstance.DEFAULT_ADMIN_ROLE()
  });

  it.only('Anchor should have same bridge & admin', async () => {
    assert.isFalse(await AnchorInstance.paused());
  });
});
 
 