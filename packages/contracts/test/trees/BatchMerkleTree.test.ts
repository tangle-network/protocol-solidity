/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

const { expect } = require('chai');
// const { toFixedHex, poseidonHash2, randomBN } = require('../src/utils')
// const MerkleTree = require('fixed-merkle-tree')
import { MerkleTree, toFixedHex, toBuffer, randomBN } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { artifacts, contract, ethers } from 'hardhat';
import { poseidon } from 'circomlibjs';
import { PoseidonHasher } from '@webb-tools/anchors';
import { randomBytes } from 'crypto';
// import { groth16 } from 'snarkjs';
// const TruffleAssert = require('truffle-assertions');
import { hexToU8a, u8aToHex, ZkComponents, fetchComponentsFromFilePaths } from '@webb-tools/utils';
import {
  BatchMerkleTree as BatchMerkleTreeContract,
  BatchMerkleTree__factory,
  VerifierBatch16__factory,
} from '../../typechain';
import jsSHA from 'jssha';
import path from 'path';
const snarkjs = require('snarkjs');

// const MerkleTreeWithHistory = artifacts.require('MerkleTreePoseidonMock');

function hashInputs(input) {
  const sha = new jsSHA('SHA-256', 'ARRAYBUFFER');
  sha.update(toBuffer(input.oldRoot, 32));
  sha.update(toBuffer(input.newRoot, 32));
  sha.update(toBuffer(input.pathIndices, 4));

  for (let i = 0; i < input.leaves.length; i++) {
    sha.update(toBuffer(input.leaves[i], 32));
  }

  const hash = '0x' + sha.getHash('HEX');
  const result = BigNumber.from(hash)
    .mod(
      BigNumber.from(
        '21888242871839275222246405745257275088548364400416034343698204186575808495617'
      )
    )
    .toString();
  return result;
}

async function register(note, tornadoTrees, from) {
  await tornadoTrees
    .connect(from)
    .register(
      note.instance,
      toFixedHex(note.commitment),
      toFixedHex(note.nullifierHash),
      note.depositBlock,
      note.withdrawalBlock
    );
}
// const instances = [
//   '0x1111000000000000000000000000000000001111',
//   '0x2222000000000000000000000000000000002222',
//   '0x3333000000000000000000000000000000003333',
//   '0x4444000000000000000000000000000000004444',
// ]

