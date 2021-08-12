/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');

const BridgeContract = artifacts.require("Bridge");

// This test does NOT include all getter methods, just 
// getters that should work with only the constructor called
contract('Bridge - [admin]', async accounts => {
    const chainID = 1;
    const initialRelayers = accounts.slice(0, 3);
    const initialRelayerThreshold = 2;

    const expectedBridgeAdmin = accounts[0];
    const someAddress = "0xcafecafecafecafecafecafecafecafecafecafe";
    const bytes32 = "0x0";
    let ADMIN_ROLE;
    
    let BridgeInstance;

    const assertOnlyAdmin = (method, ...params) => {
        return TruffleAssert.reverts(method(...params, {from: initialRelayers[1]}), "sender doesn't have admin role");
    };

    beforeEach(async () => {
        BridgeInstance = await BridgeContract.new(chainID, initialRelayers, initialRelayerThreshold, 0, 100);
        ADMIN_ROLE = await BridgeInstance.DEFAULT_ADMIN_ROLE()
    });

    // Testing pausable methods

    it('Bridge should not be paused', async () => {
        assert.isFalse(await BridgeInstance.paused());
    });

    it('Bridge should be paused', async () => {
        await TruffleAssert.passes(BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
    });

    it('Bridge should be unpaused after being paused', async () => {
        await TruffleAssert.passes(BridgeInstance.adminPauseTransfers());
        assert.isTrue(await BridgeInstance.paused());
        await TruffleAssert.passes(BridgeInstance.adminUnpauseTransfers());
        assert.isFalse(await BridgeInstance.paused());
    });

    // Testing relayer methods

    it('_relayerThreshold should be initialRelayerThreshold', async () => {
        assert.equal(await BridgeInstance._relayerThreshold.call(), initialRelayerThreshold);
    });

    it('_relayerThreshold should be initialRelayerThreshold', async () => {
        const newRelayerThreshold = 1;
        await TruffleAssert.passes(BridgeInstance.adminChangeRelayerThreshold(newRelayerThreshold));
        assert.equal(await BridgeInstance._relayerThreshold.call(), newRelayerThreshold);
    });

    it('newRelayer should be added as a relayer', async () => {
        const newRelayer = accounts[4];
        await TruffleAssert.passes(BridgeInstance.adminAddRelayer(newRelayer));
        assert.isTrue(await BridgeInstance.isRelayer(newRelayer));
    });

    it('newRelayer should be removed as a relayer after being added', async () => {
        const newRelayer = accounts[4];
        await TruffleAssert.passes(BridgeInstance.adminAddRelayer(newRelayer));
        assert.isTrue(await BridgeInstance.isRelayer(newRelayer))
        await TruffleAssert.passes(BridgeInstance.adminRemoveRelayer(newRelayer));
        assert.isFalse(await BridgeInstance.isRelayer(newRelayer));
    });

    it('existingRelayer should not be able to be added as a relayer', async () => {
        const existingRelayer = accounts[1];
        await TruffleAssert.reverts(BridgeInstance.adminAddRelayer(existingRelayer));
        assert.isTrue(await BridgeInstance.isRelayer(existingRelayer));
    }); 

    it('nonRelayerAddr should not be able to be added as a relayer', async () => {
        const nonRelayerAddr = accounts[4];
        await TruffleAssert.reverts(BridgeInstance.adminRemoveRelayer(nonRelayerAddr));
        assert.isFalse(await BridgeInstance.isRelayer(nonRelayerAddr));
    });

    // Testing ownership methods

    it('Bridge admin should be expectedBridgeAdmin', async () => {
        assert.isTrue(await BridgeInstance.hasRole(ADMIN_ROLE, expectedBridgeAdmin));
    });

    it('Bridge admin should be changed to expectedBridgeAdmin', async () => {
        const expectedBridgeAdmin2 = accounts[1];
        await TruffleAssert.passes(BridgeInstance.renounceAdmin(expectedBridgeAdmin2))
        assert.isTrue(await BridgeInstance.hasRole(ADMIN_ROLE, expectedBridgeAdmin2));
    });
});
