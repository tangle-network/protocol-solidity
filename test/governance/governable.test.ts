/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 import BN from 'bn.js';
 import { toHex } from '../../packages/utils/src';
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

  it('should recover signer', async () => {
    const msg = 'message to sign';
    const signedMessage = await sender.signMessage(msg);

    const prefixedMsg = "\x19Ethereum Signed Message:\n" + msg.length + msg;
    var msgBuffer = [];
    var buffer = new Buffer(prefixedMsg, 'utf8');
    for (var i = 0; i < buffer.length; i++) {
      msgBuffer.push(buffer[i]);
    }

    await governableInstance.recover(msgBuffer, signedMessage);
    const filter = governableInstance.filters.RecoveredAddress();
    const events = await governableInstance.queryFilter(filter);
    assert.strictEqual(sender.address, events[0].args.recovered);
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
    const nonceString = toHex(1, 4);
    const publicKey = '0x91a27f998f3971e5b62bbde231264271faf91f837c506fde88c4bfb9c533f1c2c7b40c9fdca6815d43b315c8b039ecda1ba7eabd97794496c3023730581d7d63'; //from Artem's Notion
    const msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + publicKey.slice(2)).toString());
    const signedMessage = await sender.signMessage(msg);
    await governableInstance.transferOwnershipWithSignaturePubKey(publicKey, 1, signedMessage);
    const nextGovernorAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256(publicKey).slice(-40));
    assert.strictEqual((await governableInstance.governor()), nextGovernorAddress);

    const filter = governableInstance.filters.GovernanceOwnershipTransferred();
    const events = await governableInstance.queryFilter(filter);
    assert.strictEqual(nextGovernorAddress, events[1].args.newOwner);
    assert.strictEqual(sender.address, events[1].args.previousOwner);
  });

  it.only('should check ownership is transferred to new governor via signed public key', async () => {
    const wallet = ethers.Wallet.createRandom();
    // raw keypair
    const key = ec.keyFromPrivate(wallet.privateKey, 'hex');
    // uncompressed pub key
    const pubkey = key.getPublic().encode('hex').slice(2);
    // Set next governor to pub key
    let nonceString = toHex(1, 4);
    const publicKey = '0x' + pubkey;
    let msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + publicKey.slice(2)).toString());
    const signedMessage = await sender.signMessage(msg);
    await governableInstance.transferOwnershipWithSignaturePubKey(publicKey, 1, signedMessage);
    let nextGovernorAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256(publicKey).slice(-40));
    assert.strictEqual((await governableInstance.governor()), nextGovernorAddress);
    // Set next governor to the same pub key for posterity
    nonceString = toHex(2, 4);
    // msg to be signed is hash(nonce + pubkey)
    msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + pubkey).toString());
    const prefix = Buffer.from(`\u0019Ethereum Signed Message:\n32`, 'utf-8')
    const prefixedMsgHash = ethers.utils.keccak256(Buffer.concat([prefix, msg]));
    let signature = key.sign(ethers.utils.arrayify(prefixedMsgHash));
    let expandedSig = {
      r: '0x' + signature.r.toString('hex'),
      s: '0x' + signature.s.toString('hex'),
      v: signature.recoveryParam + 27,
    }

    let sig;
    // Transaction malleability fix if s is too large (Bitcoin allows it, Ethereum rejects it)
    try {
      sig = ethers.utils.joinSignature(expandedSig)
    } catch (e) {
      expandedSig.s = '0x' + (new BN(ec.curve.n).sub(signature.s)).toString('hex');
      expandedSig.v = (expandedSig.v === 27) ? 28 : 27;
      sig = ethers.utils.joinSignature(expandedSig)
    }

    await governableInstance.transferOwnershipWithSignaturePubKey(publicKey, 2, sig);
    nextGovernorAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256(publicKey).slice(-40));
    assert.strictEqual((await governableInstance.governor()), nextGovernorAddress);

    const filter = governableInstance.filters.GovernanceOwnershipTransferred();
    const events = await governableInstance.queryFilter(filter);
    assert.strictEqual(nextGovernorAddress, events[1].args.newOwner);
    assert.strictEqual(sender.address, events[1].args.previousOwner);
  });
});
