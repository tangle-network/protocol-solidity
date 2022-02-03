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
    const key = ec.keyFromPrivate(wallet.privateKey, 'hex');
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

  it('raw', async () => {
    let sig = '0x776bebe24eebf75990a7158aeb4f4fa563c71d14a6876b36ec1087f6e78afddb074a88f798e48ae32cf3f4c518223c3dd7d89182672de9b2bb6c17ce03c4d3ef1b'
    let data = '0x00000002d3d646965dd86228efdbc95029cdf6129ac8b79780fa8074f74dcf2f85e0f91fe961b448783fff507cd469ead2c3a31552c213ab7490770e50e520676a4bdc2d'
    let address = '0x1b0eA47E1ff1c2859AD8e998B1AbC51B6b341b7c'
    console.log(address, await governableInstance.recover(data, sig));
  })
});
