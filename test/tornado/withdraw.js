/* global artifacts, web3, contract */
require('chai').use(require('bn-chai')(web3.utils.BN)).use(require('chai-as-promised')).should()
const fs = require('fs')

const { toBN, randomHex } = require('web3-utils')

const Anchor = artifacts.require('./NativeAnchor.sol')
const { NATIVE_AMOUNT, MERKLE_TREE_HEIGHT } = process.env
const snarkjs = require('snarkjs')
const bigInt = BigInt;
const crypto = require('crypto')
const circomlib = require('circomlib')
const MerkleTree = require('../../lib/tornado-withdraw/MerkleTree')
const BN = require('bn.js');
const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
} = utils;

const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
const toFixedHex = (number, length = 32) =>
  '0x' +
  bigInt(number)
    .toString(16)
    .padStart(length * 2, '0')
const getRandomRecipient = () => rbigint(20)

function generateDeposit() {
  let deposit = {
    secret: rbigint(31),
    nullifier: rbigint(31),
  }
  const preimage = Buffer.concat([leInt2Buff(deposit.nullifier, 31), leInt2Buff(deposit.secret, 31)])
  deposit.commitment = pedersenHash(preimage)
  return deposit
}

// eslint-disable-next-line no-unused-vars
function BNArrayToStringArray(array) {
  const arrayToPrint = []
  array.forEach((item) => {
    arrayToPrint.push(item.toString())
  })
  return arrayToPrint
}

function snarkVerify(proof) {
  const verification_key = unstringifyBigInts2(require('../build/circuits/withdraw_verification_key.json'))
  return snarkjs['groth'].isValid(verification_key, proof, proof.publicSignals)
}

