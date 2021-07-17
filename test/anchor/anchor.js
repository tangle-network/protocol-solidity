// /**
//  * Copyright 2021 Webb Technologies
//  * SPDX-License-Identifier: LGPL-3.0-only
//  */
//  const TruffleAssert = require('truffle-assertions');
//  const Ethers = require('ethers');
 
//  const Helpers = require('../helpers');
//  const assert = require('assert');

// const fs = require('fs')

// const { toBN, randomHex } = require('web3-utils')

// const Anchor = artifacts.require('./NativeAnchor.sol')
// const { NATIVE_AMOUNT, MERKLE_TREE_HEIGHT } = process.env
// const wasmsnark = require('wasmsnark');
// const wasmsnarkUtils = require('wasmsnark/src/utils')
// const stringifyBigInts = require('wasmsnark/tools/stringifybigint').stringifyBigInts
// const snarkjs = require('snarkjs')
// const BN = require("bn.js");
// const crypto = require('crypto')
// const circomlib = require('circomlib')
// const MerkleTree = require('../../lib/tornado-withdraw/MerkleTree')

// const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))
// const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
// const toFixedHex = (number, length = 32) =>
//   '0x' +
//   bigInt(number)
//     .toString(16)
//     .padStart(length * 2, '0')
// const getRandomRecipient = () => rbigint(20)

// function generateDeposit() {
//   let deposit = {
//     secret: rbigint(31),
//     nullifier: rbigint(31),
//   }
//   const preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
//   deposit.commitment = pedersenHash(preimage)
//   return deposit
// }

// // eslint-disable-next-line no-unused-vars
// function BNArrayToStringArray(array) {
//   const arrayToPrint = []
//   array.forEach((item) => {
//     arrayToPrint.push(item.toString())
//   })
//   return arrayToPrint
// }

// function snarkVerify(proof) {
//   const verification_key = require('../build/circuits/withdraw_verification_key.json')
//   return snarkjs['groth'].isValid(verification_key, proof, proof.publicSignals)
// }

// contract('NativeAnchor', (accounts) => {
//   let anchor
//   const sender = accounts[0]
//   const operator = accounts[0]
//   const levels = MERKLE_TREE_HEIGHT || 16
//   const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
//   let snapshotId
//   let prefix = 'test'
//   let tree
//   const fee = bigInt(NATIVE_AMOUNT).shr(1) || bigInt(1e17)
//   const refund = bigInt(0)
//   const recipient = getRandomRecipient()
//   const relayer = accounts[1]
//   let circuit
//   let proving_key
//   let bn128;

//   before(async () => {
//     bn128 = await buildBn128();
//     tree = new MerkleTree(levels, null, prefix)
//     anchor = await Anchor.deployed()
//     circuit = require('../build/circuits/withdraw.json')
//     proving_key = fs.readFileSync('build/circuits/withdraw_proving_key.bin').buffer
//   })

//   describe('#constructor', () => {
//     it('should initialize', async () => {
//       const etherDenomination = await anchor.denomination()
//       etherDenomination.should.be.eq.BN(toBN(value))
//     })
//   })

//   describe('#deposit', () => {
//     it('should emit event', async () => {
//       let commitment = toFixedHex(42)
//       let { logs } = await anchor.deposit(commitment, { value, from: sender })

//       assert.strictEqual(logs[0].event, 'Deposit')
//       assert.strictEqual(logs[0].args.commitment, commitment)
//       logs[0].args.leafIndex.should.be.eq.BN(0)

//       commitment = toFixedHex(12)
//       ;({ logs } = await anchor.deposit(commitment, { value, from: accounts[2] }))

//       assert.strictEqual(logs[0].event, 'Deposit')
//       assert.strictEqual(logs[0].args.commitment, commitment)
//       logs[0].args.leafIndex.should.be.eq.BN(1)
//     })

//     it('should throw if there is a such commitment', async () => {
//       const commitment = toFixedHex(42)
//       await anchor.deposit(commitment, { value, from: sender }).should.be.fulfilled
//       const error = await anchor.deposit(commitment, { value, from: sender }).should.be.rejected
//       assert.strictEqual(error.reason, 'The commitment has been submitted')
//     })
//   })

//   // Use Node version >=12
//   describe('snark proof verification on js side', () => {
//     it('should detect tampering', async () => {
//       const deposit = generateDeposit()
//       await tree.insert(deposit.commitment)
//       const { root, path_elements, path_index } = await tree.path(0)

//       const input = stringifyBigInts({
//         root,
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee,
//         refund,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })

//       let proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const originalProof = JSON.parse(JSON.stringify(proofData))
//       let result = snarkVerify(proofData)
//       assert.strictEqual(result, true)

//       // nullifier
//       proofData.publicSignals[1] =
//         '133792158246920651341275668520530514036799294649489851421007411546007850802'
//       result = snarkVerify(proofData)
//       assert.strictEqual(result, false)
//       proofData = originalProof

