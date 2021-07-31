/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");
const ERC20HandlerContract = artifacts.require("ERC20Handler");
const ERC20MintableContract = artifacts.require("ERC20PresetMinterPauser");

contract('Gas Benchmark - [Execute Proposal]', async (accounts) => {
    const chainID = 1;
    const relayerThreshold = 1;
    const relayerAddress = accounts[0];
    const depositerAddress = accounts[1];
    const recipientAddress = accounts[2];
    const lenRecipientAddress = 20;
    const gasBenchmarks = [];

    const initialRelayers = [relayerAddress];
    const erc20TokenAmount = 100;

    let BridgeInstance;
    let ERC20MintableInstance;
    let ERC20HandlerInstance;

    let erc20ResourceID;

    const deposit = (resourceID, depositData) => BridgeInstance.deposit(chainID, resourceID, depositData, { from: depositerAddress });
    const vote = (resourceID, depositNonce, depositDataHash) => BridgeInstance.voteProposal(chainID, depositNonce, resourceID, depositDataHash, { from: relayerAddress });
    const execute = (depositNonce, depositData, resourceID) => BridgeInstance.executeProposal(chainID, depositNonce, depositData, resourceID);

    before(async () => {
        await Promise.all([
            BridgeContract.new(chainID, initialRelayers, relayerThreshold, 0, 100).then(instance => BridgeInstance = instance),
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

    it('Should execute ERC20 deposit proposal', async () => {
        const depositNonce = 1;
        const depositData = Helpers.createERCDepositData(
            erc20TokenAmount,
            lenRecipientAddress,
            recipientAddress);
        const depositDataHash = Ethers.utils.keccak256(ERC20HandlerInstance.address + depositData.substr(2));

        await deposit(erc20ResourceID, depositData);
        await vote(erc20ResourceID, depositNonce, depositDataHash, relayerAddress);

        const executeTx = await execute(depositNonce, depositData, erc20ResourceID);

        gasBenchmarks.push({
            type: 'ERC20',
            gasUsed: executeTx.receipt.gasUsed
        });
    });
    
    it('Should print out benchmarks', () => console.table(gasBenchmarks));
});
