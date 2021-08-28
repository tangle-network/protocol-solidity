/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");

const Helpers = require('../helpers');

contract('Gas Benchmark - [Deposits]', async (accounts) => {
  const chainID = 1;
  const relayerThreshold = 1;
  const depositerAddress = accounts[1];
  const recipientAddress = accounts[2];
  const lenRecipientAddress = 20;
  const gasBenchmarks = [];

  const erc20TokenAmount = 100;
  const erc721TokenID = 1;

  let BridgeInstance;
  let ERC20MintableInstance;
  let ERC20HandlerInstance;

  let erc20ResourceID;

  before(async () => {
    await Promise.all([
      BridgeContract.new(chainID, [], relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
      ERC20MintableContract.new("token", "TOK").then(instance => ERC20MintableInstance = instance),
    ]);

    erc20ResourceID = Helpers.createResourceID(ERC20MintableInstance.address, chainID);

    const erc20InitialResourceIDs = [erc20ResourceID];
    const erc20InitialContractAddresses = [ERC20MintableInstance.address];
    const erc20BurnableContractAddresses = [];

    await Promise.all([
      ERC20HandlerContract.new(BridgeInstance.address, erc20InitialResourceIDs, erc20InitialContractAddresses, erc20BurnableContractAddresses).then(instance => ERC20HandlerInstance = instance),
      ERC20MintableInstance.mint(depositerAddress, erc20TokenAmount),
    ]);

    await Promise.all([
      ERC20MintableInstance.approve(ERC20HandlerInstance.address, erc20TokenAmount, { from: depositerAddress }),
      BridgeInstance.adminSetResource(ERC20HandlerInstance.address, erc20ResourceID, ERC20MintableInstance.address),
    ]);
  });

  it('Should make ERC20 deposit', async () => {
    const depositTx = await BridgeInstance.deposit(
      chainID,
      erc20ResourceID,
      Helpers.createERCDepositData(
        erc20TokenAmount,
        lenRecipientAddress,
        recipientAddress),
      { from: depositerAddress });

    gasBenchmarks.push({
      type: 'ERC20',
      gasUsed: depositTx.receipt.gasUsed
    });
  });

  it('Should print out benchmarks', () => console.table(gasBenchmarks));
});