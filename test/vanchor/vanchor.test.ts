/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
*/
const assert = require('assert');
import { ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');
import { hexToU8a, u8aToHex } from '@polkadot/util';

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  GovernedTokenWrapper as WrappedToken,
  GovernedTokenWrapper__factory as WrappedTokenFactory,
  PoseidonT3__factory
} from '../../packages/contracts';

// These contracts are not included in the package, so can use generated typechain
import {
  ERC20Mock as Token,
  ERC20Mock__factory as TokenFactory,
} from '../../typechain';

// Convenience wrapper classes for contract classes
import { fetchComponentsFromFilePaths, getChainIdType, ZkComponents } from '../../packages/utils/src';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { Utxo, Keypair, MerkleTree, randomBN, toFixedHex, generateVariableWitnessInput, getVAnchorExtDataHash, generateWithdrawProofCallData, CircomUtxo } from '@webb-tools/sdk-core';
import { VAnchor } from '../../packages/anchors/src';
import { Verifier } from "../../packages/vbridge"
import { writeFileSync } from "fs";

const BN = require('bn.js');

const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs')
const { toBN } = require('web3-utils');

const updateUtxoWithIndex = async (inputUtxo: Utxo, index: number, originChain: number): Promise<Utxo> => {
  const utxoString = inputUtxo.serialize();
  const parts = utxoString.split('&');
  parts[4] = index.toString();
  const outputUtxo = await CircomUtxo.deserialize(parts.join('&'));
  outputUtxo.setOriginChainId(originChain.toString());

  return outputUtxo;
}