const blocks = ['0xaaaaaaaa', '0xbbbbbbbb', '0xcccccccc', '0xdddddddd'];
//
contract.only('BatchMerkleTree w/ Poseidon hasher', (accounts) => {
  let merkleTree;
  let contract;
  let hasherInstance: PoseidonHasher;
  let zkComponents: ZkComponents;
  // let levels = 30;
  const wasmFilePath = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/batchMerkleTreeUpdate_16.wasm'
  )
  const zkeyFilePath = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/circuit_final.zkey'
  )
  const wtnsCalcFilePath = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/batch-tree/16/witness_calculator.cjs'
  )
  const levels = 20;
  const CHUNK_TREE_HEIGHT = 4;
  const sender = accounts[0];
  let tree: MerkleTree;

  beforeEach(async () => {
    zkComponents = await fetchComponentsFromFilePaths(
      wasmFilePath,
      wtnsCalcFilePath,
      zkeyFilePath,
    );
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);
    merkleTree = new MerkleTree(levels);
    const verifierFactory = new VerifierBatch16__factory(wallet);
    const verifier = await verifierFactory.deploy();
    const factory = await ethers.getContractFactory('BatchMerkleTree', {
      signer: wallet,
    });
    contract = await factory.deploy(levels, hasherInstance.contract.address, verifier.address);
  });
  describe('#registration', () => {
    it('should register a deposit', async () => {
      const instance = hasherInstance.contract.address; // dummy
      // const commitment = randomBN()
      const commitment = toFixedHex(randomBN().toHexString());
      console.log('instance ', instance, ' commitment ', commitment);
      let tx = await contract.registerInsertion(instance, toFixedHex(commitment));
      // console.log('tx ', tx)
      // let receipt = await tx.wait()
      expect(tx).to.emit(contract, 'DepositData').withArgs(instance, commitment, 0, 0);
    });
    it('should register up to 16 deposits', async () => {
      const instance = hasherInstance.contract.address; // dummy
      // const commitment = randomBN()
      let queueLength = await contract.queueLength();
      while (queueLength < 16) {
        const commitment = toFixedHex(randomBN().toHexString());
        console.log('instance ', instance, ' commitment ', commitment);
        let tx = await contract.registerInsertion(instance, toFixedHex(commitment));
        // console.log('tx ', tx)
        // let receipt = await tx.wait()
        expect(tx).to.emit(contract, 'DepositData').withArgs(instance, commitment, 0, queueLength);
        queueLength += 1;
      }
    });
  });
  describe('#batchInsertions', () => {
    it('should prove snark', async () => {
      const batchHeight = 4;
      const batchSize = 2 ** batchHeight;
      const oldRoot = merkleTree.root().toString();
      let leaves = [];
      for (let i = 0; i < batchSize; i++) {
        const commitment = toFixedHex(randomBN().toHexString());
        leaves.push(commitment);
      }
      merkleTree.bulkInsert(leaves);
      const newRoot = merkleTree.root().toString();
      // const newRoot = tree.root().toString();
      console.log('oldRoot ', oldRoot);
      console.log('newRoot ', newRoot);
      let { pathElements, pathIndices } = merkleTree.path(merkleTree.elements().length - 1);
      pathElements = pathElements.slice(batchHeight).map((e) => e.toString());
      console.log('pathElements ', pathElements);
      console.log('pathIndices ', pathIndices);
      pathIndices = MerkleTree.calculateIndexFromPathIndices(pathIndices);

      const input = {
        oldRoot,
        newRoot,
        pathIndices,
        pathElements,
        leaves,
      };
      input['argsHash'] = hashInputs(input);
      const circuitInput = {
        oldRoot,
        newRoot,
        argsHash: input['argsHash'],
        pathIndices,
        pathElements,
        leaves,
      }

      console.log('input ', circuitInput);
      console.log('zkComponents ', zkComponents);
      console.log('zkComponents ', wasmFilePath);
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInput, zkComponents.wasm, zkComponents.zkey);
      console.log('proof ', proof);
      console.log('publicSignals ', publicSignals);
    });
  });
});

