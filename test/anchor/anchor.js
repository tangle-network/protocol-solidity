/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');

const fs = require('fs')
const path = require('path');
const { toBN, randomHex } = require('web3-utils')
const LinkableAnchorContract = artifacts.require('./LinkableERC20AnchorPoseidon2.sol');
const VerifierPoseidonBridge = artifacts.require('./VerifierPoseidonBridge.sol');
const Poseidon = artifacts.require('PoseidonT3');
const Token = artifacts.require("ERC20Mock");

const { NATIVE_AMOUNT, MERKLE_TREE_HEIGHT } = process.env
const snarkjs = require('snarkjs')
const bigInt = require('big-integer');
const BN = require('bn.js');
const crypto = require('crypto')
const circomlib = require('circomlib');
const F = require('circomlib').babyJub.F;
const Scalar = require("ffjavascript").Scalar;
const helpers = require('../helpers');

const utils = require("ffjavascript").utils;
const {
  leBuff2int,
  leInt2Buff,
  stringifyBigInts,
} = utils;
const PoseidonHasher = require('../../lib/Poseidon'); 
const MerkleTree = require('../../lib/MerkleTree');

function bigNumberToPaddedBytes(num, digits =  32) {
  var n = num.toString(16).replace(/^0x/, '');
  while (n.length < (digits * 2)) {
      n = "0" + n;
  }
  return "0x" + n;
}

const poseidonHasher = new PoseidonHasher();
const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]
const toFixedHex = (number, length = 32) =>
  '0x' +
  BigInt(`${number}`)
    .toString(16)
    .padStart(length * 2, '0')
const getRandomRecipient = () => rbigint(20)

function generateDeposit(targetChainID = 0) {
  let deposit = {
    chainID: BigInt(targetChainID),
    secret: rbigint(31),
    nullifier: rbigint(31),
  }

  deposit.commitment = poseidonHasher.hash3([deposit.chainID, deposit.nullifier, deposit.secret]);
  deposit.nullifierHash =   poseidonHasher.hash(null, deposit.nullifier, deposit.nullifier);
  return deposit
}

