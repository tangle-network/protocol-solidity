/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
// @ts-nocheck
const assert = require('assert');
import { ethers, network } from 'hardhat';
import { toFixedHex, toHex } from '@webb-tools/utils';
const TruffleAssert = require('truffle-assertions');

import { Governable, Governable__factory } from '@webb-tools/contracts';
import type { Signer } from 'ethers';
import { ZERO_BYTES32 } from '@webb-tools/utils';
import { keccak256, recoverAddress, solidityPack } from 'ethers/lib/utils';

describe('Governable Contract', () => {
  let governableInstance: Governable;
  let sender: Signer;
  let nextGovernor: Signer;
  let arbSigner: Signer;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    nextGovernor = signers[1];
    arbSigner = signers[2];
    // create poseidon hasher
    const govFactory = new Governable__factory(wallet);
    governableInstance = await govFactory.deploy(sender.address, 0, 0);
    await governableInstance.deployed();
  });

  it('should check governor', async () => {
    assert.strictEqual(await governableInstance.governor(), sender.address);
  });

  it('failing test: non-governor should not be able to transfer ownership', async () => {
    await TruffleAssert.reverts(
      governableInstance.connect(nextGovernor).transferOwnership(nextGovernor.address, 1),
      'Governable: caller is not the governor'
    );
  });

  it('test renounce ownership', async () => {
    await governableInstance.renounceOwnership();
    assert.strictEqual(
      (await governableInstance.governor()).toString(),
      '0x0000000000000000000000000000000000000000'
    );

    await TruffleAssert.reverts(
      governableInstance.connect(sender).transferOwnership(nextGovernor.address, 1),
      'Governable: caller is not the governor'
    );
  });

  it('should check ownership is transferred to new governor via signed public key', async () => {
    const wallet = ethers.Wallet.createRandom();
    const pubkey = ethers.utils.computePublicKey(wallet.privateKey, false).slice(4);

    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256(publicKey).slice(-40)
    );
    const firstRotationKey = nextGovernorAddress;
    await governableInstance.transferOwnership(nextGovernorAddress, 1);

    const dummy = ethers.Wallet.createRandom();
    const dummyPubkey = ethers.utils.computePublicKey(dummy.privateKey, false).slice(4);

    nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256('0x' + dummyPubkey).slice(-40)
    );

    const refreshProposal = {
      voterMerkleRoot: ZERO_BYTES32,
      averageSessionLengthInMillisecs: '50000',
      voterCount: '1',
      nonce: '2',
      publicKey: `0x${dummyPubkey}`,
    };

    const prehashed = solidityPack(
      ['bytes32', 'uint64', 'uint32', 'uint32', 'bytes'],
      [
        refreshProposal.voterMerkleRoot,
        refreshProposal.averageSessionLengthInMillisecs,
        refreshProposal.voterCount,
        refreshProposal.nonce,
        refreshProposal.publicKey,
      ]
    );

    const digest = ethers.utils.keccak256(prehashed);
    const sig = ethers.utils.joinSignature(wallet._signingKey().signDigest(digest));

    const tx = await governableInstance.transferOwnershipWithSignature(
      refreshProposal.voterMerkleRoot,
      refreshProposal.averageSessionLengthInMillisecs,
      refreshProposal.voterCount,
      refreshProposal.nonce,
      refreshProposal.publicKey,
      sig
    );
    await tx.wait();

    assert.strictEqual(await governableInstance.governor(), nextGovernorAddress);
    assert.strictEqual(
      (await governableInstance.voterCount()).toString(),
      refreshProposal.voterCount
    );
    assert.strictEqual(await governableInstance.voterMerkleRoot(), refreshProposal.voterMerkleRoot);
    assert.strictEqual((await governableInstance.refreshNonce()).toString(), '2');

    const filter = governableInstance.filters.GovernanceOwnershipTransferred();
    const events = await governableInstance.queryFilter(filter);
    assert.strictEqual(nextGovernorAddress, events[2].args.newOwner);
    assert.strictEqual(firstRotationKey, events[2].args.previousOwner);
  });

  it('should vote validly and change the governor', async () => {
    const voteStruct = {
      nonce: await governableInstance.refreshNonce(),
      leafIndex: 0,
      siblingPathNodes: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await TruffleAssert.reverts(
      governableInstance.voteInFavorForceSetGovernor(voteStruct),
      'Invalid time for vote'
    );

    assert.strictEqual((await governableInstance.refreshNonce()).toString(), '0');
    const wallet = ethers.Wallet.createRandom();
    const pubkey = ethers.utils.computePublicKey(wallet.privateKey, false).slice(4);
    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256(publicKey).slice(-40)
    );
    const firstRotationKey = nextGovernorAddress;
    await governableInstance.transferOwnership(nextGovernorAddress, 1);

    const dummy = ethers.Wallet.createRandom();
    const dummyPubkey = ethers.utils.computePublicKey(dummy.privateKey, false).slice(4);

    const nonce = 2;

    const signers = await ethers.getSigners();

    const voter0Signer = signers[0];
    const voter0 = signers[0].address;

    const voter1Signer = signers[1];
    const voter1 = signers[1].address;

    const voter2Signer = signers[2];
    const voter2 = signers[2].address;

    const voter3 = signers[3].address;

    const hashVoter0 = ethers.utils.keccak256(voter0);
    const hashVoter1 = ethers.utils.keccak256(voter1);
    const hashVoter2 = ethers.utils.keccak256(voter2);
    const hashVoter3 = ethers.utils.keccak256(voter3);

    const hashVoter01 = ethers.utils.keccak256(hashVoter0 + hashVoter1.slice(2));
    const hashVoter23 = ethers.utils.keccak256(hashVoter2 + hashVoter3.slice(2));

    const hashVoter0123 = ethers.utils.keccak256(hashVoter01 + hashVoter23.slice(2));

    const voterMerkleRoot = hashVoter0123;
    const averageSessionLengthInMillisecs = 50000;
    const voterCount = 4;

    const refreshProposal = {
      voterMerkleRoot,
      averageSessionLengthInMillisecs,
      voterCount,
      nonce,
      publicKey: `0x${dummyPubkey}`,
    };

    const prehashed = solidityPack(
      ['bytes32', 'uint64', 'uint32', 'uint32', 'bytes'],
      [
        refreshProposal.voterMerkleRoot,
        refreshProposal.averageSessionLengthInMillisecs,
        refreshProposal.voterCount,
        refreshProposal.nonce,
        refreshProposal.publicKey,
      ]
    );

    const digest = ethers.utils.keccak256(prehashed);
    const sig = ethers.utils.joinSignature(wallet._signingKey().signDigest(digest));

    const tx = await governableInstance.transferOwnershipWithSignature(
      refreshProposal.voterMerkleRoot,
      refreshProposal.averageSessionLengthInMillisecs,
      refreshProposal.voterCount,
      refreshProposal.nonce,
      refreshProposal.publicKey,
      sig
    );
    await tx.wait();

    assert.strictEqual(
      (await governableInstance.averageSessionLengthInMillisecs()).toString(),
      averageSessionLengthInMillisecs.toString()
    );
    assert.strictEqual((await governableInstance.voterCount()).toString(), '4');
    assert.strictEqual(await governableInstance.voterMerkleRoot(), voterMerkleRoot);
    assert.strictEqual((await governableInstance.refreshNonce()).toString(), '2');
    await network.provider.send('evm_increaseTime', [600]);

    const vote0 = {
      nonce: await governableInstance.refreshNonce(),
      leafIndex: 0,
      siblingPathNodes: [hashVoter1, hashVoter23],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await governableInstance.connect(voter0Signer).voteInFavorForceSetGovernor(vote0);

    assert.notEqual(
      await governableInstance.governor(),
      '0x1111111111111111111111111111111111111111'
    );

    const vote1 = {
      nonce: await governableInstance.refreshNonce(),
      leafIndex: 1,
      siblingPathNodes: [hashVoter0, hashVoter23],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await governableInstance.connect(voter1Signer).voteInFavorForceSetGovernor(vote1);

    assert.notEqual(
      await governableInstance.governor(),
      '0x1111111111111111111111111111111111111111'
    );

    const vote2 = {
      nonce: await governableInstance.refreshNonce(),

      leafIndex: 2,
      siblingPathNodes: [hashVoter3, hashVoter01],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await governableInstance.connect(voter2Signer).voteInFavorForceSetGovernor(vote2);

    assert.strictEqual(
      await governableInstance.governor(),
      '0x1111111111111111111111111111111111111111'
    );
    assert.strictEqual((await governableInstance.refreshNonce()).toString(), '3');
  });
});