//       // try to cheat with recipient
//       proofData.publicSignals[2] = '133738360804642228759657445999390850076318544422'
//       result = snarkVerify(proofData)
//       assert.strictEqual(result, false)
//       proofData = originalProof

//       // fee
//       proofData.publicSignals[3] = '1337100000000000000000'
//       result = snarkVerify(proofData)
//       assert.strictEqual(result, false)
//       proofData = originalProof
//     })
//   })

//   describe('#withdraw', () => {
//     it('should work', async () => {
//       const deposit = generateDeposit()
//       const user = accounts[4]
//       await tree.insert(deposit.commitment)

//       const balanceUserBefore = await web3.eth.getBalance(user)

//       // Uncomment to measure gas usage
//       // let gas = await anchor.deposit.estimateGas(toBN(deposit.commitment.toString()), { value, from: user, gasPrice: '0' })
//       // console.log('deposit gas:', gas)
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: user, gasPrice: '0' })

//       const balanceUserAfter = await web3.eth.getBalance(user)
//       balanceUserAfter.should.be.eq.BN(toBN(balanceUserBefore).sub(toBN(value)))

//       const { root, path_elements, path_index } = await tree.path(0)

//       // Circuit input
//       const input = stringifyBigInts({
//         // public
//         root,
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         relayer: operator,
//         recipient,
//         fee,
//         refund,

//         // private
//         nullifier: deposit.nullifier,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })

//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData)

//       const balanceAnchorBefore = await web3.eth.getBalance(anchor.address)
//       const balanceRelayerBefore = await web3.eth.getBalance(relayer)
//       const balanceOperatorBefore = await web3.eth.getBalance(operator)
//       const balanceRecieverBefore = await web3.eth.getBalance(toFixedHex(recipient, 20))
//       let isSpent = await anchor.isSpent(toFixedHex(input.nullifierHash))
//       assert.strictEqual(isSpent, false)

//       // Uncomment to measure gas usage
//       // gas = await anchor.withdraw.estimateGas(proof, publicSignals, { from: relayer, gasPrice: '0' })
//       // console.log('withdraw gas:', gas)
//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ]
//       const { logs } = await anchor.withdraw(proof, ...args, { from: relayer, gasPrice: '0' })

//       const balanceAnchorAfter = await web3.eth.getBalance(anchor.address)
//       const balanceRelayerAfter = await web3.eth.getBalance(relayer)
//       const balanceOperatorAfter = await web3.eth.getBalance(operator)
//       const balanceRecieverAfter = await web3.eth.getBalance(toFixedHex(recipient, 20))
//       const feeBN = toBN(fee.toString())
//       assert.strictEqual(balanceAnchorAfter, toBN(balanceAnchorBefore).sub(toBN(value)))
//       assert.strictEqual(balanceRelayerAfter, toBN(balanceRelayerBefore))
//       assert.strictEqual(balanceOperatorAfter, toBN(balanceOperatorBefore).add(feeBN))
//       assert.strictEqual(balanceRecieverAfter, toBN(balanceRecieverBefore).add(toBN(value)).sub(feeBN))

//       assert.strictEqual(logs[0].event, 'Withdrawal')
//       assert.strictEqual(logs[0].args.nullifierHash, toFixedHex(input.nullifierHash))
//       logs[0].args.relayer.should.be.eq.BN(operator)
//       logs[0].args.fee.should.be.eq.BN(feeBN)
//       isSpent = await anchor.isSpent(toFixedHex(input.nullifierHash))
//       assert(isSpent);
//     })

//     it('should prevent double spend', async () => {
//       const deposit = generateDeposit();
//       await tree.insert(deposit.commitment);
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender });

//       const { root, path_elements, path_index } = await tree.path(0);

//       const input = stringifyBigInts({
//         root,
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee,
//         refund,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       });
//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key);
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData);
//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ];
//       await TruffleAssert.passes(anchor.withdraw(proof, ...args, { from: relayer }));
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...args, { from: relayer }),
//         "The note has been already spent"
//       );
//     })

//     it('should prevent double spend with overflow', async () => {
//       const deposit = generateDeposit()
//       await tree.insert(deposit.commitment)
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

//       const { root, path_elements, path_index } = await tree.path(0)

//       const input = stringifyBigInts({
//         root,
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee,
//         refund,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })
//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData)
//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(
//           toBN(input.nullifierHash).add(
//             toBN('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
//           ),
//         ),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ];
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...args, { from: relayer }),
//         "verifier-gte-snark-scalar-field"
//       );
//     })

//     it('fee should be less or equal transfer value', async () => {
//       const deposit = generateDeposit()
//       await tree.insert(deposit.commitment)
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