contract('AnchorPoseidon2', (accounts) => {
  let anchor
  const sender = accounts[0]
  const operator = accounts[0]
  const levels = MERKLE_TREE_HEIGHT || 30
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let prefix = 'poseidon-test'
  let tree
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString())
  const refund = BigInt((new BN('0')).toString())
  const recipient = getRandomRecipient()
  const relayer = accounts[1]
  let verifier;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = 125;

  let createWitness;

  beforeEach(async () => {
    tree = new MerkleTree(levels, null, prefix)
    hasherInstance = await Poseidon.new();
    verifier = await VerifierPoseidonBridge.new();
    token = await Token.new();
    await token.mint(sender, new BN('10000000000000000000000'));
    const balanceOfSender = await token.balanceOf.call(sender);
    anchor = await LinkableAnchorContract.new(
      verifier.address,
      hasherInstance.address,
      tokenDenomination,
      levels,
      chainID,
      token.address,
    );

    setHandler = (handler, _sender) => LinkableAnchorInstance.setHandler(handler, {
      from: _sender
    });

    setBridge = (bridge, _sender) => LinkableAnchorInstance.setBridge(bridge, {
      from: _sender
    });

    addEdge = (edge, _sender) => LinkableAnchorInstance.addEdge(
      edge.destChainID,
      edge.destResourceID,
      edge.root,
      edge.height,
      { from: _sender }
    )

    updateEdge = (edge, _sender) => LinkableAnchorInstance.updateEdge(
      edge.destChainID,
      edge.destResourceID,
      edge.root,
      edge.height,
      { from: _sender }
    )

    createWitness = async (data) => {
      const wtns = {type: "mem"};
      await snarkjs.wtns.calculate(data, path.join(
        "artifacts/circuits",
        "bridge",
        "poseidon_bridge_2.wasm"
      ), wtns);
      return wtns;
    }

    tree = new MerkleTree(levels, null, prefix)
    zkey_final = fs.readFileSync('build/bridge2/circuit_final.zkey').buffer;
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const etherDenomination = await anchor.denomination()
      assert.strictEqual(etherDenomination.toString(), toBN(value).toString());
    });
  })

  describe('#deposit', () => {
    it('should emit event', async () => {
      let commitment = toFixedHex(42);
      await token.approve(anchor.address, tokenDenomination)
      let { logs } = await anchor.deposit(commitment, { from: sender })

      assert.strictEqual(logs[0].event, 'Deposit')
      assert.strictEqual(logs[0].args.commitment, commitment)
      assert.strictEqual(logs[0].args.leafIndex.toString(), '0');

      const anchorBalance = await token.balanceOf.call(anchor.address);
      assert.strictEqual(anchorBalance.toString(), toBN(tokenDenomination).toString());
    })

    it('should throw if there is a such commitment', async () => {
      const commitment = toFixedHex(42)
      await token.approve(anchor.address, tokenDenomination)
      await TruffleAssert.passes(anchor.deposit(commitment, { from: sender }));
      await TruffleAssert.reverts(
        anchor.deposit(commitment, { from: sender }),
        'The commitment has been submitted'
      );
    })
  })

  // Use Node version >=12
  describe('snark proof verification on js side', () => {
    it('should detect tampering', async () => {
      const deposit = generateDeposit(chainID);
      await tree.insert(deposit.commitment);
      const { root, path_elements, path_index } = await tree.path(0);
      const roots = [root, 0];
      const diffs = roots.map(r => {
        return F.sub(
          Scalar.fromString(`${r}`),
          Scalar.fromString(`${root}`),
        ).toString();
      });
      // mock set membership gadget computation
      for (var i = 0; i < roots.length; i++) {
        assert.strictEqual(Scalar.fromString(roots[i]), F.add(Scalar.fromString(diffs[i]), Scalar.fromString(root)));
      }

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);

      // nullifier
      publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, false)
      publicSignals = tempSignals;

      // try to cheat with recipient
      publicSignals[1] = '133738360804642228759657445999390850076318544422'
      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, false)
      publicSignals = tempSignals;

      // fee
      publicSignals[2] = '1337100000000000000000'
      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, false)
      publicSignals = tempSignals;
    })
  })

  describe('#withdraw', () => {
    it.only('should work', async () => {
      const deposit = generateDeposit(chainID);
      const user = accounts[4]
      await tree.insert(deposit.commitment)

      await token.mint(user, tokenDenomination);
      const balanceUserBefore = await token.balanceOf(user);

      // Uncomment to measure gas usage
      // let gas = await anchor.deposit.estimateGas(toBN(deposit.commitment.toString()), { value, from: user })
      // console.log('deposit gas:', gas)
      await token.approve(anchor.address, tokenDenomination, { from: user });
      await anchor.deposit(toFixedHex(deposit.commitment), { from: user })

      const balanceUserAfter = await token.balanceOf(user)
      assert.strictEqual(balanceUserAfter.toString(), BN(toBN(balanceUserBefore).sub(toBN(value))).toString());

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('build/bridge2/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);
      const balanceAnchorBefore = await web3.eth.getBalance(anchor.address)
      const balanceRelayerBefore = await web3.eth.getBalance(relayer)
      const balanceOperatorBefore = await web3.eth.getBalance(operator)
      const balanceRecieverBefore = await web3.eth.getBalance(toFixedHex(recipient, 20))
      let isSpent = await anchor.isSpent(toFixedHex(input.nullifierHash))
      assert.strictEqual(isSpent, false)

      // Uncomment to measure gas usage
      // gas = await anchor.withdraw.estimateGas(proof, publicSignals, { from: relayer, gasPrice: '0' })
      // console.log('withdraw gas:', gas)
      const args = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];

      console.log([
        publicSignals[0],
        publicSignals[1],
        publicSignals[2],
        publicSignals[3],
        publicSignals[4],
        publicSignals[5],
        publicSignals[6],
        publicSignals[7],
      ]);
      // console.log([
      //   toFixedHex(publicSignals[0]),
      //   toFixedHex(publicSignals[1]),
      //   toFixedHex(publicSignals[2]),
      //   toFixedHex(publicSignals[3]),
      //   toFixedHex(publicSignals[4]),
      //   toFixedHex(publicSignals[5]),
      //   toFixedHex(publicSignals[6]),
      //   toFixedHex(publicSignals[7]),
      // ]);

      // console.log([
      //   ...proof.pi_a,
      //   ...proof.pi_b[0],
      //   ...proof.pi_b[1],
      //   ...proof.pi_c,
      // ]);

      proofHex = helpers.toSolidityInput(proof);
      // TODO: This gives: Error: VM Exception while processing transaction: invalid opcode
      // proofEncoded = [
      //   toFixedHex(proof.pi_a[0], 32),
      //   toFixedHex(proof.pi_a[1], 32),
      //   toFixedHex(proof.pi_b[0][0], 32),
      //   toFixedHex(proof.pi_b[0][1], 32),
      //   toFixedHex(proof.pi_b[1][0], 32),
      //   toFixedHex(proof.pi_b[1][1], 32),
      //   toFixedHex(proof.pi_c[0], 32),
      //   toFixedHex(proof.pi_c[1], 32),
      // ]
      // .map(elt => elt.substr(2))
      // .join('');

      // TODO: This gives: Error: VM Exception while processing transaction: reverted with reason string 'Invalid withdraw proof'
      proofEncoded = [
        toFixedHex(proof.pi_a[0], 32),
        toFixedHex(proof.pi_a[1], 32),
        toFixedHex(proof.pi_b[0][1], 32),
        toFixedHex(proof.pi_b[0][0], 32),
        toFixedHex(proof.pi_b[1][1], 32),
        toFixedHex(proof.pi_b[1][0], 32),
        toFixedHex(proof.pi_c[0], 32),
        toFixedHex(proof.pi_c[1], 32),
      ]
      .map(elt => elt.substr(2))
      .join('');

      console.log(proofEncoded.length);
      const { logs } = await anchor.withdraw(`0x${proofEncoded}`, ...args, { from: relayer, gasPrice: '0' })

      const balanceAnchorAfter = await web3.eth.getBalance(anchor.address)
      const balanceRelayerAfter = await web3.eth.getBalance(relayer)
      const balanceOperatorAfter = await web3.eth.getBalance(operator)
      const balanceRecieverAfter = await web3.eth.getBalance(toFixedHex(recipient, 20))
      const feeBN = toBN(fee.toString())
      assert.strictEqual(balanceAnchorAfter, toBN(balanceAnchorBefore).sub(toBN(value)))
      assert.strictEqual(balanceRelayerAfter, toBN(balanceRelayerBefore))
      assert.strictEqual(balanceOperatorAfter, toBN(balanceOperatorBefore).add(feeBN))
      assert.strictEqual(balanceRecieverAfter, toBN(balanceRecieverBefore).add(toBN(value)).sub(feeBN))

      assert.strictEqual(logs[0].event, 'Withdrawal')
      assert.strictEqual(logs[0].args.nullifierHash, toFixedHex(input.nullifierHash))
      assert.strictEqual(logs[0].args.relayer, BN(operator));
      assert.strictEqual(logs[0].args.fee, BN(feeBN));
      isSpent = await anchor.isSpent(toFixedHex(input.nullifierHash))
      assert(isSpent);
    })

    it('should prevent double spend', async () => {
      const deposit = generateDeposit();
      await tree.insert(deposit.commitment);
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit.commitment), { from: sender });

      const { root, path_elements, path_index } = await tree.path(0);

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];

      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];

      await TruffleAssert.passes(anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' }));
      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' }),
        "The note has been already spent"
      );
    })

    it('should prevent double spend with overflow', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(root),
        toFixedHex(
          toBN(input.nullifierHash).add(
            toBN('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
          ),
        ),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];

      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];

      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' }),
        "verifier-gte-snark-scalar-field"
      );
    })

    it('fee should be less or equal transfer value', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)
      const largeFee = new BN(`${value}`).add(bigInt(1))

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]

      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];

      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' }),
        "Fee exceeds transfer value"
      );
    })

    it('should throw for corrupted merkle tree root', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
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

      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];

      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' }),
        "Cannot find your merkle root"
      );
    })

    it('should reject with tampered public inputs', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit.commitment), { from: sender })

      let { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      let incorrectArgs
      const originalProof = proof;

      // recipient
      incorrectArgs = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];
      let proofHex = helpers.toSolidityInput(proof);
      let proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];
      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...incorrectArgs, { from: relayer, gasPrice: '0' }),
        "Invalid withdraw proof"
      );

      // fee
      incorrectArgs = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        toFixedHex(input.refund),
      ];
      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = Buffer.concat([
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ].map(elt => Buffer.from(elt.toString(16))));
      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...incorrectArgs, { from: relayer, gasPrice: '0' }),
        "Invalid withdraw proof"
      );

      // nullifier
      incorrectArgs = [
        toFixedHex(root),
        toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];
      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];
      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...incorrectArgs, { from: relayer, gasPrice: '0' }),
        "Invalid withdraw proof"
      );

      // proof itself
      proof = '0xbeef' + proof.substr(6)
      await TruffleAssert.passes(anchor.withdraw(proof, ...args, { from: relayer, gasPrice: '0' }));

      // should work with original values
      await TruffleAssert.passes(anchor.withdraw(originalProof, ...args, { from: relayer, gasPrice: '0' }));
    })

    it('should reject with non zero refund', async () => {
      const deposit = generateDeposit()
      await tree.insert(deposit.commitment)
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit.commitment), { from: sender })

      const { root, path_elements, path_index } = await tree.path(0)

      const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;


      const args = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ];
      proofHex = helpers.toSolidityInput(proof);
      proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];
      await TruffleAssert.reverts(
        anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' }),
        "Refund value is supposed to be zero for ETH instance"
      );
    })
  })

  describe('#isSpent', () => {
    it('should work', async () => {
      const deposit1 = generateDeposit(chainID)
      const deposit2 = generateDeposit(chainID)
      await tree.insert(deposit1.commitment)
      await tree.insert(deposit2.commitment)

      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit1.commitment));
      
      await token.approve(anchor.address, tokenDenomination)
      await anchor.deposit(toFixedHex(deposit2.commitment));

      const { root, path_elements, path_index } = await tree.path(1)

      const input = {
        // public
        nullifierHash: deposit2.nullifierHash,
        recipient,
        relayer,
        fee,
        refund,
        chainID: deposit.chainID,
        roots: [root, 0],
        // private
        nullifier: deposit2.nullifier,
        secret: deposit2.secret,
        pathElements: path_elements,
        pathIndices: path_index,
        diffs: [root, 0].map(r => {
          return F.sub(
            Scalar.fromString(`${r}`),
            Scalar.fromString(`${root}`),
          ).toString();
        }),
      };

      const wtns = await createWitness(input);

      let res = await snarkjs.groth16.prove('build/bridge2/circuit_final.zkey', wtns);
      proof = res.proof;
      publicSignals = res.publicSignals;

      const args = [
        toFixedHex(root),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.recipient, 20),
        toFixedHex(input.relayer, 20),
        toFixedHex(input.fee),
        toFixedHex(input.refund),
      ]
      let proofHex = helpers.toSolidityInput(proof);
      let proofEncoded = [
        ...proof.pi_a,
        ...proof.pi_b[0],
        ...proof.pi_b[1],
        ...proo.pi_c,
      ];
      await anchor.withdraw(proofEncoded, ...args, { from: relayer, gasPrice: '0' })

      const nullifierHash1 = toFixedHex(pedersenHash(bigNumberToPaddedBytes(deposit1.nullifier, 31)))
      const nullifierHash2 = toFixedHex(pedersenHash(bigNumberToPaddedBytes(depisit2.nullifier, 31)))
      const spentArray = await anchor.isSpentArray([nullifierHash1, nullifierHash2])
      assert.strictEqual(spentArray, [false, true])
    })
  })

  afterEach(async () => {
    tree = new MerkleTree(levels, null, prefix)
  })
})

module.exports = {
  generateDeposit,
};