// describe('TornadoTrees', function () {
//   let tree
//   let operator
//   let tornadoProxy
//   let verifier
//   let tornadoTrees
//   let tornadoTreesV1
//   let notes
//   let depositDataEventFilter
//   const depositEvents = []
//   const withdrawalEvents = []
//
//   beforeEach(async function () {
//     const BatchTreeUpdateVerifier = await ethers.getContractFactory('BatchTreeUpdateVerifier')
//     verifier = await BatchTreeUpdateVerifier.deploy()
//
//     const TornadoTreesV1 = await ethers.getContractFactory('TornadoTreesV1Mock')
//     tornadoTreesV1 = await TornadoTreesV1.deploy(0, 0, tree.root(), tree.root())
//     notes = []
//     for (let i = 0; i < 2 ** CHUNK_TREE_HEIGHT; i++) {
//       notes[i] = {
//         instance: instances[i % instances.length],
//         depositBlock: blocks[i % blocks.length],
//         withdrawalBlock: 2 + i + i * 4 * 60 * 24,
//         commitment: randomBN(),
//         nullifierHash: randomBN(),
//       }
//       await register(notes[i], tornadoTreesV1, tornadoProxy)
//       depositEvents[i] = {
//         hash: toFixedHex(notes[i].commitment),
//         instance: toFixedHex(notes[i].instance, 20),
//         block: toFixedHex(notes[i].depositBlock, 4),
//       }
//       withdrawalEvents[i] = {
//         hash: toFixedHex(notes[i].nullifierHash),
//         instance: toFixedHex(notes[i].instance, 20),
//         block: toFixedHex(notes[i].withdrawalBlock, 4),
//       }
//     }
//     const TornadoTrees = await ethers.getContractFactory('TornadoTreesMock')
//     tornadoTrees = await TornadoTrees.deploy(operator.address, tornadoTreesV1.address, {
//       depositsFrom: 1,
//       depositsStep: 1,
//       withdrawalsFrom: 2,
//       withdrawalsStep: 2,
//     })
//     await tornadoTrees.initialize(tornadoProxy.address, verifier.address)
//     depositDataEventFilter = tornadoTrees.filters.DepositData()
//   })
//
//   describe('#updateDepositTree', () => {
//     it('should check hash', async () => {
//       const { args } = controller.batchTreeUpdate(tree, depositEvents)
//       const solHash = await tornadoTrees.updateDepositTreeMock(...args.slice(1))
//       expect(solHash).to.be.equal(args[0])
//     })
//
//     it('should prove snark', async () => {
//       const { input, args } = controller.batchTreeUpdate(tree, depositEvents)
//       const proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await tornadoTrees.updateDepositTree(proof, ...args)
//
//       const updatedRoot = await tornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//     })
//
//     it('should work for non-empty tree', async () => {
//       let { input, args } = controller.batchTreeUpdate(tree, depositEvents)
//       let proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await tornadoTrees.updateDepositTree(proof, ...args)
//       let updatedRoot = await tornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//       //
//       for (let i = 0; i < notes.length; i++) {
//         await register(notes[i], tornadoTrees, tornadoProxy)
//       }
//       ;({ input, args } = controller.batchTreeUpdate(tree, depositEvents))
//       proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await tornadoTrees.updateDepositTree(proof, ...args)
//       updatedRoot = await tornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//     })
//
//     it('should work with events from contracts', async () => {
//       let { input, args } = controller.batchTreeUpdate(tree, depositEvents)
//       let proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await tornadoTrees.updateDepositTree(proof, ...args)
//       let updatedRoot = await tornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//
//       const migratedEvents = await tornadoTrees.queryFilter(depositDataEventFilter)
//       migratedEvents.forEach((e, i) => {
//         expect(e.args.index).to.be.equal(i)
//       })
//       //
//       for (let i = 0; i < notes.length; i++) {
//         await register(notes[i], tornadoTrees, tornadoProxy)
//       }
//       let registeredEvents = await tornadoTrees.queryFilter(depositDataEventFilter)
//       registeredEvents = registeredEvents.map((e) => ({
//         hash: toFixedHex(e.args.hash),
//         instance: toFixedHex(e.args.instance, 20),
//         block: toFixedHex(e.args.block, 4),
//       }))
//       ;({ input, args } = controller.batchTreeUpdate(tree, registeredEvents.slice(0, notes.length)))
//       proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await tornadoTrees.updateDepositTree(proof, ...args)
//       updatedRoot = await tornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//     })
//     it('should work for batch+N filled v1 tree', async () => {
//       const batchSize = 2 ** CHUNK_TREE_HEIGHT
//       for (let i = batchSize; i < batchSize + 2; i++) {
//         notes.push({
//           instance: instances[i % instances.length],
//           depositBlock: blocks[i % blocks.length],
//           withdrawalBlock: 2 + i + i * 4 * 60 * 24,
//           commitment: randomBN(),
//           nullifierHash: randomBN(),
//         })
//         await register(notes[i], tornadoTreesV1, tornadoProxy)
//       }
//
//       const TornadoTrees = await ethers.getContractFactory('TornadoTreesMock')
//       const newTornadoTrees = await TornadoTrees.deploy(operator.address, tornadoTreesV1.address, {
//         depositsFrom: 1,
//         depositsStep: 1,
//         withdrawalsFrom: 2,
//         withdrawalsStep: 2,
//       })
//       await newTornadoTrees.initialize(tornadoProxy.address, verifier.address)
//
//       // load first batchSize deposits
//       let { input, args } = controller.batchTreeUpdate(tree, depositEvents)
//       let proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await newTornadoTrees.updateDepositTree(proof, ...args)
//       let updatedRoot = await newTornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//
//       // register 2 * `notes.length` new deposits on the new trees
//       for (let i = 0; i < notes.length; i++) {
//         await register(notes[i], newTornadoTrees, tornadoProxy)
//       }
//       for (let i = 0; i < notes.length; i++) {
//         await register(notes[i], newTornadoTrees, tornadoProxy)
//       }
//
//       // get 2 extra events from v1 tress
//       let events = notes.slice(batchSize).map((note) => ({
//         hash: toFixedHex(note.commitment),
//         instance: toFixedHex(note.instance, 20),
//         block: toFixedHex(note.depositBlock, 4),
//       }))
//
//       let registeredEvents = await newTornadoTrees.queryFilter(depositDataEventFilter)
//       registeredEvents = registeredEvents.slice(batchSize) // cut processed deposits from v1
//       events = events.concat(
//         registeredEvents.slice(0, batchSize - 2).map((e) => ({
//           hash: toFixedHex(e.args.hash),
//           instance: toFixedHex(e.args.instance, 20),
//           block: toFixedHex(e.args.block, 4),
//         })),
//       )
//       //
//       ;({ input, args } = controller.batchTreeUpdate(tree, events))
//       proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await newTornadoTrees.updateDepositTree(proof, ...args)
//       updatedRoot = await newTornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//
//       events = registeredEvents.slice(batchSize - 2, 2 * batchSize - 2).map((e) => ({
//         hash: toFixedHex(e.args.hash),
//         instance: toFixedHex(e.args.instance, 20),
//         block: toFixedHex(e.args.block, 4),
//       }))
//       ;({ input, args } = controller.batchTreeUpdate(tree, events))
//       proof = await controller.prove(input, './artifacts/circuits/BatchTreeUpdate')
//       await newTornadoTrees.updateDepositTree(proof, ...args)
//       updatedRoot = await newTornadoTrees.depositRoot()
//       expect(updatedRoot).to.be.equal(tree.root())
//     })
//     it('should reject for partially filled tree')
//     it('should reject for outdated deposit root')
//     it('should reject for incorrect insert index')
//     it('should reject for overflows of newRoot')
//     it('should reject for invalid sha256 args')
//   })
//
//   describe('#getRegisteredDeposits', () => {
//     it('should work', async () => {
//       for (let i = 0; i < 2 ** CHUNK_TREE_HEIGHT; i++) {
//         notes[i] = {
//           instance: instances[i % instances.length],
//           depositBlock: blocks[i % blocks.length],
//           withdrawalBlock: 2 + i + i * 4 * 60 * 24,
//           commitment: randomBN(),
//           nullifierHash: randomBN(),
//         }
//         await register(notes[i], tornadoTrees, tornadoProxy)
//       }
//
//       const abi = new ethers.utils.AbiCoder()
//       const count = await tornadoTrees.depositsLength()
//       const _deposits = await tornadoTrees.getRegisteredDeposits()
//       expect(count).to.be.equal(notes.length * 2)
//       _deposits.forEach((hash, i) => {
//         if (i < notes.length) {
//           expect(hash).to.be.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
//         } else {
//           const index = i - notes.length
//           const encodedData = abi.encode(
//             ['address', 'bytes32', 'uint256'],
//             [notes[index].instance, toFixedHex(notes[index].commitment), notes[index].depositBlock],
//           )
//           const leaf = ethers.utils.keccak256(encodedData)
//
//           expect(leaf).to.be.equal(hash)
//         }
//       })
//       // res.length.should.be.equal(1)
//       // res[0].should.be.true
//       // await tornadoTrees.updateRoots([note1DepositLeaf], [])
//
//       // res = await tornadoTrees.getRegisteredDeposits()
//       // res.length.should.be.equal(0)
//
//       // await registerDeposit(note2, tornadoTrees)
//       // res = await tornadoTrees.getRegisteredDeposits()
//       // // res[0].should.be.true
//     })
//   })
//
//   describe('#getRegisteredWithdrawals', () => {
//     it('should work', async () => {
//       for (let i = 0; i < 2 ** CHUNK_TREE_HEIGHT; i++) {
//         notes[i] = {
//           instance: instances[i % instances.length],
//           depositBlock: blocks[i % blocks.length],
//           withdrawalBlock: 2 + i + i * 4 * 60 * 24,
//           commitment: randomBN(),
//           nullifierHash: randomBN(),
//         }
//         await register(notes[i], tornadoTrees, tornadoProxy)
//       }
//
//       const abi = new ethers.utils.AbiCoder()
//       const count = await tornadoTrees.withdrawalsLength()
//       const _withdrawals = await tornadoTrees.getRegisteredWithdrawals()
//       expect(count).to.be.equal(notes.length * 2)
//       _withdrawals.forEach((hash, i) => {
//         if (i < notes.length) {
//           expect(hash).to.be.equal('0x0000000000000000000000000000000000000000000000000000000000000000')
//         } else {
//           const index = i - notes.length
//           const encodedData = abi.encode(
//             ['address', 'bytes32', 'uint256'],
//             [notes[index].instance, toFixedHex(notes[index].nullifierHash), notes[index].withdrawalBlock],
//           )
//           const leaf = ethers.utils.keccak256(encodedData)
//
//           expect(leaf).to.be.equal(hash)
//         }
//       })
//     })
//   })
// })