//       const { root, path_elements, path_index } = await tree.path(0)
//       const largeFee = bigInt(value).add(bigInt(1))
//       const input = stringifyBigInts({
//         root,
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee: largeFee,
//         refund,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })

//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData)
//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ]
//       const error = await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected
//       assert.strictEqual(error.reason, 'Fee exceeds transfer value')
//     })

//     it('should throw for corrupted merkle tree root', async () => {
//       const deposit = generateDeposit()
//       await tree.insert(deposit.commitment)
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

//       const { root, path_elements, path_index } = await tree.path(0)

//       const input = stringifyBigInts({
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         root,
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee,
//         refund,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })

//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData)

//       const args = [
//         toFixedHex(randomHex(32)),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ]
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...args, { from: relayer }),
//         "Cannot find your merkle root"
//       );
//     })

//     it('should reject with tampered public inputs', async () => {
//       const deposit = generateDeposit()
//       await tree.insert(deposit.commitment)
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

//       let { root, path_elements, path_index } = await tree.path(0)

//       const input = stringifyBigInts({
//         root,
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee,
//         refund,
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })
//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       let { proof } = wasmsnarkUtils.toSolidityInput(proofData)
//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ]
//       let incorrectArgs
//       const originalProof = proof.slice()

//       // recipient
//       incorrectArgs = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ];
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...incorrectArgs, { from: relayer }),
//         "Invalid withdraw proof"
//       );

//       // fee
//       incorrectArgs = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
//         toFixedHex(input.refund),
//       ];
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...incorrectArgs, { from: relayer }),
//         "Invalid withdraw proof"
//       );

//       // nullifier
//       incorrectArgs = [
//         toFixedHex(input.root),
//         toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ];
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...incorrectArgs, { from: relayer }),
//         "Invalid withdraw proof"
//       );

//       // proof itself
//       proof = '0xbeef' + proof.substr(6)
//       await TruffleAssert.passes(anchor.withdraw(proof, ...args, { from: relayer }));

//       // should work with original values
//       await TruffleAssert.passes(anchor.withdraw(originalProof, ...args, { from: relayer }));
//     })

//     it('should reject with non zero refund', async () => {
//       const deposit = generateDeposit()
//       await tree.insert(deposit.commitment)
//       await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

//       const { root, path_elements, path_index } = await tree.path(0)

//       const input = stringifyBigInts({
//         nullifierHash: pedersenHash(deposit.nullifier.leInt2Buff(31)),
//         root,
//         nullifier: deposit.nullifier,
//         relayer: operator,
//         recipient,
//         fee,
//         refund: bigInt(1),
//         secret: deposit.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })

//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData)

//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ];
//       await TruffleAssert.reverts(
//         anchor.withdraw(proof, ...args, { from: relayer }),
//         "Refund value is supposed to be zero for ETH instance"
//       );
//     })
//   })

//   describe('#isSpent', () => {
//     it('should work', async () => {
//       const deposit1 = generateDeposit()
//       const deposit2 = generateDeposit()
//       await tree.insert(deposit1.commitment)
//       await tree.insert(deposit2.commitment)
//       await anchor.deposit(toFixedHex(deposit1.commitment), { value, gasPrice: '0' })
//       await anchor.deposit(toFixedHex(deposit2.commitment), { value, gasPrice: '0' })

//       const { root, path_elements, path_index } = await tree.path(1)

//       // Circuit input
//       const input = stringifyBigInts({
//         // public
//         root,
//         nullifierHash: pedersenHash(deposit2.nullifier.leInt2Buff(31)),
//         relayer: operator,
//         recipient,
//         fee,
//         refund,

//         // private
//         nullifier: deposit2.nullifier,
//         secret: deposit2.secret,
//         pathElements: path_elements,
//         pathIndices: path_index,
//       })

//       const proofData = await wasmsnarkUtils.groth16GenProof(input, circuit, proving_key)
//       const { proof } = wasmsnarkUtils.toSolidityInput(proofData)

//       const args = [
//         toFixedHex(input.root),
//         toFixedHex(input.nullifierHash),
//         toFixedHex(input.recipient, 20),
//         toFixedHex(input.relayer, 20),
//         toFixedHex(input.fee),
//         toFixedHex(input.refund),
//       ]

//       await anchor.withdraw(proof, ...args, { from: relayer, gasPrice: '0' })

//       const nullifierHash1 = toFixedHex(pedersenHash(deposit1.nullifier.leInt2Buff(31)))
//       const nullifierHash2 = toFixedHex(pedersenHash(deposit2.nullifier.leInt2Buff(31)))
//       const spentArray = await anchor.isSpentArray([nullifierHash1, nullifierHash2])
//       assert.strictEqual(spentArray, [false, true])
//     })
//   })

//   afterEach(async () => {
//     tree = new MerkleTree(levels, null, prefix)
//   })
// })
