/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
*/
const assert = require('assert');
import { artifacts, ethers } from 'hardhat';
const TruffleAssert = require('truffle-assertions');

// Typechain generated bindings for contracts
import {
  ERC20Mock as Token,
  ERC20Mock__factory as TokenFactory,
  ERC20PresetMinterPauser__factory as MintableTokenFactory,
  GTokenWrapperMock as WrappedToken,
  GTokenWrapperMock__factory,
  GTokenWrapperMock__factory as WrappedTokenFactory
} from '../../typechain';

// Convenience wrapper classes for contract classes
import VAnchor from '../../lib/vbridge/VAnchor';
import { getHasherFactory, toFixedHex } from '../../lib/bridge/utils';
import Verifier from '../../lib/vbridge/Verifier';
import { Utxo } from '../../lib/vbridge/utxo';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { NATIVE_AMOUNT } = process.env
const BN = require('bn.js');

const MerkleTree = require('../../lib/vbridge/MerkleTree');

const snarkjs = require('snarkjs')
const { toBN } = require('web3-utils');

describe('VAnchor for 2 max edges', () => {
  let anchor: VAnchor;

  const levels = 5;
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  let fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
  const refund = BigInt((new BN('0')).toString()); 
  let recipient = "0x1111111111111111111111111111111111111111";
  let verifier: Verifier;
  let hasherInstance: any;
  let token: Token;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000' // 1 ether
  const chainID = 31337;
  const MAX_EDGES = 1;
  let create2InputWitness: any;
  let create16InputWitness: any;
  let createInputWitnessPoseidon4: any;
  let sender: SignerWithAddress;

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    
    sender = wallet;

    tree = new MerkleTree(levels);
    // create poseidon hasher
    const hasherFactory = await getHasherFactory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create bridge verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new GTokenWrapperMock__factory(wallet);
    token = await tokenFactory.deploy(
      "Webb Wrapped Token",
      "webbTKN",
      sender.address,
      BigNumber.from(tokenDenomination).mul(100)
    );
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');
    
    // create Anchor
    anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      levels,
      hasherInstance.address,
      token.address,
      {
        bridge: sender.address,
        admin: sender.address,
        handler: sender.address,
      },
      1,
      sender,
    );

    await anchor.contract.configureLimits(
      BigNumber.from(0),
      BigNumber.from(tokenDenomination).mul(1_000_000),
    )

    await token.approve(anchor.contract.address, '10000000000000000000000');

    createInputWitnessPoseidon4 = async (data: any) => {
      const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/poseidon4/4/witness_calculator.js");
      const fileBuf = require('fs').readFileSync('protocol-solidity-fixtures/fixtures/poseidon4/4/poseidon4_test.wasm');
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync('protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm');
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }

    create16InputWitness = async (data: any) => {
      const witnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync("protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm");
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
      const isL1Withdrawal = false;
      const roots = await anchor.populateRootInfosForProof();
      const inputs = [new Utxo({chainId: BigNumber.from(chainID)}), new Utxo({chainId: BigNumber.from(chainID)})];
      const aliceDepositAmount = 1e7;
      const outputs = [new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      }), new Utxo({chainId: BigNumber.from(chainID)})];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);
      

      const { input, extData } = await anchor.generateWitnessInput(
        roots,
        chainID,
        inputs, 
        outputs,
        extAmount,
        fee,
        recipient,
        relayer,
        merkleProofsForInputs
      );
     
      const wtns = await create2InputWitness(input);
      let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      //console.log(publicSignals);
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey');

      res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      assert.strictEqual(res, true);

    });

    it('poseidon4 isolated gadget test', async () => {
      const relayer = "0x2111111111111111111111111111111111111111";
      const extAmount = 1e7;
      const isL1Withdrawal = false;
      const roots = await anchor.populateRootInfosForProof();
      const inputs = [new Utxo({chainId: BigNumber.from(chainID)}), new Utxo({chainId: BigNumber.from(chainID)})];
      const aliceDepositAmount = 1e7;
      const outputs = [new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      }), new Utxo({chainId: BigNumber.from(chainID)})];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);
      

      // const input = await anchor.generateWitnessInputPoseidon4(
     
      // );
      const output = new Utxo({chainId: BigNumber.from(31337), amount: BigNumber.from(0), 
        blinding: BigNumber.from(13)})
      const input = {
        // data for 2 transaction outputs
      outChainID: 31337,
      outAmount: 0,
      outPubkey: output.keypair.pubkey,
      outBlinding: toFixedHex(13),
      outputCommitment: output.getCommitment()
      }

      const wtns = await createInputWitnessPoseidon4(input);
    });
  })

  describe('#transact', () => {
    it('should transact', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo]
      );
    })
    
    it('should spend input utxo and create output utxo', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo]
      );
     
      const aliceTransferUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount),
        keypair: aliceDepositUtxo.keypair
      });

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceTransferUtxo],
      );
    })

    it('should spend input utxo and split', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 10;
      const aliceDepositUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo]
      );

      const aliceSplitAmount = 5;
      const aliceSplitUtxo1 = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceSplitAmount)
      });

      const aliceSplitUtxo2 = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceSplitAmount)
      });

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceSplitUtxo1, aliceSplitUtxo2]
      );
    })

    it('should join and spend', async () => {
      const aliceDepositAmount1 = 1e7;
      const aliceDepositUtxo1 = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount1)
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo1.keypair.address(),
        [],
        [aliceDepositUtxo1]
      );
      
      const aliceDepositAmount2 = 1e7;
      const aliceDepositUtxo2 = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount2),
        keypair: aliceDepositUtxo1.keypair
      });

      await anchor.transact(
        [],
        [aliceDepositUtxo2]
      );
      
      const aliceJoinAmount = 2e7;
      const aliceJoinUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceJoinAmount),
        //keypair: aliceDepositUtxo1.keypair
      });

      await anchor.transact(
        [aliceDepositUtxo1, aliceDepositUtxo2],
        [aliceJoinUtxo]
      );
    })

    it('should withdraw', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo]
      );

      const aliceWithdrawAmount = 5e6;
      const aliceChangeUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceWithdrawAmount),
        keypair: aliceDepositUtxo.keypair
      });
      const aliceETHAddress = '0xDeaD00000000000000000000000000000000BEEf';
    
      await anchor.transact(
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        0,
        aliceETHAddress
      )
      assert.strictEqual(aliceWithdrawAmount.toString(), await (await token.balanceOf(aliceETHAddress)).toString());
    });

    it('should prevent double spend', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });
      
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo]
      );
     
      const aliceTransferUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount),
        keypair: aliceDepositUtxo.keypair
      });

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceTransferUtxo],
      );
      
      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.transact(
          [aliceDepositUtxo],
          [aliceTransferUtxo],
        ),
        'Input is already spent'
      )
    });

    it('should prevent increasing UTXO amount without depositing', async () => {
      const signers = await ethers.getSigners();
      const alice= signers[0];

      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });
      //Step 1: Alice deposits into Tornado Pool
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      await anchor.registerAndTransact(
        alice.address,
        aliceDepositUtxo.keypair.address(),
        [],
        [aliceDepositUtxo]
      );

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      assert.strictEqual(aliceBalanceAfterDeposit.toString(), BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))).toString())
      
      //Step 3: Alice tries to create a UTXO with more funds than she has in her account
      const aliceOutputAmount = '100000000000000000000000';
      const aliceOutputUtxo = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceOutputAmount),
        keypair: aliceDepositUtxo.keypair
      });
      //Step 4: Check that step 3 fails
      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.transact(
          [aliceDepositUtxo],
          [aliceOutputUtxo]
        ),
        'ERC20: transfer amount exceeds balance'
      )
    });

    it('should reject tampering with public inputs', async () => {
      const relayer = "0x2111111111111111111111111111111111111111";
      const extAmount = 1e7;
      const isL1Withdrawal = false;
      const roots = await anchor.populateRootInfosForProof();
      const inputs = [new Utxo({chainId: BigNumber.from(chainID)}), new Utxo({chainId: BigNumber.from(chainID)})];
      const aliceDepositAmount = 1e7;
      const outputs = [new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      }), new Utxo({chainId: BigNumber.from(chainID)})];
      const merkleProofsForInputs = inputs.map((x) => anchor.getMerkleProof(x));
      fee = BigInt(0);
      
      const { input, extData } = await anchor.generateWitnessInput(
        roots,
        chainID,
        inputs, 
        outputs,
        extAmount,
        fee,
        recipient,
        relayer,
        merkleProofsForInputs
      );
     
      const wtns = await create2InputWitness(input);
      let res = await snarkjs.groth16.prove('protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      const proofEncoded = await VAnchor.generateWithdrawProofCallData(proof, publicSignals);

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
        toFixedHex(extData.recipient, 20),
        toFixedHex(extData.extAmount),  
        toFixedHex(extData.relayer, 20),
        toFixedHex(extData.fee),
        extData.encryptedOutput1,
        extData.encryptedOutput2
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

      //anchor.contract.transact(incorrectPublicInputs, extAmountInputs, { gasPrice: '0' });
      
      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs, { gasPrice: '0' }),
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
        //@ts-ignore
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs, { gasPrice: '0' }),
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
        //@ts-ignore
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs, { gasPrice: '0' }),
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
        //@ts-ignore
        anchor.contract.transact(incorrectPublicInputs, extAmountInputs, { gasPrice: '0' }),
        'Invalid withdraw proof',
      );

      //relayer
      let incorrectExtDataArgs = [
        toFixedHex(extData.recipient, 20),
        toFixedHex(extData.extAmount),  
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(extData.fee),
        extData.encryptedOutput1,
        extData.encryptedOutput2
      ];

      let correctPublicInputs = VAnchor.convertToPublicInputsStruct(publicInputArgs);
      let incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs)

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.transact(correctPublicInputs, incorrectExtAmountInputs, { gasPrice: '0' }),
        'Incorrect external data hash',
      );

      //recipient
      incorrectExtDataArgs = [
        toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
        toFixedHex(extData.extAmount),  
        toFixedHex(extData.relayer, 20),
        toFixedHex(extData.fee),
        extData.encryptedOutput1,
        extData.encryptedOutput2
      ];

      incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs)

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.transact(correctPublicInputs, incorrectExtAmountInputs, { gasPrice: '0' }),
        'Incorrect external data hash',
      );

      //fee
      incorrectExtDataArgs = [
        toFixedHex(extData.recipient, 20),
        toFixedHex(extData.extAmount),  
        toFixedHex(extData.relayer, 20),
        toFixedHex('0x000000000000000000000000000000000000000000000000015345785d8a0000'),
        extData.encryptedOutput1,
        extData.encryptedOutput2
      ];

      incorrectExtAmountInputs = VAnchor.convertToExtDataStruct(incorrectExtDataArgs)

      await TruffleAssert.reverts(
        //@ts-ignore
        anchor.contract.transact(correctPublicInputs, incorrectExtAmountInputs, { gasPrice: '0' }),
        'Incorrect external data hash',
      );
    });

    // it('values for hossein', async () => {
    //   const aliceDepositAmount = 1e7;
    //   const utxo = new Utxo({
    //     chainId: BigNumber.from(chainID),
    //     originChainId: BigNumber.from(chainID),
    //     amount: BigNumber.from(aliceDepositAmount)
    //   });

    //   const utxo2 = new Utxo({
    //     chainId: BigNumber.from(chainID),
    //     originChainId: BigNumber.from(chainID),
    //     amount: BigNumber.from(aliceDepositAmount),
    //     keypair: utxo.keypair
    //   });

    //   await anchor.registerAndTransact(
    //     sender.address,
    //     utxo.keypair.address(),
    //     [],
    //     [utxo]
    //   );

    //   await anchor.transact(
    //     [utxo],
    //     [utxo2]
    //   )
    //   console.log("keypair");
    //   console.log(`keypair private key is ${VAnchor.hexStringToByte(toFixedHex(utxo.keypair.privkey))}`);
    //   console.log(`keypair public key is ${toFixedHex(utxo.keypair.pubkey)}`);

    //   console.log("leaf commitment");
    //   console.log(`chainId is ${toFixedHex(utxo.chainId)}`);
    //   console.log(`amount is ${toFixedHex(utxo.amount)}`);
    //   console.log(`public key is ${toFixedHex(utxo.keypair.pubkey)}`);
    //   console.log(`blinding is ${toFixedHex(utxo.blinding)}`);
    //   console.log(`commitment is ${toFixedHex(utxo.getCommitment())}`);

    //   console.log("nullifier");
    //   console.log(`commitment is ${toFixedHex(utxo.getCommitment())}`);
    //   console.log(`pathIndices is ${toFixedHex(utxo.index!.toString())}`);
    //   console.log(`private key is ${toFixedHex(utxo.keypair.privkey)}`);
    //   console.log(`nullifier is ${toFixedHex(utxo.getNullifier())}`);
    // });

    // it('transact should work with 16 inputs', async () => {
    //   const aliceDepositAmount1 = 4e7;
    //   const aliceDepositUtxo1 = new Utxo({
    //     chainId: BigNumber.from(chainID),
    //     originChainId: BigNumber.from(chainID),
    //     amount: BigNumber.from(aliceDepositAmount1)
    //   });
      
    //   const aliceDepositAmount2 = 4e7;
    //   const aliceDepositUtxo2 = new Utxo({
    //     chainId: BigNumber.from(chainID),
    //     originChainId: BigNumber.from(chainID),
    //     amount: BigNumber.from(aliceDepositAmount2),
    //     keypair: aliceDepositUtxo1.keypair
    //   });

    //   const aliceDepositAmount3 = 4e7;
    //   const aliceDepositUtxo3 = new Utxo({
    //     chainId: BigNumber.from(chainID),
    //     originChainId: BigNumber.from(chainID),
    //     amount: BigNumber.from(aliceDepositAmount3),
    //     keypair: aliceDepositUtxo1.keypair
    //   });

    //   await anchor.registerAndTransact(
    //     sender.address,
    //     aliceDepositUtxo1.keypair.address(),
    //     [],
    //     [aliceDepositUtxo1, aliceDepositUtxo2, aliceDepositUtxo3]
    //   );
      
      

      // await anchor.transact(
      //   [],
      //   [aliceDepositUtxo2]
      // );
      
      // const aliceJoinAmount = 2e7;
      // const aliceJoinUtxo = new Utxo({
      //   chainId: BigNumber.from(chainID),
      //   originChainId: BigNumber.from(chainID),
      //   amount: BigNumber.from(aliceJoinAmount),
      //   //keypair: aliceDepositUtxo1.keypair
      // });

      // await anchor.transact(
      //   [aliceDepositUtxo1, aliceDepositUtxo2],
      //   [aliceJoinUtxo]
      // );
    // });
  })
});

