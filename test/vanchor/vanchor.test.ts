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
  GTokenWrapperMock__factory as WrappedTokenFactory,
  MockAMB__factory as AMBFactory,
  MockOmniBridge__factory as OmniBridgeFactory,
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

const MerkleTree = require('../../lib/MerkleTree');

const snarkjs = require('snarkjs')

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
    

    // create token
    const ambFactory = new AMBFactory(wallet);
    const amb = await ambFactory.deploy(sender.address, 1);
    await amb.deployed();
    // create token
    const omniBridgeFactory = new OmniBridgeFactory(wallet);
    const omniBridge = await omniBridgeFactory.deploy(amb.address);
    await omniBridge.deployed();
    // create Anchor
    anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      levels,
      hasherInstance.address,
      token.address,
      omniBridge.address,
      sender.address,
      1,
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
      const witnessCalculator = require("../fixtures/poseidon4/4/witness_calculator.js");
      const fileBuf = require('fs').readFileSync('test/fixtures/poseidon4/4/poseidon4_test.wasm');
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require("../fixtures/vanchor_2/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync('test/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm');
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }

    create16InputWitness = async (data: any) => {
      const witnessCalculator = require("../fixtures/vanchor_16/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync("test/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm");
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
        isL1Withdrawal,
        merkleProofsForInputs
      );
     
      const wtns = await create2InputWitness(input);
      let res = await snarkjs.groth16.prove('test/fixtures/vanchor_2/2/circuit_final.zkey', wtns);
      const proof = res.proof;
      let publicSignals = res.publicSignals;
      console.log(publicSignals);
      let tempProof = proof;
      let tempSignals = publicSignals;
      const vKey = await snarkjs.zKey.exportVerificationKey('test/fixtures/vanchor_2/2/circuit_final.zkey');

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
    
    it.only('should spend input utxo and create output utxo', async () => {
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

      // const aliceSplitAmount = 5e6;
      // const aliceSplitUtxo1 = new Utxo({
      //   chainId: BigNumber.from(chainID),
      //   amount: BigNumber.from(aliceSplitAmount)
      // });

      // const aliceSplitUtxo2 = new Utxo({
      //   chainId: BigNumber.from(chainID),
      //   amount: BigNumber.from(aliceSplitAmount)
      // });

      const aliceDepositUtxo2 = new Utxo({
        chainId: BigNumber.from(chainID),
        originChainId: BigNumber.from(chainID),
        amount: BigNumber.from(aliceDepositAmount)
      });

      await anchor.transact(
        [aliceDepositUtxo],
        [aliceDepositUtxo2]
      );
    })
  })
});

