"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-console */
const MerkleTree_1 = require("./MerkleTree");
const ethers_1 = require("ethers");
const { BigNumber } = ethers_1.ethers;
const utils_1 = require("./utils");
const Utxo = require('./utxo');
const { prove } = require('./prover');
const MERKLE_TREE_HEIGHT = 5;
async function buildMerkleTree({ tornadoPool }) {
    const filter = tornadoPool.filters.NewCommitment();
    const events = await tornadoPool.queryFilter(filter, 0);
    const leaves = events.sort((a, b) => a.args.index - b.args.index).map((e) => (0, utils_1.toFixedHex)(e.args.commitment));
    return new MerkleTree_1.MerkleTree(MERKLE_TREE_HEIGHT, leaves, { hashFunction: utils_1.poseidonHash2 });
}
async function getProof({ roots, chainId, inputs, outputs, tree, extAmount, fee, recipient, relayer }) {
    inputs = (0, utils_1.shuffle)(inputs);
    outputs = (0, utils_1.shuffle)(outputs);
    let inputMerklePathIndices = [];
    let inputMerklePathElements = [];
    for (const input of inputs) {
        if (input.amount > 0) {
            input.index = tree.indexOf((0, utils_1.toFixedHex)(input.getCommitment()));
            if (input.index < 0) {
                throw new Error(`Input commitment ${(0, utils_1.toFixedHex)(input.getCommitment())} was not found`);
            }
            inputMerklePathIndices.push(input.index);
            inputMerklePathElements.push(tree.path(input.index).pathElements);
        }
        else {
            inputMerklePathIndices.push(0);
            inputMerklePathElements.push(new Array(tree.levels).fill(0));
        }
    }
    const extData = {
        recipient: (0, utils_1.toFixedHex)(recipient, 20),
        extAmount: (0, utils_1.toFixedHex)(extAmount),
        relayer: (0, utils_1.toFixedHex)(relayer, 20),
        fee: (0, utils_1.toFixedHex)(fee),
        encryptedOutput1: outputs[0].encrypt(),
        encryptedOutput2: outputs[1].encrypt()
    };
    const extDataHash = (0, utils_1.getExtDataHash)(extData);
    let input = {
        roots: roots.map((x) => x.merkleRoot),
        diffs: [inputs.map((x) => x.getDiffs(roots, chainId))],
        chainId: chainId,
        inputNullifier: inputs.map((x) => x.getNullifier()),
        outputCommitment: outputs.map((x) => x.getCommitment()),
        publicAmount: BigNumber.from(extAmount).sub(fee).add(utils_1.FIELD_SIZE).mod(utils_1.FIELD_SIZE).toString(),
        extDataHash,
        // data for 2 transaction inputs
        inAmount: inputs.map((x) => x.amount),
        inPrivateKey: inputs.map((x) => x.keypair.privkey),
        inBlinding: inputs.map((x) => x.blinding),
        inPathIndices: inputMerklePathIndices,
        inPathElements: inputMerklePathElements,
        // data for 2 transaction outputs
        outChainID: outputs.map((x) => x.chainId),
        outAmount: outputs.map((x) => x.amount),
        outBlinding: outputs.map((x) => x.blinding),
        outPubkey: outputs.map((x) => x.keypair.pubkey),
    };
    const proof = await prove(input, `./artifacts/circuits/transaction${inputs.length}`);
    // public inputs to the contract
    const args = {
        proof,
        roots: `0x${roots.map((x) => (0, utils_1.toFixedHex)(x.merkleRoot).slice(2)).join('')}`,
        inputNullifiers: inputs.map((x) => (0, utils_1.toFixedHex)(x.getNullifier())),
        outputCommitments: outputs.map((x) => (0, utils_1.toFixedHex)(x.getCommitment())),
        publicAmount: (0, utils_1.toFixedHex)(input.publicAmount),
        extDataHash: (0, utils_1.toFixedHex)(extDataHash),
    };
    // console.log('Solidity args', args)
    return {
        extData,
        args,
    };
}
async function prepareTransaction({ tornadoPool, roots = [], chainId = BigNumber.from(0), inputs = [], outputs = [], fee = 0, recipient = 0, relayer = 0 }) {
    if (inputs.length > 16 || outputs.length > 2) {
        throw new Error('Incorrect inputs/outputs count');
    }
    while (inputs.length !== 2 && inputs.length < 16) {
        inputs.push(new Utxo());
    }
    while (outputs.length < 2) {
        outputs.push(new Utxo());
    }
    let extAmount = BigNumber.from(fee)
        .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
        .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));
    const { args, extData } = await getProof({
        roots,
        chainId,
        inputs,
        outputs,
        tree: await buildMerkleTree({ tornadoPool }),
        extAmount,
        fee,
        recipient,
        relayer
    });
    return {
        args,
        extData,
    };
}
async function transaction({ tornadoPool, ...rest }) {
    const { args, extData } = await prepareTransaction({
        tornadoPool,
        ...rest,
    });
    const receipt = await tornadoPool.transact(args, extData, {
        gasLimit: 2e6,
    });
    return await receipt.wait();
}
async function registerAndTransact({ tornadoPool, account, ...rest }) {
    const { args, extData } = await prepareTransaction({
        tornadoPool,
        ...rest,
    });
    const receipt = await tornadoPool.registerAndTransact(account, args, extData, {
        gasLimit: 2e6,
    });
    await receipt.wait();
}
module.exports = { transaction, registerAndTransact, prepareTransaction };
//# sourceMappingURL=index.js.map