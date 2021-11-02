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
  GovernedTokenWrapper as WrappedToken,
  GovernedTokenWrapper__factory as WrappedTokenFactory,
  MockAMB__factory as AMBFactory,
  MockOmniBridge__factory as OmniBridgeFactory,
} from '../../typechain';

// Convenience wrapper classes for contract classes
import VAnchor from '../../lib/vbridge/VAnchor';
import { getHasherFactory } from '../../lib/bridge/utils';
import Verifier from '../../lib/vbridge/Verifier';
import { Utxo } from '../../lib/vbridge/utxo';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { NATIVE_AMOUNT } = process.env
const BN = require('bn.js');

const MerkleTree = require('../../lib/MerkleTree');

describe('VAnchor for 2 max edges', () => {
  let anchor: VAnchor;

  const levels = 30;
  const value = NATIVE_AMOUNT || '1000000000000000000' // 1 ether
  let tree: typeof MerkleTree;
  const fee = BigInt((new BN(`${NATIVE_AMOUNT}`).shrn(1)).toString()) || BigInt((new BN(`${1e17}`)).toString());
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
    const tokenFactory = new MintableTokenFactory(wallet);
    token = await tokenFactory.deploy("Webb Wrapped Token", "webbTKN");
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

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require("../fixtures/vanchor_2/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync("./test/fixtures/vanchor_2/2/poseidon_vbridge_2_2.wasm");
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }

    create16InputWitness = async (data: any) => {
      const witnessCalculator = require("../fixtures/vanchor_16/2/witness_calculator.js");
      const fileBuf = require('fs').readFileSync("./test/fixtures/vanchor_16/2/poseidon_vbridge_16_2.wasm");
      const wtnsCalc = await witnessCalculator(fileBuf)
      const wtns = await wtnsCalc.calculateWTNSBin(data,0);
      return wtns;
    }
  })

  describe('#constructor', () => {
    it.only('should initialize', async () => {
      const maxEdges = await anchor.contract.maxEdges();
      assert.strictEqual(maxEdges.toString(), `${MAX_EDGES}`);
    });
  });

  describe('#transact', () => {
    it.only('should transact', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = new Utxo({ amount: BigNumber.from(aliceDepositAmount) });
      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.address(),
      );
    })
  })
});