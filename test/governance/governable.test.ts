/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 const path = require('path');
 import { ethers } from 'hardhat';
 import { BigNumber } from 'ethers';
 import { toFixedHex } from '@webb-tools/utils';
 
 // Convenience wrapper classes for contract classes
 import { GovernedTokenWrapper } from '@webb-tools/tokens';
 import { Governable__factory } from '../../typechain';

 let elliptic = require('elliptic');
 let sha3 = require('js-sha3');
 let ec = new elliptic.ec('secp256k1');
 
 describe('Governable Contract', () => {
  let governableInstance;
  let sender;
  let nextGovernor;

  before(async () => {
    const signers = await ethers.getSigners();
    signers[0].signMessage
    const wallet = signers[0];
    sender = wallet;
    nextGovernor = signers[1];
    // create poseidon hasher
    const govFactory = new Governable__factory(wallet);
    governableInstance = await govFactory.deploy();
    await governableInstance.deployed();
  });
 
  it.only('should check governor', async () => {
    assert.strictEqual((await governableInstance.governor()), sender.address);
  });

  it.only('should recover signer', async () => {
    let elliptic = require('elliptic');
    let sha3 = require('js-sha3');
    let ec = new elliptic.ec('secp256k1');

    // let keyPair = ec.genKeyPair();
    sender.privateKey; 
    let keyPair = ec.keyFromPrivate("97ddae0f3a25b92268175400149d65d6887b9cefaf28ea2c078e05cdc15a3c0a");
    let privKey = keyPair.getPrivate("hex");
    let pubKey = keyPair.getPublic();
    console.log(`Private key: ${privKey}`);
    console.log("Public key :", pubKey.encode("hex").substr(2));
    console.log("Public key (compressed):",
        pubKey.encodeCompressed("hex"));

    console.log();

    let msg = 'Message for signing';
    let msgHash = sha3.keccak256(msg);
    let signature = ec.sign(msgHash, privKey, "hex", {canonical: true});
    console.log(`Msg: ${msg}`);
    console.log(`Msg hash: ${msgHash}`);
    console.log("Signature:", signature);

    console.log();

    let hexToDecimal = (x) => ec.keyFromPrivate(x, "hex").getPrivate().toString(10);
    let pubKeyRecovered = ec.recoverPubKey(
        hexToDecimal(msgHash), signature, signature.recoveryParam, "hex");
    console.log("Recovered pubKey:", pubKeyRecovered.encodeCompressed("hex"));

    let validSig = ec.verify(msgHash, signature, pubKeyRecovered);
    console.log("Signature valid?", validSig);
   
    await governableInstance.recover(BigNumber.from('0x' + msgHash.toString()), toFixedHex(signature.r) + toFixedHex(signature.s).slice(2) + '01');
    //console.log(sender.address);
  });

  it('should check ownership is transferred to new governor', async () => {
  });

  it('failing test: old governor should not be able to call onlyGovernor function', async () => {

  });

 });
 