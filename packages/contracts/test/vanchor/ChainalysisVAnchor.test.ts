/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: Apache 2.0/MIT
 */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
const assert = require('assert');
const hre = require('hardhat');
const { BigNumber } = require('ethers');
const bne = (x, e) => BigNumber.from(x + '0'.repeat(parseInt(e)));
const path = require('path');

import { ChainalysisVAnchor, PoseidonHasher, VAnchor } from '@webb-tools/anchors';
import {
  fetchComponentsFromFilePaths,
  getChainIdType,
  hexToU8a,
  ZkComponents,
} from '@webb-tools/utils';
import { Keypair, CircomUtxo, randomBN } from '@webb-tools/sdk-core';
import { Verifier } from '@webb-tools/bridges';
import { ERC20PresetMinterPauser, ERC20PresetMinterPauser__factory } from '@webb-tools/contracts';
import BN from 'bn.js';
import { expect } from 'chai';

describe.skip('ChainalysisVAnchor', () => {
  let anchor: ChainalysisVAnchor;
  let sender: SignerWithAddress;
  const levels = 30;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  let verifier: Verifier;
  let hasherInstance: any;
  let token: ERC20PresetMinterPauser;

  let sanctionListContractAddress = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb';
  let signers: any;
  let sanctionedAddress = '0x5a14e72060c11313e38738009254a90968f58f51';
  let sanctionedSigner: SignerWithAddress;
  // setup zero knowledge components
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  const chainID = getChainIdType(31337);

  beforeEach(async () => {
    await hre.network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: 'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY,
            blockNumber: 16023470,
          },
        },
      ],
    });
    signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;

    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [sanctionedAddress],
    });
    sanctionedSigner = await ethers.getSigner(sanctionedAddress);

    // create poseidon hasher
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

    // create bridge verifier
    verifier = await Verifier.createVerifier(sender);

    // create token
    const tokenFactory = new ERC20PresetMinterPauser__factory(wallet);
    token = await tokenFactory.deploy('test token', 'TEST');
    await token.deployed();
    await token.mint(sender.address, '10000000000000000000000');

    anchor = await VAnchor.createVAnchor(
      verifier.contract.address,
      levels,
      hasherInstance.contract.address,
      sender.address,
      token.address,
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

    await token.approve(anchor.contract.address, '1000000000000000000000000');
  });

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

  describe('#transact', () => {
    it('should fail to transact from a sanctioned address', async () => {
      // Alice deposits into tornado pool
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceDepositAmount);
      anchor.setSigner(sanctionedSigner);
      expect(
        anchor.registerAndTransact(
          sender.address,
          aliceDepositUtxo.keypair.toString(),
          [],
          [aliceDepositUtxo],
          0,
          0,
          '0',
          '0',
          '',
          {}
        )
      ).to.be.revertedWith('SanctionFilter: Sanctioned address');
    });
  });
});