describe('VAnchor for 2 max edges', () => {
  let anchor: VAnchor;

  const levels = 5;
  let fee = BigInt((new BN(`100000000000000000`)).toString());
  let recipient = "0x1111111111111111111111111111111111111111";
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = getChainIdType(31337);
  const MAX_EDGES = 1;
  let create2InputWitness: any;
  let sender: SignerWithAddress;
  // setup zero knowledge components
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;

  const generateUTXOForTest = async (chainId: number, amount?: number) => {
    const randomKeypair = new Keypair();
    const amountString = amount ? amount.toString() : '0';

    return CircomUtxo.generateUtxo({
      curve: 'Bn254',
      backend: 'Circom',
      chainId: chainId.toString(),
      originChainId: chainId.toString(),
      amount: amountString,
      blinding: hexToU8a(randomBN(31).toHexString()),
      privateKey: hexToU8a(randomKeypair.privkey),
      keypair: randomKeypair,
    });
  }

  before('instantiate zkcomponents', async () => {
    zkComponents2_2 = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey')
    );

    zkComponents16_2 = await fetchComponentsFromFilePaths(
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js'),
      path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/vanchor_16/2/circuit_final.zkey')
    );
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    // create poseidon hasher
    const hasherFactory = new PoseidonT3__factory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();
      
    // create bridge verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new TokenFactory(wallet);
    token = await tokenFactory.deploy();
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create Anchor
    anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      levels,
      hasherInstance.address,
      sender.address,
      token.address,
      1,
      zkComponents2_2,
      zkComponents16_2,
      sender,
    );

    await anchor.contract.configureMinimalWithdrawalLimit(
      BigNumber.from(0),
    );
    await anchor.contract.configureMaximumDepositLimit(
      BigNumber.from(tokenDenomination).mul(1_000_000),
    );

    await token.approve(anchor.contract.address, '1000000000000000000000000');

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync('protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm');
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }
  })

  describe('#constructor', () => {
    it('should initialize', async () => {
      const maxEdges = await anchor.contract.maxEdges();
      assert.strictEqual(maxEdges.toString(), `${MAX_EDGES}`);
    });
  });

  describe('snark proof native verification on js side', () => {
    it('should work', async () => {
      const relayer = "0x2111111111111111111111111111111111111111";
      const extAmount = 1e7;
      const aliceDepositAmount = 1e7;
      const roots = await anchor.populateRootsForProof();
      const inputs = [
        await generateUTXOForTest(chainID),
        await generateUTXOForTest(chainID),
      ];
      const outputs = [
        await generateUTXOForTest(chainID, aliceDepositAmount),
        await generateUTXOForTest(chainID),
      ];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const extDataHash = await getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        recipient,
        relayer
      )

      const input = await generateVariableWitnessInput(
        roots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        extAmount,
        fee,
        extDataHash,
        merkleProofsForInputs
      );

      const wtns = await create2InputWitness(input);
      let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);
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
        anchor.contract.setHandler(signers[1].address, 1049),
        'Nonce must not increment more than 1048'
      )
    });

    it('should revert (setting verifier) with improper nonce', async() => {
      const signers = await ethers.getSigners();
      await TruffleAssert.reverts(
        anchor.contract.setVerifier(signers[1].address, 0),
        'Invalid nonce'
      )
      await TruffleAssert.reverts(
        anchor.contract.setVerifier(signers[1].address, 1049),
        'Nonce must not increment more than 1048'
      )
    });
  })

  describe('#transact', () => {
    it('should transact', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );
    })

    it('should process fee on deposit', async () => {
      const signers = await ethers.getSigners();
      const alice= signers[0];

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
      //Step 1: Alice deposits into Tornado Pool
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const relayer = "0x2111111111111111111111111111111111111111";
      const fee = 1e6;
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [await generateUTXOForTest(chainID), await generateUTXOForTest(chainID)],
        [aliceDepositUtxo, await generateUTXOForTest(chainID)],
        BigNumber.from(fee),
        '0',
        relayer,
        {}
      );

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(aliceBalanceAfterDeposit.toString(), BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount)).sub(toBN(fee))).toString());

      //Step 3 Check relayers balance
      assert.strictEqual((await token.balanceOf(relayer)).toString(), BigNumber.from(fee).toString());
    })
    
    it('should spend input utxo and create output utxo', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );
     
      const aliceTransferUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: BigNumber.from(chainID).toString(),
        originChainId: BigNumber.from(chainID).toString(),
        amount: BigNumber.from(aliceDepositAmount).toString(),
        blinding: hexToU8a(randomBN().toHexString()),
        privateKey: hexToU8a(aliceDepositUtxo.keypair.privkey),
        keypair: aliceDepositUtxo.keypair
      });

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceTransferUtxo],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );
    })

    it('should spend input utxo and split', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 10;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );

      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceSplitAmount = 5;
      const aliceSplitUtxo1 = await generateUTXOForTest(chainID, aliceSplitAmount);
      const aliceSplitUtxo2 = await generateUTXOForTest(chainID, aliceSplitAmount);

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceSplitUtxo1, aliceSplitUtxo2],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );
    })

    it('should join and spend', async () => {
      const aliceDepositAmount1 = 1e7;
      let aliceDepositUtxo1 = await generateUTXOForTest(chainID, aliceDepositAmount1);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo1.keypair.address(),
        [],
        [aliceDepositUtxo1],
        0,
        '0',
        '0',
        {}
      );
      
      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceDepositAmount2 = 1e7;
      let aliceDepositUtxo2 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceDepositAmount2).toString(),
        keypair: aliceDepositUtxo1.keypair,
        blinding: hexToU8a(randomBN().toHexString())
      });

      await anchor.transact(
        [],
        [aliceDepositUtxo2],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );

      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      
      const aliceJoinAmount = 2e7;
      const aliceJoinUtxo = await generateUTXOForTest(chainID, aliceJoinAmount);

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDeposit1Index = anchor.tree.getIndexByElement(aliceDepositUtxo1.commitment);
      const aliceDeposit2Index = anchor.tree.getIndexByElement(aliceDepositUtxo2.commitment);
      aliceDepositUtxo1 = await updateUtxoWithIndex(aliceDepositUtxo1, aliceDeposit1Index, chainID);
      aliceDepositUtxo2 = await updateUtxoWithIndex(aliceDepositUtxo2, aliceDeposit2Index, chainID);

      await anchor.transact(
        [aliceDepositUtxo1, aliceDepositUtxo2],
        [aliceJoinUtxo],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );
    })

    it('should join and spend with 16 inputs', async () => {
      const aliceDepositAmount1 = 1e7;
      let aliceDepositUtxo1 = await generateUTXOForTest(chainID, aliceDepositAmount1);
      const aliceDepositAmount2 = 1e7;
      let aliceDepositUtxo2 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount2.toString(),
        keypair: aliceDepositUtxo1.keypair,
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo1.keypair.address(),
        [],
        [aliceDepositUtxo1, aliceDepositUtxo2],
        0,
        '0',
        '0',
        { }
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceDepositAmount3 = 1e7;
      let aliceDepositUtxo3 = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceDepositAmount3).toString(),
        keypair: aliceDepositUtxo1.keypair,
      });

      await anchor.transact(
        [],
        [aliceDepositUtxo3],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );

      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      
      const aliceJoinAmount = 3e7;
      const aliceJoinUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: BigNumber.from(aliceJoinAmount).toString(),
        keypair: aliceDepositUtxo1.keypair,
      });

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDeposit1Index = anchor.tree.getIndexByElement(aliceDepositUtxo1.commitment);
      const aliceDeposit2Index = anchor.tree.getIndexByElement(aliceDepositUtxo2.commitment);
      const aliceDeposit3Index = anchor.tree.getIndexByElement(aliceDepositUtxo3.commitment);
      aliceDepositUtxo1 = await updateUtxoWithIndex(aliceDepositUtxo1, aliceDeposit1Index, chainID);
      aliceDepositUtxo2 = await updateUtxoWithIndex(aliceDepositUtxo2, aliceDeposit2Index, chainID);
      aliceDepositUtxo3 = await updateUtxoWithIndex(aliceDepositUtxo3, aliceDeposit3Index, chainID);

      await anchor.transact(
        [aliceDepositUtxo1, aliceDepositUtxo2, aliceDepositUtxo3],
        [aliceJoinUtxo],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );
    }).timeout(40000);

    it('should withdraw', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      const aliceWithdrawAmount = 5e6;
      const aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceWithdrawAmount.toString(),
        keypair: aliceDepositUtxo.keypair
      });
      const aliceETHAddress = '0xDeaD00000000000000000000000000000000BEEf';
    
      await anchor.transact(
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        aliceETHAddress,
        '0'
      )
      assert.strictEqual(aliceWithdrawAmount.toString(), await (await token.balanceOf(aliceETHAddress)).toString());
    }).timeout(40000);

    it('should prevent double spend', async () => {
      const aliceDepositAmount = 1e7;
      let aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString()
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = anchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo = await updateUtxoWithIndex(aliceDepositUtxo, aliceDepositIndex, chainID);

      const aliceTransferUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair: aliceDepositUtxo.keypair
      });

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceTransferUtxo],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        '0',
        '0',
      );

      anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      
      await TruffleAssert.reverts(
        anchor.transact(
          [aliceDepositUtxo],
          [aliceTransferUtxo],
          {
            [chainID.toString()]: anchorLeaves
          },
          0,
          '0',
          '0',
        ),
        'Input is already spent'
      )
    });

    it('should prevent increasing UTXO amount without depositing', async () => {
      const signers = await ethers.getSigners();
      const alice= signers[0];

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
      });
      //Step 1: Alice deposits into Tornado Pool
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      await anchor.registerAndTransact(
        alice.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(aliceBalanceAfterDeposit.toString(), BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))).toString())
      
      //Step 3: Alice tries to create a UTXO with more funds than she has in her account
      const aliceOutputAmount = '100000000000000000000000';
      const aliceOutputUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceOutputAmount,
        keypair: aliceDepositUtxo.keypair
      });
      //Step 4: Check that step 3 fails
      await TruffleAssert.reverts(
        anchor.transact(
          [aliceDepositUtxo],
          [aliceOutputUtxo],
          {
            [chainID.toString()]: anchorLeaves
          },
          0,
          '0',
          '0',
        ),
        'ERC20: transfer amount exceeds balance'
      )
    });

    it('should reject tampering with public inputs', async () => {
      const relayer = "0x2111111111111111111111111111111111111111";
      const extAmount = 1e7;
      const aliceDepositAmount = 1e7;
      const roots = await anchor.populateRootsForProof();
      const inputs = [await generateUTXOForTest(chainID), await generateUTXOForTest(chainID)];
      const outputs = [await generateUTXOForTest(chainID, aliceDepositAmount), await generateUTXOForTest(chainID)];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const extDataHash = await getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        recipient,
        relayer
      )
      
      const input = await generateVariableWitnessInput(
        roots.map((root) => BigNumber.from(root)),
        chainID,
        inputs, 
        outputs,
        extAmount,
        fee,
        extDataHash,
        merkleProofsForInputs
      );
     
      const wtns = await create2InputWitness(input);
      let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const proofEncoded = await generateWithdrawProofCallData(proof, publicSignals);

      //correct public inputs
      let publicInputArgs:[string, string, string[], [any, any], string, string] = [
        `0x${proofEncoded}`,
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash)
      ];

      let extDataArgs = [
        toFixedHex(recipient, 20),
        toFixedHex(extAmount),  
        toFixedHex(relayer, 20),
        toFixedHex(fee),
        encOutput1,
        encOutput2
      ];

      // public amount
      let incorrectPublicInputArgs:[string, string, string[], [any, any], string, string] = [
        `0x${proofEncoded}`,
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(BigNumber.from(input.publicAmount).add(1)),
        toFixedHex(input.extDataHash)
      ];

      let incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);
      let extAmountInputs = VAnchor.convertToExtDataStruct(extDataArgs)

      //anchor.contract.transact(incorrectPublicInputs, extAmountInputs, { gasPrice: '100' });
      
      await TruffleAssert.reverts(
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs),
        'Invalid public amount',
      );

      // extdatahash
      incorrectPublicInputArgs = [
        `0x${proofEncoded}`,
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(BigNumber.from(input.extDataHash).add(1))
      ];

      incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs),
        'Incorrect external data hash',
      );

      // output commitment
      incorrectPublicInputArgs = [
        `0x${proofEncoded}`,
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(x)),
        [toFixedHex(BigNumber.from(input.outputCommitment[0]).add(1)), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash)
      ];

      incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs),
        'Invalid withdraw proof',
      );

      // input nullifier
      incorrectPublicInputArgs = [
        `0x${proofEncoded}`,
        VAnchor.createRootsBytes(input.roots.map((x) => x.toString())),
        input.inputNullifier.map((x) => toFixedHex(BigNumber.from(x).add(1))),
        [toFixedHex(input.outputCommitment[0]), toFixedHex(input.outputCommitment[1])],
        toFixedHex(input.publicAmount),
        toFixedHex(input.extDataHash)
      ];

      incorrectPublicInputs = VAnchor.convertToPublicInputsStruct(incorrectPublicInputArgs);

      await TruffleAssert.reverts(
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs),
        'Invalid withdraw proof',
      );

      //relayer
      let incorrectExtDataArgs = [
        toFixedHex(recipient, 20),
        toFixedHex(extAmount),  
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(fee),
        encOutput1,
        encOutput2
      ];

      let correctPublicInputs = VAnchor.convertToPublicInputsStruct(publicInputArgs);
      let incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs)

      await TruffleAssert.reverts(
        anchor.contract.transact(correctPublicInputs, incorrectExtAmountInputs),
        'Incorrect external data hash',
      );

      //recipient
      incorrectExtDataArgs = [
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(extAmount),  
        toFixedHex(relayer, 20),
        toFixedHex(fee),
        encOutput1,
        encOutput2
      ];

      incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs)

      await TruffleAssert.reverts(
        anchor.contract.transact(correctPublicInputs, incorrectExtAmountInputs),
        'Incorrect external data hash',
      );

      //fee
      incorrectExtDataArgs = [
        toFixedHex(recipient, 20),
        toFixedHex(extAmount),  
        toFixedHex(relayer, 20),
        toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        encOutput1,
        encOutput2
      ];

      incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs)

      await TruffleAssert.reverts(
        anchor.contract.transact(correctPublicInputs, incorrectExtAmountInputs),
        'Incorrect external data hash',
      );
    });

    it('should be compliant', async function () {
      // basically verifier should check if a commitment and a nullifier hash are on chain
      const [sender] = await ethers.getSigners();

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
  
      await anchor.transact(
        [], 
        [aliceDepositUtxo],
        {},
        0,
        '0',
        '0',
      );
  
      const anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      // withdrawal
      await anchor.transact(
        [aliceDepositUtxo],
        [],
        {
          [chainID.toString()]: anchorLeaves
        },
        0,
        sender.address,
        '0'
      );

      //build merkle tree start
      const filter = anchor.contract.filters.NewCommitment()
      const events = await anchor.contract.queryFilter(filter, 0)
    
      const leaves = events.sort((a:any, b:any) => a.args.index - b.args.index).map((e) => toFixedHex(e.args.commitment))
      const tree = new MerkleTree(levels, leaves)

      //build merkle tree end
      const commitment = aliceDepositUtxo.commitment
      const index = tree.indexOf(toFixedHex(commitment)) // it's the same as merklePath and merklePathIndexes and index in the tree

      // Cant set index on create JsUtxo - regenerate the CircomUtxo.
      const aliceDepositUtxoRegen = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositUtxo.amount,
        index: index.toString(),
        blinding: hexToU8a(aliceDepositUtxo.blinding),
        privateKey: hexToU8a(aliceDepositUtxo.secret_key),
        keypair: aliceDepositUtxo.getKeypair()
      })
      const nullifier = aliceDepositUtxoRegen.nullifier
  
      // commitment = hash(amount, pubKey, blinding)
      // nullifier = hash(commitment, merklePath, sign(merklePath, privKey))
      const dataForVerifier = {
        commitment: {
          chainId: chainID.toString(),
          amount: aliceDepositUtxoRegen.amount,
          pubkey: aliceDepositUtxoRegen.keypair.pubkey,
          blinding: aliceDepositUtxoRegen.blinding,
        },
        nullifier: {
          commitment,
          merklePath: index,
          signature: aliceDepositUtxoRegen.keypair.sign(BigNumber.from(commitment).toString(), index),
        },
      }
  
      // generateReport(dataForVerifier) -> compliance report
      // on the verifier side we compute commitment and nullifier and then check them onchain
      const commitmentV = BigNumber.from(poseidon([...Object.values(dataForVerifier.commitment)]));
      const nullifierV = BigNumber.from(poseidon([
        commitmentV,
        dataForVerifier.nullifier.merklePath,
        dataForVerifier.nullifier.signature,
      ]))
  
      assert.strictEqual(commitmentV.toString(), BigNumber.from(commitment).toString());
      assert.strictEqual(nullifierV.toString(), nullifier.toString());
      assert.strictEqual(await anchor.contract.nullifierHashes(toFixedHex(nullifierV)), true);
      // expect commitmentV present onchain (it will be in NewCommitment events)
  
      // in report we can see the tx with NewCommitment event (this is how alice got money)
      // and the tx with NewNullifier event is where alice spent the UTXO
    })
  })
  describe('#wrapping tests', () => {
    it('should wrap and deposit', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        5,
        hasherInstance.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedAnchor.contract.configureMinimalWithdrawalLimit(
        BigNumber.from(0),
      );
      await wrappedAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedAnchor.contract.address);

      await token.approve(wrappedToken.address, '1000000000000000000');
      const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
    
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair: new Keypair(),
        index: null,
      });
      //create a deposit on the anchor already setup
      await wrappedAnchor.transactWrap(
        token.address,
        [],
        [aliceDepositUtxo],
        '0',
        '0',
        '0',
        {}
      );
      const balTokenAfterDepositSender = await token.balanceOf(sender.address);
      assert.strictEqual(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString(), '10000000');

      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedAnchor.contract.address);
      const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(sender.address);
      assert.strictEqual(balWrappedTokenAfterDepositAnchor.toString(), '10000000');
      assert.strictEqual(balWrappedTokenAfterDepositSender.toString(), '0');
    });

    it('should withdraw and unwrap', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedVAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        5,
        hasherInstance.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedVAnchor.contract.configureMinimalWithdrawalLimit(
        BigNumber.from(0),
      );
      await wrappedVAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
      );
      
      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedVAnchor.contract.address);
      await token.approve(wrappedToken.address, '1000000000000000000');
      //Check that vAnchor has the right amount of wrapped token balance
      assert.strictEqual((await wrappedToken.balanceOf(wrappedVAnchor.contract.address)).toString(), BigNumber.from(0).toString());
      const balTokenBeforeDepositSender = await token.balanceOf(sender.address);
      const aliceDepositAmount = 1e7;
      const keypair = new Keypair();
      let aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair
      });
      //create a deposit on the anchor already setup
      await wrappedVAnchor.transactWrap(
        token.address,
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );

      let anchorLeaves = wrappedVAnchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = wrappedVAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo = await updateUtxoWithIndex(aliceDepositUtxo, aliceDepositIndex, chainID);

      //Check that vAnchor has the right amount of wrapped token balance
      assert.strictEqual((await wrappedToken.balanceOf(wrappedVAnchor.contract.address)).toString(), BigNumber.from(1e7).toString());

      const aliceChangeAmount = 0;
      const aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceChangeAmount.toString(),
      });

      await wrappedVAnchor.transactWrap(
        token.address,
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        0,
        sender.address,
        '0',
        {
          [chainID.toString()]: anchorLeaves
        }
      );

      const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(sender.address);
      assert.strictEqual(balTokenBeforeDepositSender.toString(), balTokenAfterWithdrawAndUnwrapSender.toString());
    });

    it('wrapping fee should work correctly with transactWrap', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = "0x0000000000000000010000000000000000000000";
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const wrapFee = 5;
      await wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1));

      // create Anchor for wrapped token
      const wrappedVAnchor = await VAnchor.createVAnchor(
        verifier.contract.address,
        5,
        hasherInstance.address,
        sender.address,
        wrappedToken.address,
        1,
        zkComponents2_2,
        zkComponents16_2,
        sender
      );

      await wrappedVAnchor.contract.configureMinimalWithdrawalLimit(
        BigNumber.from(0),
      );
      await wrappedVAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedVAnchor.contract.address);

      await token.approve(wrappedToken.address, '10000000000000000000');
      
      //Should take a fee when depositing
      //Deposit 2e7 and Check Relevant Balances
      const aliceDepositAmount = 2e7;
      let aliceDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
      });

      const balWrappedTokenBeforeDepositAnchor = await wrappedToken.balanceOf(wrappedVAnchor.contract.address);
      const balUnwrappedTokenBeforeDepositSender = await token.balanceOf(sender.address);
      const balUnwrappedTokenBeforeDepositWrapper = await token.balanceOf(wrappedToken.address);

      await wrappedVAnchor.transactWrap(
        token.address,
        [],
        [aliceDepositUtxo],
        0,
        '0',
        '0',
        {}
      );

      // Limitations on UTXO index readonly value. create a new UTXO with the proper index.
      const aliceDepositIndex = wrappedVAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
      aliceDepositUtxo = await updateUtxoWithIndex(aliceDepositUtxo, aliceDepositIndex, chainID);

      // Balance of VAnchor wrapped token should be 2e7
      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedVAnchor.contract.address);
      assert.strictEqual(balWrappedTokenAfterDepositAnchor.toString(), BigNumber.from(2e7).toString());

      // Balance of sender unwrapped token should have gone down by 2e7 * (100) / (100 - wrapFee);
      const expectedSenderTokenOutflows = Math.trunc(2e7 * 100 / (100 - wrapFee));
      const balUnwrappedTokenAfterDepositSender = await token.balanceOf(sender.address);
      assert.strictEqual(balUnwrappedTokenBeforeDepositSender.sub(balUnwrappedTokenAfterDepositSender).toString(), expectedSenderTokenOutflows.toString());

      // Balance of TokenWrapper unwrapped should have gone up by 2e7
      const balUnwrappedTokenAfterDepositWrapper = await token.balanceOf(wrappedToken.address);
      assert.strictEqual(balUnwrappedTokenAfterDepositWrapper.sub(balUnwrappedTokenBeforeDepositWrapper).toString(), BigNumber.from(2e7).toString());

      // Withdraw 1e7 and check relevant balances
      const aliceWithdrawAmount = 1e7;
      let anchorLeaves = wrappedVAnchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      let aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceWithdrawAmount.toString(),
        keypair: aliceDepositUtxo.keypair
      });

      await wrappedVAnchor.transactWrap(
        token.address,
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        0,
        sender.address,
        '0',
        {
          [chainID.toString()]: anchorLeaves
        }
      );

      anchorLeaves = wrappedVAnchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));
      const aliceChangeIndex = wrappedVAnchor.tree.getIndexByElement(aliceChangeUtxo.commitment);
      aliceChangeUtxo = await updateUtxoWithIndex(aliceChangeUtxo, aliceChangeIndex, chainID);

      const balUnwrappedTokenAfterWithdrawSender = await token.balanceOf(sender.address);
      assert.strictEqual(balUnwrappedTokenAfterWithdrawSender.sub(balUnwrappedTokenAfterDepositSender).toString(), BigNumber.from(1e7).toString());

      const balWrappedTokenAfterWithdrawAnchor = await wrappedToken.balanceOf(wrappedVAnchor.contract.address);
      assert.strictEqual(balWrappedTokenAfterDepositAnchor.sub(balWrappedTokenAfterWithdrawAnchor).toString(), BigNumber.from(1e7).toString())

      const balUnwrappedTokenAfterWithdrawWrapper = await token.balanceOf(wrappedToken.address);
      assert.strictEqual(balUnwrappedTokenAfterDepositWrapper.sub(balUnwrappedTokenAfterWithdrawWrapper).toString(), BigNumber.from(1e7).toString());

      await TruffleAssert.passes(wrappedVAnchor.transactWrap(
        token.address,
        [aliceChangeUtxo],
        [],
        0,
        sender.address,
        '0',
        {
          [chainID.toString()]: anchorLeaves
        }
      ));

      let originalTokenDifference = expectedSenderTokenOutflows - 2e7;

      assert.strictEqual(
        (await token.balanceOf(sender.address)).toString(),
        balUnwrappedTokenBeforeDepositSender.sub(originalTokenDifference).toString()
      );
    });

    it('non-governor setting fee should fail', async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      const sender = wallet;
      // create wrapped token
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
      const wrappedTokenFactory = new WrappedTokenFactory(wallet);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, sender.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
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
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
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
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
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
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
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
    it.skip('should print/save benchmarks', async () => {
      // Alice deposits into tornado pool
      const gasBenchmark = await anchor.getGasBenchmark()
      const proofTimeBenchmark = await anchor.getProofTimeBenchmark()
      console.log("Gas benchmark:\n", gasBenchmark);
      console.log("Proof time benchmark:\n", proofTimeBenchmark);
      writeFileSync("./metrics/gas-metrics.json", JSON.stringify(gasBenchmark));
      writeFileSync("./metrics/proof-time-metrics.json", JSON.stringify(proofTimeBenchmark));
    })
  }) 
});

