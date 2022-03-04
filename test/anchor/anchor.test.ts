/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
 const assert = require('assert');
 import { ethers } from 'hardhat';
 const TruffleAssert = require('truffle-assertions');
 
 const fs = require('fs');
 const path = require('path');
 const { toBN, randomHex } = require('web3-utils');
 import { BigNumber, BigNumberish } from 'ethers';
 import BN from 'bn.js';
 
 // Typechain generated bindings for contracts
 import {
   ERC20Mock as Token,
   ERC20Mock__factory as TokenFactory,
   GovernedTokenWrapper as WrappedToken,
   GovernedTokenWrapper__factory as WrappedTokenFactory,
   PoseidonT3__factory,
 } from '../../typechain';
 
 // Convenience wrapper classes for contract classes
 import { Verifier } from '../../packages/bridges/src';
 import { Anchor } from '../../packages/anchors/src';
 import { MerkleTree } from '../../packages/merkle-tree/src';
 import { fetchComponentsFromFilePaths, ZkComponents, toFixedHex, getChainIdType, getFixedAnchorExtDataHash } from '../../packages/utils/src';
import { IFixedAnchorExtData } from '@webb-tools/interfaces';
 
 const { NATIVE_AMOUNT } = process.env
 const snarkjs = require('snarkjs')
 const bigInt = require('big-integer');
 const F = require('circomlibjs').babyjub.F;
 const Scalar = require("ffjavascript").Scalar;
 
 describe('Anchor for 2 max edges', () => {
   let anchor: Anchor;
   let zkComponents: ZkComponents;
 
   const levels = 30;
   const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
   let tree: MerkleTree;
   const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN('100000000000000000')).toString());
   const refund = BigInt((new BN('0')).toString());
   let recipient = "0x1111111111111111111111111111111111111111";
   let verifier: Verifier;
   let hasherInstance: any;
   let token: Token;
   let wrappedToken: WrappedToken;
   let tokenDenomination = '1000000000000000000' // 1 ether
   const chainID = getChainIdType(31337);
   const MAX_EDGES = 1;
   let createWitness: any;
 
   before(async () => {
     // Grab the zero knowledge components
     zkComponents = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey')
     );
   })
 
   beforeEach(async () => {
     const signers = await ethers.getSigners();
     const wallet = signers[0];
     const sender = wallet;
 
     tree = new MerkleTree(levels);
 
     // create poseidon hasher
     const hasherFactory = new PoseidonT3__factory(wallet);
     hasherInstance = await hasherFactory.deploy();
     await hasherInstance.deployed();
 
     // create poseidon verifier
     verifier = await Verifier.createVerifier(sender);
 
     // create token
     const tokenFactory = new TokenFactory(wallet);
     token = await tokenFactory.deploy();
     await token.deployed();
     await token.mint(sender.address, '10000000000000000000000');
 
     // create Anchor
     anchor = await Anchor.createAnchor(
       verifier.contract.address,
       hasherInstance.address,
       tokenDenomination,
       levels,
       token.address,
       sender.address,
       MAX_EDGES,
       zkComponents,
       sender,
     );
 
     // approve the anchor to spend the minted funds
     await token.approve(anchor.contract.address, '10000000000000000000000');
 
     createWitness = async (data: any) => {
       const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/anchor/2/witness_calculator.js");
       const fileBuf = require('fs').readFileSync('./protocol-solidity-fixtures/fixtures/anchor/2/poseidon_anchor_2.wasm');
       const wtnsCalc = await witnessCalculator(fileBuf)
       const wtns = await wtnsCalc.calculateWTNSBin(data,0);
       return wtns;
     }
   })
 
   describe('#constructor', () => {
     it('should initialize', async () => {
       const etherDenomination = await anchor.contract.denomination()
       assert.strictEqual(etherDenomination.toString(), toBN(value).toString());
     });
   })
 
   describe ('Setting Handler/Verifier Address Negative Tests', () => {
     it('should revert (setting handler) with improper nonce', async() => {
       const signers = await ethers.getSigners();
       await TruffleAssert.reverts(
         anchor.contract.setHandler(signers[1].address, 0),
         'Invalid nonce'
       )
       await TruffleAssert.reverts(
         anchor.contract.setHandler(signers[1].address, 2),
         'Nonce must increment by 1'
       )
     });
 
     it('should revert (setting verifier) with improper nonce', async() => {
       const signers = await ethers.getSigners();
       await TruffleAssert.reverts(
         anchor.contract.setVerifier(signers[1].address, 0),
         'Invalid nonce'
       )
       await TruffleAssert.reverts(
         anchor.contract.setVerifier(signers[1].address, 2),
         'Nonce must increment by 1'
       )
     });
   })
 
   describe('#deposit', () => {
     it('should emit event', async () => {
       let { deposit } = await anchor.deposit();
 
       const filter = anchor.contract.filters.Deposit(null, null, toFixedHex(deposit.commitment), null);
       const events = await anchor.contract.queryFilter(filter, anchor.contract.deployTransaction.blockNumber);
 
       assert.strictEqual(events[0].event, 'Deposit');
       assert.strictEqual(events[0].args[2], toFixedHex(deposit.commitment));
 
       const anchorBalance = await token.balanceOf(anchor.contract.address);
       assert.strictEqual(anchorBalance.toString(), toBN(tokenDenomination).toString());
     });
 
     it('should throw if there is a such commitment', async () => {
       const commitment = toFixedHex(42)
 
       await TruffleAssert.passes(anchor.contract.deposit(commitment));
       await TruffleAssert.reverts(
         anchor.contract.deposit(commitment),
         'The commitment has been submitted'
       );
     });
   })
 
   // Use Node version >=12
   describe('snark proof verification on js side', () => {
     it('should detect tampering', async () => {
       const deposit = Anchor.generateDeposit(chainID);
       await tree.insert(deposit.commitment);
       const { merkleRoot, pathElements, pathIndices } = await tree.path(0);
       const roots = [merkleRoot, 0];
 
       const signers = await ethers.getSigners();
       const relayer = signers[1].address;
 
       const input = {
         // public
         nullifierHash: deposit.nullifierHash,
         extDataHash: getFixedAnchorExtDataHash({_refreshCommitment: toFixedHex(0), _recipient: recipient, _relayer: relayer, _fee: fee, _refund: refund}),
         chainID: deposit.chainID,
         roots: [merkleRoot, 0],
         // private
         nullifier: deposit.nullifier,
         secret: deposit.secret,
         pathElements: pathElements,
         pathIndices: pathIndices,
       };
 
       const wtns = await createWitness(input);
 
       let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey', wtns);
       const proof = res.proof;
       let publicSignals = res.publicSignals;
       let tempProof = proof;
       let tempSignals = publicSignals;
       const vKey = await snarkjs.zKey.exportVerificationKey('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey');
 
       res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
       assert.strictEqual(res, true);
 
       // nullifier hash
       publicSignals[0] = '133792158246920651341275668520530514036799294649489851421007411546007850802'
       res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
       assert.strictEqual(res, false)
       publicSignals = tempSignals;
 
       // try to cheat with ext data hash
       publicSignals[1] = '133738360804642228759657445999390850076318544422'
       res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
       assert.strictEqual(res, false)
       publicSignals = tempSignals;
 
       // chain id
       publicSignals[2] = '1337100000000000000000'
       res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
       assert.strictEqual(res, false)
       publicSignals = tempSignals;
     });
   })
 
   describe('#withdraw', () => {
     it('should work', async () => {
       const signers = await ethers.getSigners();
       const sender = signers[0];
       const relayer = signers[1];
 
       const balanceUserBefore = await token.balanceOf(sender.address);
       const { deposit, index } = await anchor.deposit();
 
       const balanceUserAfterDeposit = await token.balanceOf(sender.address)
       const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
       assert.strictEqual(balanceUserAfterDeposit.toString(), (new BN(toBN(balanceUserBefore).sub(toBN(value)))).toString());
       assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());
 
       const balanceRelayerBefore = await token.balanceOf(relayer.address)
       const balanceReceiverBefore = await token.balanceOf(toFixedHex(recipient, 20))
 
       let isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
       assert.strictEqual(isSpent, false)
 
       let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, toFixedHex(0));
       const filter = anchor.contract.filters.Withdrawal(null, relayer.address, null);
       const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
 
       const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
       const balanceRelayerAfter = await token.balanceOf(relayer.address)
       const balanceReceiverAfter = await token.balanceOf(toFixedHex(recipient, 20))
       const feeBN = toBN(fee.toString())
       assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
       assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
       assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())
 
       assert.strictEqual(events[0].event, 'Withdrawal')
       assert.strictEqual(events[0].args[2].toString(), feeBN.toString());
       isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
       assert(isSpent);
     });
 
     it('should prevent double spend', async () => {
       const signers = await ethers.getSigners();
       const sender = signers[0];
       const relayer = signers[1];
 
       const { deposit, index } = await anchor.deposit();
       
       //@ts-ignore
       let receipt = await anchor.withdraw(deposit, index, sender.address, relayer.address, fee, toFixedHex(0));
 
       await TruffleAssert.reverts(
         //@ts-ignore
         anchor.withdraw(deposit, index, sender.address, relayer.address, fee, toFixedHex(0)),
         'The note has been already spent',
       );
     });
 
     it('should prevent double spend with overflow', async () => {
       const signers = await ethers.getSigners();
       const relayer = signers[0];
 
       const deposit = Anchor.generateDeposit(chainID)
       await tree.insert(deposit.commitment)
       await anchor.contract.deposit(toFixedHex(deposit.commitment))
 
       const { merkleRoot, pathElements, pathIndices } = await tree.path(0)
 
       const input = {
         // public
         nullifierHash: deposit.nullifierHash,
         extDataHash: getFixedAnchorExtDataHash({_refreshCommitment: toFixedHex(0), _recipient: recipient, _relayer: relayer.address, _fee: fee, _refund: refund}),
         chainID: deposit.chainID,
         roots: [merkleRoot, '0'],
         // private
         nullifier: deposit.nullifier,
         secret: deposit.secret,
         pathElements: pathElements,
         pathIndices: pathIndices,
       };
 
       const wtns = await createWitness(input);
 
       let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey', wtns);
       const proof = res.proof;
       let publicSignals = res.publicSignals;
       const proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
       const args = [
         `0x${proofEncoded}`,
         Anchor.createRootsBytes(input.roots),
         toFixedHex(
           toBN(input.nullifierHash).add(
             toBN('21888242871839275222246405745257275088548364400416034343698204186575808495617'),
           ),
         ),
         toFixedHex(input.extDataHash),
       ];

       const publicInputs = Anchor.convertArgsArrayToStruct(args);
       const relayerAddress = relayer.address;
       const extData: IFixedAnchorExtData = { 
          _refreshCommitment: toFixedHex(0), 
          _recipient: recipient, 
          _relayer: relayerAddress, 
          _fee: fee, 
          _refund: refund,
       }

       await TruffleAssert.reverts(
         //@ts-ignore
         anchor.contract.withdraw(publicInputs, extData),
         'verifier-gte-snark-scalar-field',
       );
     });
 
     it('fee should be less or equal to transfer value', async () => {
       const signers = await ethers.getSigners();
       const relayer = signers[0];
 
       const { deposit, index } = await anchor.deposit();
       const largeFee = bigInt(value).add(bigInt(1_000_000));
       await TruffleAssert.reverts(
         //@ts-ignore
         anchor.withdraw(deposit, index, recipient, relayer.address, largeFee, toFixedHex(0)),
         'Fee exceeds transfer value',
       );
     });
 
     it('should throw for corrupted merkle tree root', async () => {
       const signers = await ethers.getSigners();
       const relayer = signers[0].address;
 
       const deposit = Anchor.generateDeposit(chainID)
       await tree.insert(deposit.commitment)
       await anchor.contract.deposit(toFixedHex(deposit.commitment))
 
       const { merkleRoot, pathElements, pathIndices } = await tree.path(0)
 
       const input = {
        // public
        nullifierHash: deposit.nullifierHash,
        extDataHash: getFixedAnchorExtDataHash({_refreshCommitment: toFixedHex(0), _recipient: recipient, _relayer: relayer, _fee: fee, _refund: refund}),
        chainID: deposit.chainID,
        roots: [merkleRoot, 0],
        // private
        nullifier: deposit.nullifier,
        secret: deposit.secret,
        pathElements: pathElements,
        pathIndices: pathIndices,
      };
 
       const wtns = await createWitness(input);
 
       let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey', wtns);
       const proof = res.proof;
       let publicSignals = res.publicSignals;
       const proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);

       const args = [
        `0x${proofEncoded}`,
        Anchor.createRootsBytes([randomHex(32), 0]),
        toFixedHex(input.nullifierHash),
        toFixedHex(input.extDataHash)
       ]
 
       const publicInputs = Anchor.convertArgsArrayToStruct(args);
       const extData: IFixedAnchorExtData = { 
        _refreshCommitment: toFixedHex(0), 
        _recipient: recipient, 
        _relayer: relayer, 
        _fee: fee, 
        _refund: refund,
      }

       await TruffleAssert.reverts(
         //@ts-ignore
         anchor.contract.withdraw(publicInputs, extData),
         'Cannot find your merkle root'
       );
     });
 
     it('should reject with tampered public inputs', async () => {
       const signers = await ethers.getSigners();
       const relayer = signers[0];
       const deposit = Anchor.generateDeposit(chainID)
       await tree.insert(deposit.commitment)
       await anchor.contract.deposit(toFixedHex(deposit.commitment))

       let { merkleRoot, pathElements, pathIndices } = await tree.path(0)
       const refreshCommitment = toFixedHex(0);
       const relayerAddress = relayer.address;
       const extData: IFixedAnchorExtData = { 
          _refreshCommitment: refreshCommitment, 
          _recipient: recipient, 
          _relayer: relayerAddress, 
          _fee: fee, 
          _refund: refund,
       }
       const extDataHash = getFixedAnchorExtDataHash(extData).toString();
       const input = {
         // public
         nullifierHash: deposit.nullifierHash,
         extDataHash: extDataHash,
         chainID: deposit.chainID,
         roots: [merkleRoot, '0'],
         // private
         nullifier: deposit.nullifier,
         secret: deposit.secret,
         pathElements: pathElements,
         pathIndices: pathIndices,
       };
       const wtns = await createWitness(input);
       let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey', wtns);
       const proof = res.proof;
       let publicSignals = res.publicSignals;
       const proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
       const args = [
         `0x${proofEncoded}`,
         Anchor.createRootsBytes(input.roots),
         toFixedHex(input.nullifierHash),
         toFixedHex(input.extDataHash)
       ]
       const publicInputs = Anchor.convertArgsArrayToStruct(args);
 
       // recipient
       let incorrectExtData: IFixedAnchorExtData = { 
         _refreshCommitment: toFixedHex(refreshCommitment), 
         _recipient: toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20), 
         _relayer: relayerAddress, 
         _fee: fee, 
         _refund: refund,
        }
       
       await TruffleAssert.reverts(
         //@ts-ignore
         anchor.contract.withdraw(publicInputs, incorrectExtData),
         'extDataHash is invalid',
       );
 
       // fee
       incorrectExtData = { 
        _refreshCommitment: toFixedHex(refreshCommitment), 
        _recipient: toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20), 
        _relayer: relayerAddress, 
        _fee: BigInt(toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000')), 
        _refund: refund,
       };
 
       await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(publicInputs, incorrectExtData),
        'extDataHash is invalid',
      );
 
       // nullifier hash
       let incorrectArgs = [
        `0x${proofEncoded}`,
        Anchor.createRootsBytes(input.roots),
        toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'),
        toFixedHex(input.extDataHash)
      ]
 
       let incorrectPublicInputs = Anchor.convertArgsArrayToStruct(incorrectArgs);
       await TruffleAssert.reverts(
         //@ts-ignore
         anchor.contract.withdraw(incorrectPublicInputs, extData),
         'Invalid withdraw proof',
       );
 
       // refresh commitment
       incorrectExtData = { 
        _refreshCommitment: toFixedHex('0x00abdfc78211f8807b9c6504a6e537e71b8788b2f529a95f1399ce124a8642ad'), 
        _recipient: toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20), 
        _relayer: relayerAddress, 
        _fee: BigInt(toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000')), 
        _refund: refund,
       };
 
       await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.withdraw(publicInputs, incorrectExtData),
        'extDataHash is invalid',
      );
 
       // should work with original values
       //@ts-ignore
       await TruffleAssert.passes(anchor.contract.withdraw(
         publicInputs,
         extData,
       ));
     }).timeout(60000);
   })
 
   describe('#isSpent', () => {
     it('should work', async () => {
       const signers = await ethers.getSigners();
       const relayer = signers[0];
 
       const { deposit: deposit1, index: index1 } = await anchor.deposit();
       const { deposit: deposit2, index: index2 } = await anchor.deposit();
 
       //@ts-ignore
       await anchor.withdraw(deposit1, index1, signers[0].address, relayer.address, fee, toFixedHex(0));
 
       const spentArray = await anchor.contract.isSpentArray([
         toFixedHex(deposit2.nullifierHash),
         toFixedHex(deposit1.nullifierHash)
       ]);
       assert.deepStrictEqual(spentArray, [false, true])
     });
   })
 
   describe('#WrapperClass', () => {
     it('should deposit without latest history', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
 
       // create a deposit on the anchor already setup
       await anchor.deposit();
 
       // create a new anchor by connecting to the address of the setup anchor
       const newAnchor = await Anchor.connect(anchor.contract.address, zkComponents, wallet);
 
       // make sure the deposit goes through
       await TruffleAssert.passes(newAnchor.deposit());
       assert.strictEqual(newAnchor.latestSyncedBlock, 0);
     });
 
     it('should properly update to the latest on-chain', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
 
       // create a deposit on the anchor already setup
       await anchor.deposit();
 
       // create a new anchor by connecting to the address of the setup anchor
       const newAnchor = await Anchor.connect(anchor.contract.address, zkComponents, wallet);
       await newAnchor.update();
 
       // check that the merkle roots are the same for both anchor instances
       assert.strictEqual(
         (await anchor.tree.root()).toString(),
         (await newAnchor.tree.root()).toString()
       );
     });
 
     it('should properly update before withdraw tx', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
 
       // create a deposit on the anchor already setup
       const { deposit, index } = await anchor.deposit();
 
       // create a new anchor by connecting to the address of the setup anchor
       const newAnchor = await Anchor.connect(anchor.contract.address, zkComponents, wallet);
       await TruffleAssert.passes(newAnchor.withdraw(deposit, index, recipient, signers[1].address, fee, toFixedHex(0)));
     });
 
     it('Should properly create withdraw proof to use directly in contract', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
 
       // create a deposit on the anchor already setup
       const { deposit, index } = await anchor.deposit();
 
       const newAnchor = await Anchor.connect(anchor.contract.address, zkComponents, wallet);
 
       const withdrawSetup = await newAnchor.setupWithdraw(deposit, index, recipient, signers[1].address, fee, toFixedHex(0));
       
       const proof = withdrawSetup.publicInputs.proof;
       const args = withdrawSetup.args;
 
       const publicInputs = Anchor.convertArgsArrayToStruct(args);
 
       await TruffleAssert.passes(newAnchor.contract.withdraw(withdrawSetup.publicInputs, withdrawSetup.extData));
     }).timeout(50000)
 
     it('should properly refresh a deposit', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const relayer = signers[1].address;
 
       // create a deposit on the anchor already setup
       const { deposit, index } = await anchor.deposit();
       const refreshedDestId = getChainIdType(await wallet.getChainId());
       const refreshedDeposit = Anchor.generateDeposit(refreshedDestId);
 
       const { merkleRoot, pathElements, pathIndices } = anchor.tree.path(0);
       const extData: IFixedAnchorExtData = { 
        _refreshCommitment: toFixedHex(refreshedDeposit.commitment), 
        _recipient: recipient, 
        _relayer: relayer, 
        _fee: fee, 
        _refund: refund,
     }
       const input = {
         // public
         nullifierHash: deposit.nullifierHash,
         extDataHash: getFixedAnchorExtDataHash(extData),
         chainID: deposit.chainID,
         roots: [merkleRoot, 0],
         // private
         nullifier: deposit.nullifier,
         secret: deposit.secret,
         pathElements: pathElements,
         pathIndices: pathIndices,
       };
       const wtns = await createWitness(input);
 
       let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey', wtns);
       const vKey = await snarkjs.zKey.exportVerificationKey('protocol-solidity-fixtures/fixtures/anchor/2/circuit_final.zkey');
 
       res = await snarkjs.groth16.verify(vKey, res.publicSignals, res.proof);
       assert(res);
 
       // create a new anchor by connecting to the address of the setup anchor
       let newAnchor = await Anchor.connect(anchor.contract.address, zkComponents, wallet);
       await TruffleAssert.passes(newAnchor.withdraw(
         deposit,
         index,
         recipient,
         signers[1].address,
         fee,
         toFixedHex(refreshedDeposit.commitment)
       ));
       await TruffleAssert.passes(newAnchor.withdraw(
         refreshedDeposit,
         index + 1,
         recipient,
         signers[1].address,
         fee,
         toFixedHex(0),
       ));
     });
 
     it('should wrap and deposit', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
 
       // create Anchor for wrapped token
       const wrappedAnchor = await Anchor.createAnchor(
         verifier.contract.address,
         hasherInstance.address,
         tokenDenomination,
         levels,
         wrappedToken.address,
         sender.address,
         MAX_EDGES,
         zkComponents,
         sender
       );
 
       const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
       await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);
 
       await token.approve(wrappedToken.address, '1000000000000000000');
       const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
 
       // create a deposit on the anchor already setup
       const { deposit, index } = await wrappedAnchor.wrapAndDeposit(
         token.address,
       );
       const balTokenAfterDepositSender = await token.balanceOf(sender.address);
       assert.strictEqual(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString(), '1000000000000000000');
 
       const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
       const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(sender.address);
       const newAnchor = await Anchor.connect(wrappedAnchor.contract.address, zkComponents, wallet);
       await TruffleAssert.passes(newAnchor.withdraw(deposit, index, sender.address, signers[1].address, bigInt(0), toFixedHex(0)));
       const balWrappedTokenAfterWithdrawSender = await wrappedToken.balanceOf(sender.address);
       const balWrappedTokenAfterWithdrawAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
       assert.strictEqual(balWrappedTokenAfterWithdrawSender.sub(balWrappedTokenAfterDepositSender).toString(), '1000000000000000000');
       assert.strictEqual(balWrappedTokenAfterDepositAnchor.sub(balWrappedTokenAfterWithdrawAnchor).toString(), '1000000000000000000');
     });
 
     it('wrapping fee should work correctly with wrap and deposit', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000010000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
       const wrapFee = 5;
       await wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1));
 
       // create Anchor for wrapped token
       const wrappedAnchor = await Anchor.createAnchor(
         verifier.contract.address,
         hasherInstance.address,
         tokenDenomination,
         levels,
         wrappedToken.address,
         sender.address,
         MAX_EDGES,
         zkComponents,
         sender
       );
 
       const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
       await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);
 
       await token.approve(wrappedToken.address, '10000000000000000000');
       const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
 
       const balUnwrappedTokenBeforeDepositWrapper = await token.balanceOf(wrappedToken.address);
       // create a deposit on the anchor already setup
       const { deposit, index } = await wrappedAnchor.wrapAndDeposit(
         token.address, 
         wrapFee,
       );
 
       const balTokenAfterDepositSender = await token.balanceOf(sender.address);
       assert.strictEqual(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString(), BigNumber.from('1000000000000000000').mul(100).div(100 - wrapFee).toString());
 
       // anchor should recieve webb tokens
       const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
       assert.strictEqual(balWrappedTokenAfterDepositAnchor.toString(), tokenDenomination);
       
       //token wrapper should receieve erc20 liquidity
       const balUnwrappedTokenAfterDepositWrapper = await token.balanceOf(wrappedToken.address);
       assert.strictEqual(balUnwrappedTokenAfterDepositWrapper.sub(balUnwrappedTokenBeforeDepositWrapper).toString(), BigNumber.from('1000000000000000000').toString());
 
       const balUnwrappedTokenBeforeWithdrawSender = await token.balanceOf(sender.address);
 
       const newAnchor = await Anchor.connect(wrappedAnchor.contract.address, zkComponents, wallet);
       await TruffleAssert.passes(newAnchor.withdrawAndUnwrap(deposit, getChainIdType(31337), index, sender.address, signers[1].address, bigInt(0), toFixedHex(0), token.address));
       const balWrappedTokenAfterWithdrawAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
       assert.strictEqual(balWrappedTokenAfterWithdrawAnchor.toString(), '0');
 
       const balUnwrappedTokenAfterWithdrawWrapper = await token.balanceOf(wrappedToken.address);
       assert.strictEqual(BigNumber.from('0').toString(), balUnwrappedTokenAfterWithdrawWrapper.toString());
 
       const balUnwrappedTokenAfterWithdrawSender = await token.balanceOf(sender.address);
       assert.strictEqual(balUnwrappedTokenBeforeWithdrawSender.add(tokenDenomination).toString(), balUnwrappedTokenAfterWithdrawSender.toString());
     });
 
     it('non-governor setting fee should fail', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address,(await wrappedToken.proposalNonce()).add(1));
       const wrapFee = 5;
       const otherSender = signers[1];
       assert
       await TruffleAssert.reverts(
         wrappedToken.connect(otherSender).setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1)),
         'Only governor can call this function'
       );
     });
 
     it('fee percentage cannot be greater than 100', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
       const wrapFee = 101;
       assert
       await TruffleAssert.reverts(
         wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1)),
         'invalid fee percentage'
       );
     });
 
     it('fee percentage cannot be negative', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
       const wrapFee = -1;
       assert
       await TruffleAssert.fails(
         wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1))
       );
     });
 
     it('fee percentage cannot be non-integer', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
       const wrapFee = 2.5;
       assert
       await TruffleAssert.fails(
         wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1))
       );
     });
 
     it('should withdraw and unwrap', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
 
       // create Anchor for wrapped token
       const wrappedAnchor = await Anchor.createAnchor(
         verifier.contract.address,
         hasherInstance.address,
         tokenDenomination,
         levels,
         wrappedToken.address,
         sender.address,
         MAX_EDGES,
         zkComponents,
         sender
       );
 
       const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
       await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);
 
       await token.approve(wrappedToken.address, '1000000000000000000');
       const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
       // create a deposit on the anchor already setup
       const { deposit, index, originChainId } = await wrappedAnchor.wrapAndDeposit(
         token.address,
       );
 
       // Check that the anchor has the appropriate amount of wrapped token balance
       const anchorWrappedTokenBalance = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
       assert.deepStrictEqual(anchorWrappedTokenBalance.toString(), tokenDenomination);
 
       // Check that the anchor's token wrapper has the appropriate amount of token balance
       const tokenWrapper = await wrappedAnchor.contract.token();
       
       const tokenWrapperBalanceOfToken = await token.balanceOf(tokenWrapper);
       assert.deepStrictEqual(tokenWrapperBalanceOfToken.toString(), tokenDenomination);
 
       const newAnchor = await Anchor.connect(wrappedAnchor.contract.address, zkComponents, wallet);
       await TruffleAssert.passes(newAnchor.withdrawAndUnwrap(
         deposit,
         originChainId,
         index,
         sender.address,
         signers[1].address,
         bigInt(0),
         toFixedHex(0),
         token.address
       ));
 
       const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(sender.address);
       assert.strictEqual(balTokenBeforeDepositSender.toString(), balTokenAfterWithdrawAndUnwrapSender.toString());
     });
 
     it('should native deposit appropriate amount after connection', async () => {
       const signers = await ethers.getSigners();
       const wallet = signers[0];
       const sender = wallet;
       // create wrapped token
       const name = 'webbETH';
       const symbol = 'webbETH';
       const dummyFeeRecipient = "0x0000000000000000000000000000001000000000";
       const wrappedTokenFactory = new WrappedTokenFactory(wallet);
       wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
       await wrappedToken.deployed();
       await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
 
       // create Anchor for wrapped token
       const wrappedAnchor = await Anchor.createAnchor(
         verifier.contract.address,
         hasherInstance.address,
         tokenDenomination,
         levels,
         wrappedToken.address,
         sender.address,
         MAX_EDGES,
         zkComponents,
         sender
       );
 
       const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
       await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);
 
       await token.approve(wrappedToken.address, '1000000000000000000');
       const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
 
       const anchorUnderTest = await Anchor.connect(wrappedAnchor.contract.address, zkComponents, wallet);
 
       // create a deposit on the anchor already setup
       const { deposit, index, originChainId } = await anchorUnderTest.wrapAndDeposit(
         token.address,
       );
 
       // Check that the anchor has the appropriate amount of wrapped token balance
       const anchorWrappedTokenBalance = await wrappedToken.balanceOf(anchorUnderTest.contract.address);
       assert.deepStrictEqual(anchorWrappedTokenBalance.toString(), tokenDenomination);
 
       // Check that the anchor's token wrapper has the appropriate amount of token balance
       const tokenWrapper = await anchorUnderTest.contract.token();
       const tokenWrapperBalanceOfToken = await token.balanceOf(tokenWrapper);
       assert.deepStrictEqual(tokenWrapperBalanceOfToken.toString(), tokenDenomination);
 
       await TruffleAssert.passes(anchorUnderTest.withdrawAndUnwrap(
         deposit,
         originChainId,
         index,
         sender.address,
         signers[1].address,
         bigInt(0),
         toFixedHex(0),
         token.address
       ));
 
       const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(sender.address);
       assert.strictEqual(balTokenBeforeDepositSender.toString(), balTokenAfterWithdrawAndUnwrapSender.toString());
     });
   });
 });
 
 // Test deposit and withdraw on the same anchor - but it's 3 roots to pass in.
 describe('Anchor for 2 max edges (3-sided bridge)', () => {
   let anchor: Anchor;
   let zkComponents: ZkComponents;
 
   const levels = 30;
   const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
   let tree: MerkleTree;
   const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`100000000000000000`)).toString());
   const refund = BigInt((new BN('0')).toString());
   let recipient = "0x1111111111111111111111111111111111111111";
   let verifier: Verifier;
   let hasherInstance: any;
   let token: Token;
   let wrappedToken: WrappedToken;
   let tokenDenomination = '1000000000000000000' // 1 ether
   const MAX_EDGES = 2;
   let createWitness: any;
 
   before(async () => {
     zkComponents = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/3/poseidon_anchor_3.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/3/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/3/circuit_final.zkey')
     );
   })
 
   beforeEach(async () => {
     const signers = await ethers.getSigners();
     const wallet = signers[0];
     const sender = wallet;
 
     tree = new MerkleTree(levels);
 
     // create poseidon hasher
     const hasherFactory = new PoseidonT3__factory(wallet);
     hasherInstance = await hasherFactory.deploy();
     await hasherInstance.deployed();
 
     // create poseidon verifier
     verifier = await Verifier.createVerifier(sender);
 
     // create token
     const tokenFactory = new TokenFactory(wallet);
     token = await tokenFactory.deploy();
     await token.deployed();
     await token.mint(sender.address, '10000000000000000000000');
 
     // create Anchor
     anchor = await Anchor.createAnchor(
       verifier.contract.address,
       hasherInstance.address,
       tokenDenomination,
       levels,
       token.address,
       sender.address,
       MAX_EDGES,
       zkComponents,
       sender,
     );
 
     // approve the anchor to spend the minted funds
     await token.approve(anchor.contract.address, '10000000000000000000000');
 
     createWitness = async (data: any) => {
       const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/anchor/3/witness_calculator.js");
       const fileBuf = require('fs').readFileSync('./protocol-solidity-fixtures/fixtures/anchor/3/poseidon_anchor_3.wasm');
       const wtnsCalc = await witnessCalculator(fileBuf)
       const wtns = await wtnsCalc.calculateWTNSBin(data,0);
       return wtns;
     }
   })
 
   it('should withdraw successfully', async () => {
     const signers = await ethers.getSigners();
     const sender = signers[0];
     const relayer = signers[1];
 
     const balanceUserBefore = await token.balanceOf(sender.address);
     const { deposit, index } = await anchor.deposit();
 
     const balanceUserAfterDeposit = await token.balanceOf(sender.address)
     const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
     assert.strictEqual(balanceUserAfterDeposit.toString(), (new BN(toBN(balanceUserBefore).sub(toBN(value)))).toString());
     assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());
 
     const balanceRelayerBefore = await token.balanceOf(relayer.address)
     const balanceReceiverBefore = await token.balanceOf(toFixedHex(recipient, 20))
 
     let isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
     assert.strictEqual(isSpent, false)
 
     let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, toFixedHex(0));
     const filter = anchor.contract.filters.Withdrawal(null, relayer.address, null);
     const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
 
     const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
     const balanceRelayerAfter = await token.balanceOf(relayer.address)
     const balanceReceiverAfter = await token.balanceOf(toFixedHex(recipient, 20))
     const feeBN = toBN(fee.toString())
     assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
     assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
     assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())
 
     assert.strictEqual(events[0].event, 'Withdrawal')
     assert.strictEqual(events[0].args[2].toString(), feeBN.toString());
     isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
     assert(isSpent);
   })
 });
 
 // Test deposit and withdraw on the same anchor - but it's 4 roots to pass in.
 describe('Anchor for 3 max edges (4-sided bridge)', () => {
   let anchor: Anchor;
   let zkComponents: ZkComponents;
 
   const levels = 30;
   const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
   let tree: MerkleTree;
   const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`100000000000000000`)).toString());
   const refund = BigInt((new BN('0')).toString());
   let recipient = "0x1111111111111111111111111111111111111111";
   let verifier: Verifier;
   let hasherInstance: any;
   let token: Token;
   let wrappedToken: WrappedToken;
   let tokenDenomination = '1000000000000000000' // 1 ether
   const MAX_EDGES = 3;
   let createWitness: any;
 
   before(async () => {
     zkComponents = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/4/poseidon_anchor_4.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/4/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/4/circuit_final.zkey'),
     );
   })
 
   beforeEach(async () => {
     const signers = await ethers.getSigners();
     const wallet = signers[0];
     const sender = wallet;
 
     tree = new MerkleTree(levels);
 
     // create poseidon hasher
     const hasherFactory = new PoseidonT3__factory(wallet);
     hasherInstance = await hasherFactory.deploy();
     await hasherInstance.deployed();
 
     // create poseidon verifier
     verifier = await Verifier.createVerifier(sender);
 
     // create token
     const tokenFactory = new TokenFactory(wallet);
     token = await tokenFactory.deploy();
     await token.deployed();
     await token.mint(sender.address, '10000000000000000000000');
 
     // create Anchor
     anchor = await Anchor.createAnchor(
       verifier.contract.address,
       hasherInstance.address,
       tokenDenomination,
       levels,
       token.address,
       sender.address,
       MAX_EDGES,
       zkComponents,
       sender,
     );
 
     // approve the anchor to spend the minted funds
     await token.approve(anchor.contract.address, '10000000000000000000000');
 
     createWitness = async (data: any) => {
       const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/anchor/4/witness_calculator.js");
       const fileBuf = require('fs').readFileSync('./protocol-solidity-fixtures/fixtures/anchor/4/poseidon_anchor_4.wasm');
       const wtnsCalc = await witnessCalculator(fileBuf)
       const wtns = await wtnsCalc.calculateWTNSBin(data,0);
       return wtns;
     }
   })
 
   it('should withdraw successfully', async () => {
     const signers = await ethers.getSigners();
     const sender = signers[0];
     const relayer = signers[1];
 
     const balanceUserBefore = await token.balanceOf(sender.address);
     const { deposit, index } = await anchor.deposit();
 
     const balanceUserAfterDeposit = await token.balanceOf(sender.address)
     const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
     assert.strictEqual(balanceUserAfterDeposit.toString(), (new BN(toBN(balanceUserBefore).sub(toBN(value)))).toString());
     assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());
 
     const balanceRelayerBefore = await token.balanceOf(relayer.address)
     const balanceReceiverBefore = await token.balanceOf(toFixedHex(recipient, 20))
 
     let isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
     assert.strictEqual(isSpent, false)
 
     let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, toFixedHex(0));
     const filter = anchor.contract.filters.Withdrawal(null, relayer.address, null);
     const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
 
     const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
     const balanceRelayerAfter = await token.balanceOf(relayer.address)
     const balanceReceiverAfter = await token.balanceOf(toFixedHex(recipient, 20))
     const feeBN = toBN(fee.toString())
     assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
     assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
     assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())
 
     assert.strictEqual(events[0].event, 'Withdrawal')
     assert.strictEqual(events[0].args[2].toString(), feeBN.toString());
     isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
     assert(isSpent);
   })
 });
 
 // Test deposit and withdraw on the same anchor - but it's 4 roots to pass in.
 describe('Anchor for 4 max edges (5-sided bridge)', () => {
   let anchor: Anchor;
   let zkComponents: ZkComponents;
 
   const levels = 30;
   const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
   let tree: MerkleTree;
   const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
   const refund = BigInt((new BN('0')).toString());
   let recipient = "0x1111111111111111111111111111111111111111";
   let verifier: Verifier;
   let hasherInstance: any;
   let token: Token;
   let wrappedToken: WrappedToken;
   let tokenDenomination = '1000000000000000000' // 1 ether
   const MAX_EDGES = 4;
   let createWitness: any;
 
   before(async () => {
     zkComponents = await fetchComponentsFromFilePaths(
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/5/poseidon_anchor_5.wasm'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/5/witness_calculator.js'),
       path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/anchor/5/circuit_final.zkey'),
     );
   })
 
   beforeEach(async () => {
     const signers = await ethers.getSigners();
     const wallet = signers[0];
     const sender = wallet;
 
     tree = new MerkleTree(levels);
 
     // create poseidon hasher
     const hasherFactory = new PoseidonT3__factory(wallet);
     hasherInstance = await hasherFactory.deploy();
     await hasherInstance.deployed();
 
     // create poseidon verifier
     verifier = await Verifier.createVerifier(sender);
 
     // create token
     const tokenFactory = new TokenFactory(wallet);
     token = await tokenFactory.deploy();
     await token.deployed();
     await token.mint(sender.address, '10000000000000000000000');
 
     // create Anchor
     anchor = await Anchor.createAnchor(
       verifier.contract.address,
       hasherInstance.address,
       tokenDenomination,
       levels,
       token.address,
       sender.address,
       MAX_EDGES,
       zkComponents,
       sender,
     );
 
     // approve the anchor to spend the minted funds
     await token.approve(anchor.contract.address, '10000000000000000000000');
 
     createWitness = async (data: any) => {
       const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/anchor/5/witness_calculator.js");
       const fileBuf = require('fs').readFileSync('./protocol-solidity-fixtures/fixtures/anchor/5/poseidon_anchor_5.wasm');
       const wtnsCalc = await witnessCalculator(fileBuf)
       const wtns = await wtnsCalc.calculateWTNSBin(data,0);
       return wtns;
     }
   })
 
   it('should withdraw successfully', async () => {
     const signers = await ethers.getSigners();
     const sender = signers[0];
     const relayer = signers[1];
 
     const balanceUserBefore = await token.balanceOf(sender.address);
     const { deposit, index } = await anchor.deposit();
 
     const balanceUserAfterDeposit = await token.balanceOf(sender.address)
     const balanceAnchorAfterDeposit = await token.balanceOf(anchor.contract.address);
     assert.strictEqual(balanceUserAfterDeposit.toString(), (new BN(toBN(balanceUserBefore).sub(toBN(value)))).toString());
     assert.strictEqual(balanceAnchorAfterDeposit.toString(), toBN(value).toString());
 
     const balanceRelayerBefore = await token.balanceOf(relayer.address)
     const balanceReceiverBefore = await token.balanceOf(toFixedHex(recipient, 20))
 
     let isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
     assert.strictEqual(isSpent, false)
 
     let receipt = await anchor.withdraw(deposit, index, recipient, relayer.address, fee, toFixedHex(0));
     const filter = anchor.contract.filters.Withdrawal(null, relayer.address, null);
     const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
 
     const balanceAnchorAfter = await token.balanceOf(anchor.contract.address)
     const balanceRelayerAfter = await token.balanceOf(relayer.address)
     const balanceReceiverAfter = await token.balanceOf(toFixedHex(recipient, 20))
     const feeBN = toBN(fee.toString())
     assert.strictEqual(balanceAnchorAfter.toString(), toBN(balanceAnchorAfterDeposit).sub(toBN(value)).toString())
     assert.strictEqual(balanceReceiverAfter.toString(), toBN(balanceReceiverBefore).add(toBN(value)).sub(feeBN).toString())
     assert.strictEqual(balanceRelayerAfter.toString(), toBN(balanceRelayerBefore).add(feeBN).toString())
 
     assert.strictEqual(events[0].event, 'Withdrawal')
     assert.strictEqual(events[0].args[2].toString(), feeBN.toString());
     isSpent = await anchor.contract.isSpent(toFixedHex(deposit.nullifierHash))
     assert(isSpent);
   })
 });
