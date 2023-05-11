/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
// @ts-nocheck
const assert = require('assert');
import { ethers, network } from 'hardhat';
import BN from 'bn.js';
import { toFixedHex, toHex } from '@webb-tools/sdk-core';
import EC from 'elliptic';
const ec = new EC.ec('secp256k1');
const TruffleAssert = require('truffle-assertions');

import { Governable, Governable__factory } from '@webb-tools/contracts';
import { ethers } from 'ethers';

describe('Governable Contract', () => {
  let governableInstance: Governable;
  let sender: ethers.Signer;
  let nextGovernor: ethers.Signer;
  let arbSigner: ethers.Signer;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    nextGovernor = signers[1];
    arbSigner = signers[2];
    // create poseidon hasher
    const govFactory = new Governable__factory(wallet);
    governableInstance = await govFactory.deploy(sender.address, 0);
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
    const key = ec.keyFromPrivate(wallet.privateKey.slice(2), 'hex');
    const pubkey = key.getPublic().encode('hex').slice(2);
    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256(publicKey).slice(-40)
    );
    let firstRotationKey = nextGovernorAddress;
    await governableInstance.transferOwnership(nextGovernorAddress, 1);
    assert.strictEqual(await governableInstance.governor(), nextGovernorAddress);
    // Set next governor to the same pub key for posterity
    let nonceString = toHex(2, 4);
    // msg to be signed is hash(nonce + pubkey)
    const dummy = ethers.Wallet.createRandom();
    const dummyPubkey = ec
      .keyFromPrivate(dummy.privateKey, 'hex')
      .getPublic()
      .encode('hex')
      .slice(2);
    let prehashed = nonceString + dummyPubkey;
    let msg = ethers.utils.arrayify(ethers.utils.keccak256(prehashed));
    let signature = key.sign(msg);
    let expandedSig = {
      r: '0x' + signature.r.toString('hex'),
      s: '0x' + signature.s.toString('hex'),
      v: signature.recoveryParam + 27,
    };

    // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
    // https://ethereum.stackexchange.com/questions/55245/why-is-s-in-transaction-signature-limited-to-n-21
    let sig;
    try {
      sig = ethers.utils.joinSignature(expandedSig);
    } catch (e) {
      expandedSig.s = '0x' + new BN(ec.curve.n).sub(signature.s).toString('hex');
      expandedSig.v = expandedSig.v === 27 ? 28 : 27;
      sig = ethers.utils.joinSignature(expandedSig);
    }

    await governableInstance.transferOwnershipWithSignaturePubKey('0x' + dummyPubkey, 2, sig);
    nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256('0x' + dummyPubkey).slice(-40)
    );
    assert.strictEqual(await governableInstance.governor(), nextGovernorAddress);

    const filter = governableInstance.filters.GovernanceOwnershipTransferred();
    const events = await governableInstance.queryFilter(filter);
    assert.strictEqual(nextGovernorAddress, events[2].args.newOwner);
    assert.strictEqual(firstRotationKey, events[2].args.previousOwner);
  });

  it('proposer set data should update properly', async () => {
    // Transfer ownership to an address we can sign with
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '0');
    const wallet = ethers.Wallet.createRandom();
    const key = ec.keyFromPrivate(wallet.privateKey.slice(2), 'hex');
    const pubkey = key.getPublic().encode('hex').slice(2);
    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256(publicKey).slice(-40)
    );
    await governableInstance.transferOwnership(nextGovernorAddress, 1);
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '1');

    const dummyProposerSetRoot =
      '0x5555555555555555555555555555555555555555555555555555555555555555';
    const dummyAverageSessionLengthInMilliseconds = 50000;
    const dummyNumOfProposers = 4;
    const dummyProposerSetUpdateNonce = 1;

    const prehashed =
      dummyProposerSetRoot +
      toFixedHex(dummyAverageSessionLengthInMilliseconds, 8).slice(2) +
      toFixedHex(dummyNumOfProposers, 4).slice(2) +
      toFixedHex(dummyProposerSetUpdateNonce, 4).slice(2);

    let msg = ethers.utils.arrayify(ethers.utils.keccak256(prehashed));
    let signature = key.sign(msg);
    let expandedSig = {
      r: '0x' + signature.r.toString('hex'),
      s: '0x' + signature.s.toString('hex'),
      v: signature.recoveryParam + 27,
    };

    // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
    // https://ethereum.stackexchange.com/questions/55245/why-is-s-in-transaction-signature-limited-to-n-21
    let sig;
    try {
      sig = ethers.utils.joinSignature(expandedSig);
    } catch (e) {
      expandedSig.s = '0x' + new BN(ec.curve.n).sub(signature.s).toString('hex');
      expandedSig.v = expandedSig.v === 27 ? 28 : 27;
      sig = ethers.utils.joinSignature(expandedSig);
    }

    await governableInstance.updateProposerSetData(
      dummyProposerSetRoot,
      dummyAverageSessionLengthInMilliseconds,
      dummyNumOfProposers,
      dummyProposerSetUpdateNonce,
      sig
    );

    assert.strictEqual(
      (await governableInstance.averageSessionLengthInMillisecs()).toString(),
      '50000'
    );
    assert.strictEqual((await governableInstance.proposerSetUpdateNonce()).toString(), '1');
    assert.strictEqual((await governableInstance.numOfProposers()).toString(), '4');
    assert.strictEqual(await governableInstance.proposerSetRoot(), dummyProposerSetRoot);
  });

  it('should vote validly and change the governor', async () => {
    const voteStruct = {
      leafIndex: 0,
      siblingPathNodes: ['0x0000000000000000000000000000000000000000000000000000000000000001'],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await TruffleAssert.reverts(
      governableInstance.voteInFavorForceSetGovernor(voteStruct),
      'Invalid time for vote'
    );

    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '0');
    const wallet = ethers.Wallet.createRandom();
    const key = ec.keyFromPrivate(wallet.privateKey.slice(2), 'hex');
    const pubkey = key.getPublic().encode('hex').slice(2);
    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress(
      '0x' + ethers.utils.keccak256(publicKey).slice(-40)
    );
    await governableInstance.transferOwnership(nextGovernorAddress, 1);
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '1');

    const signers = await ethers.getSigners();

    const proposer0Signer = signers[0];
    const proposer0 = signers[0].address;

    const proposer1Signer = signers[1];
    const proposer1 = signers[1].address;

    const proposer2Signer = signers[2];
    const proposer2 = signers[2].address;

    const proposer3Signer = signers[3];
    const proposer3 = signers[3].address;

    const hashProposer0 = ethers.utils.keccak256(proposer0);
    const hashProposer1 = ethers.utils.keccak256(proposer1);
    const hashProposer2 = ethers.utils.keccak256(proposer2);
    const hashProposer3 = ethers.utils.keccak256(proposer3);

    const hashProposer01 = ethers.utils.keccak256(hashProposer0 + hashProposer1.slice(2));
    const hashProposer23 = ethers.utils.keccak256(hashProposer2 + hashProposer3.slice(2));

    const hashProposer0123 = ethers.utils.keccak256(hashProposer01 + hashProposer23.slice(2));

    const proposerSetRoot = hashProposer0123;
    const averageSessionLengthInMilliseconds = 50000;
    const numOfProposers = 4;
    const proposerSetUpdateNonce = 1;

    const prehashed =
      proposerSetRoot +
      toFixedHex(averageSessionLengthInMilliseconds, 8).slice(2) +
      toFixedHex(numOfProposers, 4).slice(2) +
      toFixedHex(proposerSetUpdateNonce, 4).slice(2);

    let msg = ethers.utils.arrayify(ethers.utils.keccak256(prehashed));
    let signature = key.sign(msg);
    let expandedSig = {
      r: '0x' + signature.r.toString('hex'),
      s: '0x' + signature.s.toString('hex'),
      v: signature.recoveryParam + 27,
    };

    // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
    // https://ethereum.stackexchange.com/questions/55245/why-is-s-in-transaction-signature-limited-to-n-21
    let sig;
    try {
      sig = ethers.utils.joinSignature(expandedSig);
    } catch (e) {
      expandedSig.s = '0x' + new BN(ec.curve.n).sub(signature.s).toString('hex');
      expandedSig.v = expandedSig.v === 27 ? 28 : 27;
      sig = ethers.utils.joinSignature(expandedSig);
    }

    await governableInstance.updateProposerSetData(
      proposerSetRoot,
      averageSessionLengthInMilliseconds,
      numOfProposers,
      proposerSetUpdateNonce,
      sig
    );

    assert.strictEqual(
      (await governableInstance.averageSessionLengthInMillisecs()).toString(),
      '50000'
    );
    assert.strictEqual((await governableInstance.proposerSetUpdateNonce()).toString(), '1');
    assert.strictEqual((await governableInstance.numOfProposers()).toString(), '4');
    assert.strictEqual(await governableInstance.proposerSetRoot(), proposerSetRoot);
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '2');
    await network.provider.send('evm_increaseTime', [600]);

    const voteProposer0 = {
      leafIndex: 0,
      siblingPathNodes: [hashProposer1, hashProposer23],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await governableInstance.connect(proposer0Signer).voteInFavorForceSetGovernor(voteProposer0);

    assert.notEqual(
      await governableInstance.governor(),
      '0x1111111111111111111111111111111111111111'
    );

    await TruffleAssert.reverts(
      governableInstance.connect(proposer0Signer).voteInFavorForceSetGovernor(voteProposer0),
      'already voted'
    );

    const voteProposer1 = {
      leafIndex: 1,
      siblingPathNodes: [hashProposer0, hashProposer23],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await governableInstance.connect(proposer1Signer).voteInFavorForceSetGovernor(voteProposer1);

    assert.notEqual(
      await governableInstance.governor(),
      '0x1111111111111111111111111111111111111111'
    );

    const voteProposer2 = {
      leafIndex: 2,
      siblingPathNodes: [hashProposer3, hashProposer01],
      proposedGovernor: '0x1111111111111111111111111111111111111111',
    };

    await governableInstance.connect(proposer2Signer).voteInFavorForceSetGovernor(voteProposer2);

    assert.strictEqual(
      await governableInstance.governor(),
      '0x1111111111111111111111111111111111111111'
    );
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '3');
  });
});
