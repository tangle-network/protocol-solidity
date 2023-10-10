/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

import { randomBN, poseidonSpongeHash } from '@webb-tools/utils';
import { BigNumber } from 'ethers';
import { contract, ethers } from 'hardhat';
import { PoseidonHasher } from '@webb-tools/anchors';
const assert = require('assert');
import { poseidon } from 'circomlibjs';

contract('Poseidon hasher', (accounts) => {
    let hasherInstance: PoseidonHasher;
    const sender = accounts[0];

    beforeEach(async () => {
        const signers = await ethers.getSigners();
        const wallet = signers[0];
        hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    });

    describe('#sponge-hash', () => {
        it('should hash random values of 6-elements array', async () => {
            const inputs: any = [];
            for (let i = 0; i < 6; i++) {
                inputs.push(randomBN());
            }
            let contractResult = await hasherInstance.contract.hash6(inputs);
            let result = poseidon(inputs);
            assert.strictEqual(result.toString(), contractResult.toString());
        });
        it('should hash random values of 50-elements array', async () => {
            const inputs: any = [];
            for (let i = 0; i < 50; i++) {
                inputs.push(randomBN());
            }
            let contractResult = await hasherInstance.contract.hash(inputs);
            let result = poseidonSpongeHash(inputs);
            assert.strictEqual(result.toString(), contractResult.toString());
        });
    });
});
