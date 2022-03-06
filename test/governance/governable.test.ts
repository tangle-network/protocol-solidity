/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 import BN from 'bn.js';
 import { toFixedHex, toHex } from '../../packages/utils/src';
 import EC from 'elliptic';
 const ec = new EC.ec('secp256k1');
 const TruffleAssert = require('truffle-assertions');
 
 // Convenience wrapper classes for contract classes
 import { Governable__factory } from '../../typechain';
 
 describe('Governable Contract', () => {
  let governableInstance;
  let sender;
  let nextGovernor;
  let arbSigner;
  let hashMessage;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    nextGovernor = signers[1];
    arbSigner = signers[2];
    // create poseidon hasher
    const govFactory = new Governable__factory(wallet);
    governableInstance = await govFactory.deploy(sender.address);
    await governableInstance.deployed();
  });
 
  it('should check governor', async () => {
    assert.strictEqual((await governableInstance.governor()), sender.address);
  });

  it('failing test: non-governor should not be able to transfer ownership', async() => {
    await TruffleAssert.reverts(
      governableInstance.connect(nextGovernor).transferOwnership(nextGovernor.address, 1),
      'Governable: caller is not the governor',
    );
  });

  it('test renounce ownership', async() => {
    await governableInstance.renounceOwnership();
    assert.strictEqual((await governableInstance.governor()).toString(), '0x0000000000000000000000000000000000000000');

    await TruffleAssert.reverts(
      governableInstance.connect(sender).transferOwnership(nextGovernor.address, 1),
      'Governable: caller is not the governor',
    );
  });

  it('should check ownership is transferred to new governor via signed public key', async () => {
    const wallet = ethers.Wallet.createRandom();
    const key = ec.keyFromPrivate(wallet.privateKey.slice(2), 'hex');
    const pubkey = key.getPublic().encode('hex').slice(2);
    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256(publicKey).slice(-40));
    let firstRotationKey = nextGovernorAddress;
    await governableInstance.transferOwnership(nextGovernorAddress, 1);
    assert.strictEqual((await governableInstance.governor()), nextGovernorAddress);
    // Set next governor to the same pub key for posterity
    let nonceString = toHex(2, 4);
    // msg to be signed is hash(nonce + pubkey)
    const dummy = ethers.Wallet.createRandom();
    const dummyPubkey = ec.keyFromPrivate(dummy.privateKey, 'hex').getPublic().encode('hex').slice(2);
    let prehashed = nonceString + dummyPubkey;
    let msg = ethers.utils.arrayify(ethers.utils.keccak256(prehashed));
    let signature = key.sign(msg);
    let expandedSig = { r: '0x' + signature.r.toString('hex'), s: '0x' + signature.s.toString('hex'), v: signature.recoveryParam + 27 }

    // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
    // https://ethereum.stackexchange.com/questions/55245/why-is-s-in-transaction-signature-limited-to-n-21
    let sig;
    try {
      sig = ethers.utils.joinSignature(expandedSig)
    } catch (e) {
      expandedSig.s = '0x' + (new BN(ec.curve.n).sub(signature.s)).toString('hex');
      expandedSig.v = (expandedSig.v === 27) ? 28 : 27;
      sig = ethers.utils.joinSignature(expandedSig)
    }

    await governableInstance.transferOwnershipWithSignaturePubKey('0x' + dummyPubkey, 2, sig);
    nextGovernorAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256('0x' + dummyPubkey).slice(-40));
    assert.strictEqual((await governableInstance.governor()), nextGovernorAddress);

    const filter = governableInstance.filters.GovernanceOwnershipTransferred();
    const events = await governableInstance.queryFilter(filter);
    assert.strictEqual(nextGovernorAddress, events[2].args.newOwner);
    assert.strictEqual(firstRotationKey, events[2].args.previousOwner);
  });

  it.only('proposer set data should update properly', async() => {
    // Transfer ownership to an address we can sign with
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '0');
    const wallet = ethers.Wallet.createRandom();
    const key = ec.keyFromPrivate(wallet.privateKey.slice(2), 'hex');
    const pubkey = key.getPublic().encode('hex').slice(2);
    const publicKey = '0x' + pubkey;
    let nextGovernorAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256(publicKey).slice(-40));
    await governableInstance.transferOwnership(nextGovernorAddress, 1);
    assert.strictEqual((await governableInstance.currentVotingPeriod()).toString(), '1');
    
    const dummyProposerSetRoot = '0x5555555555555555555555555555555555555555555555555555555555555555'
    const dummyAverageSessionLengthInMilliseconds = 50000;
    const dummyNumOfProposers = 4;
    const dummyProposerSetUpdateNonce = 1;
    
    const prehashed = dummyProposerSetRoot + toFixedHex(dummyAverageSessionLengthInMilliseconds, 8).slice(2) + toFixedHex(dummyNumOfProposers, 4).slice(2) + toFixedHex(dummyProposerSetUpdateNonce, 4).slice(2);

    let msg = ethers.utils.arrayify(ethers.utils.keccak256(prehashed));
    let signature = key.sign(msg);
    let expandedSig = { r: '0x' + signature.r.toString('hex'), s: '0x' + signature.s.toString('hex'), v: signature.recoveryParam + 27 }

    // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
    // https://ethereum.stackexchange.com/questions/55245/why-is-s-in-transaction-signature-limited-to-n-21
    let sig;
    try {
      sig = ethers.utils.joinSignature(expandedSig)
    } catch (e) {
      expandedSig.s = '0x' + (new BN(ec.curve.n).sub(signature.s)).toString('hex');
      expandedSig.v = (expandedSig.v === 27) ? 28 : 27;
      sig = ethers.utils.joinSignature(expandedSig)
    }

    await governableInstance.updateProposerSetData(dummyProposerSetRoot, dummyAverageSessionLengthInMilliseconds, dummyNumOfProposers, dummyProposerSetUpdateNonce, sig);

    assert.strictEqual((await governableInstance.averageSessionLengthInMillisecs()).toString(), '50000');
    assert.strictEqual((await governableInstance.proposerSetUpdateNonce()).toString(), '1');
    assert.strictEqual((await governableInstance.numOfProposers()).toString(), '4');
    assert.strictEqual((await governableInstance.proposerSetRoot()), dummyProposerSetRoot);
  });
});