contract('NativeAnchor', (accounts) => {
  let anchor
  const sender = accounts[0]
  const operator = accounts[0]
  const levels = MERKLE_TREE_HEIGHT || 16
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let prefix = 'test'
  let tree
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString())
  const refund = BigInt((new BN('0')).toString())
  const recipient = getRandomRecipient()
  const relayer = accounts[1]
  let groth16
  let circuit
  let proving_key
  let createWitness
  
  before(async () => {
    tree = new MerkleTree(levels, null, prefix)
    anchor = await Anchor.deployed()
    groth16;
    circuit = require('../build/circuits/withdraw.json')
    proving_key = fs.readFileSync('build/circuits/withdraw_proving_key.bin').buffer
    createWitness = async (data) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "artifacts/circuits",
        "tornado",
        "withdraw_30.wasm"
      ), wtns);
      return wtns;
    }
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await anchor.denomination()
      etherDenomination.should.be.eq.BN(toBN(value))
    })
  })

  describe('#deposit', () => {
    it('should emit event', async () => {
      let commitment = toFixedHex(42)
      let { logs } = await anchor.deposit(commitment, { value, from: sender })

      logs[0].event.should.be.equal('Deposit')
      logs[0].args.commitment.should.be.equal(commitment)
      logs[0].args.leafIndex.should.be.eq.BN(0)

      commitment = toFixedHex(12)
      ;({ logs } = await anchor.deposit(commitment, { value, from: accounts[2] }))

      logs[0].event.should.be.equal('Deposit')
      logs[0].args.commitment.should.be.equal(commitment)
      logs[0].args.leafIndex.should.be.eq.BN(1)
    })

    it('should throw if there is a such commitment', async () => {
      const commitment = toFixedHex(42)
      await anchor.deposit(commitment, { value, from: sender }).should.be.fulfilled
      const error = await anchor.deposit(commitment, { value, from: sender }).should.be.rejected
      error.reason.should.be.equal('The commitment has been submitted')
    })
  })

  // Use Node version >=12
  describe('snark proof verification on js side', () => {
    it('should detect tampering', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      const { root, path_elements, path_index } = await tree.path(0)

      const witness = {
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee,
        refund,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('circuit_final.zkey');

      let result = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      result.should.be.equal(true)

      // nullifier
      publicSignals[1] =
        '133792158246920651341275668520530514036799294649489851421007411546007850802';
      result = snarkVerify(proofData);
      result.should.be.equal(false);
      publicSignals = tempSignals;

      // try to cheat with recipient
      publicSignals[2] = '133738360804642228759657445999390850076318544422';
      result = snarkVerify(proofData);
      result.should.be.equal(false);
      publicSignals = tempSignals;

      // fee
      publicSignals[3] = '1337100000000000000000';
      result = snarkVerify(proofData);
      result.should.be.equal(false);
      publicSignals = tempSignals;
    })
  })

  describe('#withdraw', () => {
    it('should work', async () => {
      const deposit = generateDeposit()
      const user = accounts[4]
      await tree.insert(deposit.commitment)

      const balanceUserBefore = await web3.eth.getBalance(user)

      // Uncomment to measure gas usage
      // let gas = await anchor.deposit.estimateGas(toBN(deposit.commitment.toString()), { value, from: user, gasPrice: '0' })
      // console.log('deposit gas:', gas)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: user, gasPrice: '0' })

      const balanceUserAfter = await web3.eth.getBalance(user)
      balanceUserAfter.should.be.eq.BN(toBN(balanceUserBefore).sub(toBN(value)))

      const { root, path_elements, path_index } = await tree.path(0)

      // Circuit input
      const witness = {
        // public
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        relayer: operator,
        recipient,
        fee,
        refund,

        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const balanceAnchorBefore = await web3.eth.getBalance(anchor.address)
      const balanceRelayerBefore = await web3.eth.getBalance(relayer)
      const balanceOperatorBefore = await web3.eth.getBalance(operator)
      const balanceRecieverBefore = await web3.eth.getBalance(toFixedHex(recipient, 20))
      let isSpent = await anchor.isSpent(toFixedHex(input.nullifierHash))
      isSpent.should.be.equal(false)

      // Uncomment to measure gas usage
      // gas = await anchor.withdraw.estimateGas(proof, publicSignals, { from: relayer, gasPrice: '0' })
      // console.log('withdraw gas:', gas)
      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      const { logs } = await anchor.withdraw(proof, ...args, { from: relayer, gasPrice: '0' })

      const balanceAnchorAfter = await web3.eth.getBalance(anchor.address)
      const balanceRelayerAfter = await web3.eth.getBalance(relayer)
      const balanceOperatorAfter = await web3.eth.getBalance(operator)
      const balanceRecieverAfter = await web3.eth.getBalance(toFixedHex(recipient, 20))
      const feeBN = toBN(fee.toString())
      balanceAnchorAfter.should.be.eq.BN(toBN(balanceAnchorBefore).sub(toBN(value)))
      balanceRelayerAfter.should.be.eq.BN(toBN(balanceRelayerBefore))
      balanceOperatorAfter.should.be.eq.BN(toBN(balanceOperatorBefore).add(feeBN))
      balanceRecieverAfter.should.be.eq.BN(toBN(balanceRecieverBefore).add(toBN(value)).sub(feeBN))

      logs[0].event.should.be.equal('Withdrawal')
      logs[0].args.nullifierHash.should.be.equal(toFixedHex(input.nullifierHash))
      logs[0].args.relayer.should.be.eq.BN(operator)
      logs[0].args.fee.should.be.eq.BN(feeBN)
      isSpent = await anchor.isSpent(toFixedHex(input.nullifierHash))
      isSpent.should.be.equal(true)
    })

    it('should prevent double spend', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const witness = {
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee,
        refund,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      await anchor.withdraw(proof, ...args, { from: relayer }).should.be.fulfilled
      const error = await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('The note has been already spent')
    })

    it('should prevent double spend with overflow', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const witness = {
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee,
        refund,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(input.root),
        toFixedHex(
          toBN(input.nullifierHash).add(
            toBN('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
          ),
        ),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      const error = await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('verifier-gte-snark-scalar-field')
    })

    it('fee should be less or equal transfer value', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

      const { root, path_elements, path_index } = await tree.path(0)
      const largeFee = bigInt(value).add(bigInt(1))
      const witness = {
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee: largeFee,
        refund,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      const error = await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('Fee exceeds transfer value')
    })

    it('should throw for corrupted merkle tree root', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const witness = {
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        root,
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee,
        refund,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(randomHex(32)),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      const error = await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('Cannot find your merkle root')
    })

    it('should reject with tampered public inputs', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

      let { root, path_elements, path_index } = await tree.path(0)

      const witness = {
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee,
        refund,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      let incorrectArgs
      const originalProof = proof.slice()

      // recipient
      incorrectArgs = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      let error = await anchor.withdraw(proof, ...incorrectArgs, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('Invalid withdraw proof')

      // fee
      incorrectArgs = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        toFixedHex(input.refund),
      ]
      error = await anchor.withdraw(proof, ...incorrectArgs, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('Invalid withdraw proof')

      // nullifier
      incorrectArgs = [
        toFixedHex(input.root),
        toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      error = await anchor.withdraw(proof, ...incorrectArgs, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('Invalid withdraw proof')

      // proof itself
      proof = '0xbeef' + proof.substr(6)
      await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected

      // should work with original values
      await anchor.withdraw(originalProof, ...args, { from: relayer }).should.be.fulfilled
    })

    it('should reject with non zero refund', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await anchor.deposit(toFixedHex(deposit.commitment), { value, from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const witness = {
        nullifierHash: pedersenHash(leInt2Buff(deposit.nullifier, 31)),
        root,
        nullifier: deposit.nullifier,
        relayer: operator,
        recipient,
        fee,
        refund: bigInt(1),
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      const error = await anchor.withdraw(proof, ...args, { from: relayer }).should.be.rejected
      error.reason.should.be.equal('Refund value is supposed to be zero for ETH instance')
    })
  })

  describe('#isSpent', () => {
    it('should work', async () => {
      const deposit1 = generateDeposit()
      const deposit2 = generateDeposit()
      await tree.insert(deposit1.commitment)
      await tree.insert(deposit2.commitment)
      await anchor.deposit(toFixedHex(deposit1.commitment), { value, gasPrice: '0' })
      await anchor.deposit(toFixedHex(deposit2.commitment), { value, gasPrice: '0' })

      const { root, path_elements, path_index } = await tree.path(1)

      // Circuit input
      const witness = {
        // public
        root,
        nullifierHash: pedersenHash(leInt2Buff(deposit2.nullifier, 31)),
        relayer: operator,
        recipient,
        fee,
        refund,

        // private
        nullifier: deposit2.nullifier,
        secret: deposit2.secret,
        pathElements: path_elements,
        pathIndices: path_index,
      };
      const wtns = await createWitness(witness);

      let res = await snarkjs.groth16.prove('build/tornado/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(input.root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]

      await anchor.withdraw(proof, ...args, { from: relayer, gasPrice: '0' })

      const nullifierHash1 = toFixedHex(pedersenHash(leInt2Buff(deposit1.nullifier, 31)))
      const nullifierHash2 = toFixedHex(pedersenHash(leInt2Buff(deposit2.nullifier, 31)))
      const spentArray = await anchor.isSpentArray([nullifierHash1, nullifierHash2])
      spentArray.should.be.deep.equal([false, true])
    })
  })

  afterEach(async () => {
    tree = new MerkleTree(levels, null, prefix)
  })
})