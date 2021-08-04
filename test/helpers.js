/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

 const Ethers = require('ethers');

 const blankFunctionSig = '0x00000000';
 const blankFunctionDepositerOffset = 0;
 const AbiCoder = new Ethers.utils.AbiCoder;
 const utils = require("ffjavascript").utils;
 const {
   unstringifyBigInts,
 } = utils;

 const toHex = (covertThis, padding) => {
  return Ethers.utils.hexZeroPad(Ethers.utils.hexlify(covertThis), padding);
 };

 const abiEncode = (valueTypes, values) => {
  return AbiCoder.encode(valueTypes, values)
 };

 const getFunctionSignature = (contractInstance, functionName) => {
  return contractInstance.abi.filter(abiProperty => abiProperty.name === functionName)[0].signature;
 };

 const createERCDepositData = (tokenAmountOrID, lenRecipientAddress, recipientAddress) => {
  return '0x' +
    toHex(tokenAmountOrID, 32).substr(2) +      // Token amount or ID to deposit (32 bytes)
    toHex(lenRecipientAddress, 32).substr(2) + // len(recipientAddress)          (32 bytes)
    recipientAddress.substr(2);               // recipientAddress               (?? bytes)
};

const createUpdateProposalData = (sourceChainID, blockHeight, merkleRoot) => {
  return '0x' +
    toHex(sourceChainID, 32).substr(2) +    // chainID (32 bytes)
    toHex(blockHeight, 32).substr(2) +      // latest block height of incoming root updates (32 bytes)
    toHex(merkleRoot, 32).substr(2);        // Updated Merkle Root (32 bytes)
};

const advanceBlock = () => {
  const time = Math.floor(Date.now() / 1000);
  ethers.provider.send("evm_increaseTime", [time]) 
  ethers.provider.send("evm_mine", []);
}

const createResourceID = (contractAddress, chainID) => {
  return toHex(contractAddress + toHex(chainID, 1).substr(2), 32)
};

const assertObjectsMatch = (expectedObj, actualObj) => {
  for (const expectedProperty of Object.keys(expectedObj)) {
    assert.property(actualObj, expectedProperty, `actualObj does not have property: ${expectedProperty}`);

    let expectedValue = expectedObj[expectedProperty];
    let actualValue = actualObj[expectedProperty];

    // If expectedValue is not null, we can expected actualValue to not be null as well
    if (expectedValue !== null) {
      // Handling mixed case ETH addresses
      // If expectedValue is a string, we can expected actualValue to be a string as well
      if (expectedValue.toLowerCase !== undefined) {
        expectedValue = expectedValue.toLowerCase();
        actualValue = actualValue.toLowerCase();
      }

      // Handling BigNumber.js instances
      if (actualValue.toNumber !== undefined) {
        actualValue = actualValue.toNumber();
      }

      // Truffle seems to return uint/ints as strings
      // Also handles when Truffle returns hex number when expecting uint/int
      if (typeof expectedValue === 'number' && typeof actualValue === 'string' ||
        Ethers.utils.isHexString(actualValue) && typeof expectedValue === 'number') {
        actualValue = parseInt(actualValue);
      }
    }
    
    assert.deepEqual(expectedValue, actualValue, `expectedValue: ${expectedValue} does not match actualValue: ${actualValue}`);    
  }
};
//uint72 nonceAndID = (uint72(depositNonce) << 8) | uint72(chainID);
const nonceAndId = (nonce, id) => {
  return Ethers.utils.hexZeroPad(Ethers.utils.hexlify(nonce), 8) + Ethers.utils.hexZeroPad(Ethers.utils.hexlify(id), 1).substr(2)
}

function hexifyBigInts(o) {
  if (typeof (o) === "bigint") {
    let str = o.toString(16);
    while (str.length < 64) str = "0" + str;
    str = "0x" + str;
    return str;
  } else if (Array.isArray(o)) {
    return o.map(hexifyBigInts);
  } else if (typeof o == "object") {
    const res = {};
    for (let k in o) {
      res[k] = hexifyBigInts(o[k]);
    }
    return res;
  } else {
    return o;
  }
}

function toSolidityInput(proof, publicSignals) {
  const result = {
    pi_a: [proof.pi_a[0], proof.pi_a[1]],
    pi_b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    pi_c: [proof.pi_c[0], proof.pi_c[1]],
  };

  result.publicSignals = publicSignals;

  return hexifyBigInts(unstringifyBigInts(result));
}

function p256(n) {
  let nstr = BigInt(n).toString(16);
  while (nstr.length < 64) nstr = "0" +nstr;
  nstr = `0x${nstr}`;

  return nstr;
}

async function groth16ExportSolidityCallData(proof, pub) {
  let inputs = "";
  for (let i = 0; i < pub.length; i++) {
    if (inputs != "") inputs = inputs + ",";
    inputs = inputs + p256(pub[i]);
  }
  console.log(inputs);
  let S;
  S=`[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
    `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(proof.pi_b[1][0])}]],` +
    `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
    `[${inputs}]`;

  return S;
}


module.exports = {
  advanceBlock,
  blankFunctionSig,
  blankFunctionDepositerOffset,
  toHex,
  abiEncode,
  getFunctionSignature,
  createERCDepositData,
  createUpdateProposalData,
  createResourceID,
  assertObjectsMatch,
  nonceAndId,
  toSolidityInput,
  p256,
};
