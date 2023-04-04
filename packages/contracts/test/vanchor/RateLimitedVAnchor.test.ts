/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: Apache 2.0/MIT
 */
const assert = require('assert');
const TruffleAssert = require('truffle-assertions');
import { ethers } from 'hardhat';

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
} from '@webb-tools/contracts';

import {
  hexToU8a,
  fetchComponentsFromFilePaths,
  getChainIdType,
  ZkComponents,
} from '@webb-tools/utils';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  Keypair,
  randomBN,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import { VAnchor, PoseidonHasher, RateLimitedVAnchor } from '@webb-tools/anchors';
import { Verifier } from '@webb-tools/vbridge';

const path = require('path');

describe.only('Rate Limited VAnchor', () => {
  let anchor: RateLimitedVAnchor;

  const levels = 30;
  let recipient;
  let verifier: Verifier;
  let token: ERC20PresetMinterPauser;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  const chainID = getChainIdType(31337);
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
      keypair: randomKeypair,
    });
  };

  before('instantiate zkcomponents', async () => {
    zkComponents2_2 = await fetchComponentsFromFilePaths(
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/vanchor_2/2/witness_calculator.cjs'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/vanchor_2/2/circuit_final.zkey'
      )
    );

    zkComponents16_2 = await fetchComponentsFromFilePaths(
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/vanchor_16/2/witness_calculator.cjs'
      ),
      path.resolve(
        __dirname,
        '../../solidity-fixtures/solidity-fixtures/vanchor_16/2/circuit_final.zkey'
      )
    );
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    recipient = signers[1].address;
    // create poseidon hasher
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

    // create bridge verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new ERC20PresetMinterPauser__factory(wallet);
    token = await tokenFactory.deploy('test token', 'TEST');
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    // create wrapped token
    const name = 'webbETH';
    const symbol = 'webbETH';
    const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
    const wrappedTokenFactory = new WrappedTokenFactory(wallet);
    wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
    await wrappedToken.deployed();
    await wrappedToken.initialize(
      0,
      dummyFeeRecipient,
      sender.address,
      '10000000000000000000000000',
      true,
      wallet.address
    );
    await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));

    // create Anchor
    anchor = await RateLimitedVAnchor.createVAnchor(
      verifier.contract.address,
      levels,
      hasherInstance.contract.address,
      sender.address,
      wrappedToken.address,
      1,
      zkComponents2_2,
      zkComponents16_2,
      sender
    );
    await anchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
    await anchor.contract.configureMaximumDepositLimit(
      BigNumber.from(tokenDenomination).mul(1_000_000),
      2
    );
    await anchor.setDailyWithdrawalLimit(
      BigNumber.from('10').pow(BigNumber.from('18')),
    );
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    await wrappedToken.grantRole(MINTER_ROLE, anchor.contract.address);
    await token.approve(wrappedToken.address, '1000000000000000000000000');

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require('../../solidity-fixtures/solidity-fixtures/vanchor_2/2/witness_calculator.cjs');
      const fileBuf = require('fs').readFileSync(
        'solidity-fixtures/solidity-fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm'
      );
      const wtnsCalc = await witnessCalculator(fileBuf);
      const wtns = await wtnsCalc.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  describe('#withdraw rate limiting', () => {
    it('should withdraw', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
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
        keypair: aliceDepositUtxo.keypair,
      });
      const aliceETHAddress = '0xDeaD00000000000000000000000000000000BEEf';

      await anchor.transact([aliceDepositUtxo], [aliceChangeUtxo], 0, 0, aliceETHAddress, '0', '', {
        [chainID.toString()]: anchorLeaves,
      });

      assert.strictEqual(
        aliceWithdrawAmount.toString(),
        await (await wrappedToken.balanceOf(aliceETHAddress)).toString()
      );
    });

    it('should rate limit a withdraw and fail', async () => {
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);

      await anchor.registerAndTransact(
        sender.address,
        aliceDepositUtxo.keypair.toString(),
        [],
        [aliceDepositUtxo],
        0,
        0,
        '0',
        '0',
        token.address,
        {}
      );

      let anchorLeaves = anchor.tree.elements().map((leaf) => hexToU8a(leaf.toHexString()));

      await anchor.setDailyWithdrawalLimit(
        BigNumber.from(`${5e6}`)
      );
      const aliceWithdrawAmount = 6e6;
      const aliceChangeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceWithdrawAmount.toString(),
        keypair: aliceDepositUtxo.keypair,
      });
      const aliceETHAddress = '0xDeaD00000000000000000000000000000000BEEf';

      TruffleAssert.reverts(
        await anchor.transact([aliceDepositUtxo], [aliceChangeUtxo], 0, 0, aliceETHAddress, '0', '', {
          [chainID.toString()]: anchorLeaves,
        }),
        'RateLimitedVAnchor: Daily withdrawal limit reached',
      );
    });
  });
});
