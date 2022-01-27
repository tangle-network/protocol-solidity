/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 import { toHex } from '../../packages/utils/src';
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

  it('should check ownership is transferred to new governor', async () => {
    const nonceString = toHex(1, 4);
    const msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + nextGovernor.address.slice(2)).toString());
    const signedMessage = await sender.signMessage(msg);
    await governableInstance.transferOwnershipWithSignature(nextGovernor.address, 1, signedMessage);
    assert.strictEqual((await governableInstance.governor()), nextGovernor.address);
  });

  it('failing test: non-governor should not be able to transfer ownership', async() => {
    await TruffleAssert.reverts(
      governableInstance.connect(nextGovernor).transferOwnership(nextGovernor.address, 1),
      'Governable: caller is not the governor',
    );
  });

  it('failing test: old governor should not be able to call an onlyGovernor function', async () => {
    const nonceString = toHex(1, 4);
    const msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + nextGovernor.address.slice(2)).toString());
    const signedMessage = await sender.signMessage(msg);

    await governableInstance.transferOwnershipWithSignature(nextGovernor.address, 1, signedMessage);
    
    await TruffleAssert.reverts(
      governableInstance.connect(sender).transferOwnership(nextGovernor.address, 2),
      'Governable: caller is not the governor',
    );
  });

  it('failing test replay attack', async () => {
    const nonceString = toHex(1, 4);
    const msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + nextGovernor.address.slice(2)).toString());
    const signedMessage = await sender.signMessage(msg);

    await governableInstance.transferOwnershipWithSignature(nextGovernor.address, 1, signedMessage);
    
    await TruffleAssert.reverts(
      governableInstance.connect(arbSigner).transferOwnershipWithSignature(arbSigner.address, 2, signedMessage),
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
});
