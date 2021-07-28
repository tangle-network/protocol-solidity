/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

 const Ethers = require('ethers');

 const blankFunctionSig = '0x00000000';
 const blankFunctionDepositerOffset = 0;
 const AbiCoder = new Ethers.utils.AbiCoder;

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
        toHex(sourceChainID, 32).substr(2) +           // chainID (1 bytes)
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
    nonceAndId
};
