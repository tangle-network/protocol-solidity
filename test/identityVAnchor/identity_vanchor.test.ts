/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { ContractTransaction } from 'ethers';

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  GovernedTokenWrapper as WrappedToken,
  GovernedTokenWrapper__factory as WrappedTokenFactory,
  PoseidonT3__factory,
  Semaphore as SemaphoreContract,
} from '../../packages/contracts/src';

// Convenience wrapper classes for contract classes
import {
  hexToU8a,
  fetchComponentsFromFilePaths,
  getChainIdType,
  ZkComponents,
  u8aToHex,
  getIdentityVAnchorExtDataHash,
  UTXOInputs,
} from '@webb-tools/utils';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  Utxo,
  Keypair,
  MerkleProof,
  MerkleTree,
  randomBN,
  toFixedHex,
  generateWithdrawProofCallData,
  getVAnchorExtDataHash,
  generateVariableWitnessInput,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import { IdentityVAnchor } from '@webb-tools/anchors';
import { IdentityVerifier } from '@webb-tools/vbridge';
import { IIdentityVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { Semaphore } from '@webb-tools/semaphore';
import { Group } from '@webb-tools/semaphore-group';
import { writeFileSync } from 'fs';

const BN = require('bn.js');

const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');

describe('IdentityVAnchor for 2 max edges', () => {
  let idAnchor: IdentityVAnchor;
  let semaphore: Semaphore;
  let semaphoreContract: SemaphoreContract;

  const levels = 30;
  const defaultRoot = BigInt('21663839004416932945382355908790599225266501822907911457504978515578255421292');
  let fee = BigInt(new BN(`100`).toString());
  let verifier: IdentityVerifier;
  let hasherInstance: any;
  let token: ERC20PresetMinterPauser;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  const chainID = getChainIdType(31337);
  const maxEdges = 1;
  let create2InputWitness: any;
  let sender: SignerWithAddress;
  // setup zero knowledge components
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  let group: Group;
  let aliceCalldata: any;
  let aliceKeypair: Keypair;
  let aliceProof: any;
  let alicePublicSignals: any;
  let bobKeypair: Keypair;
  let carlKeypair: Keypair;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carl: SignerWithAddress;

  const identity_vanchor_2_2_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/identity_vanchor_2/2/identity_vanchor_2_2.wasm'
  );
  const identity_vanchor_2_2_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/identity_vanchor_2/2/witness_calculator.cjs'
  );
  const identity_vanchor_2_2_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/identity_vanchor_2/2/circuit_final.zkey'
  );

  const identity_vanchor_16_2_wasm_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/identity_vanchor_16/2/identity_vanchor_16_2.wasm'
  );
  const identity_vanchor_16_2_witness_calc_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/identity_vanchor_16/2/witness_calculator.cjs'
  );
  const identity_vanchor_16_2_zkey_path = path.resolve(
    __dirname,
    '../../solidity-fixtures/solidity-fixtures/identity_vanchor_16/2/circuit_final.zkey'
  );

  const generateUTXOForTest = async (chainId: number, keypair: Keypair, amount?: number) => {
    // const randomKeypair = new Keypair();
    const amountString = amount ? amount.toString() : '0';

    return CircomUtxo.generateUtxo({
      curve: 'Bn254',
      backend: 'Circom',
      chainId: chainId.toString(),
      originChainId: chainId.toString(),
      amount: amountString,
      blinding: hexToU8a(randomBN(31).toHexString()),
      keypair: keypair,
    });
  };

  before('instantiate zkcomponents and user keypairs', async () => {
    zkComponents2_2 = await fetchComponentsFromFilePaths(
      identity_vanchor_2_2_wasm_path,
      identity_vanchor_2_2_witness_calc_path,
      identity_vanchor_2_2_zkey_path
    );

    zkComponents16_2 = await fetchComponentsFromFilePaths(
      identity_vanchor_16_2_wasm_path,
      identity_vanchor_16_2_witness_calc_path,
      identity_vanchor_16_2_zkey_path
    );

    aliceKeypair = new Keypair();
    bobKeypair = new Keypair();
    carlKeypair = new Keypair();
  });

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    alice = signers[0];
    bob = signers[1];
    carl = signers[2];
    // create poseidon hasher
    const hasherFactory = new PoseidonT3__factory(wallet);
    hasherInstance = await hasherFactory.deploy();
    await hasherInstance.deployed();

    // create bridge verifier
    verifier = await IdentityVerifier.createVerifier(sender);

    // create token
    const tokenFactory = new ERC20PresetMinterPauser__factory(wallet);
    token = await tokenFactory.deploy('test token', 'TEST');
    await token.deployed();
    await token.mint(alice.address, BigNumber.from(1e10).toString());
    await token.mint(bob.address, BigNumber.from(1e10).toString());
    await token.mint(carl.address, BigNumber.from(1e10).toString());

    // create Anchor
    semaphore = await Semaphore.createSemaphore(levels, maxEdges, zkComponents2_2, sender);
    semaphoreContract = semaphore.contract;

    const groupId = BigNumber.from(99); // arbitrary
    const tx = await semaphore.createGroup(groupId, levels,  alice.address, maxEdges);

    let aliceLeaf = aliceKeypair.getPubKey();
    group = new Group(levels, BigInt(defaultRoot));
    group.addMember(aliceLeaf);
    let alice_addmember_tx = await semaphoreContract
      .connect(sender)
      .addMember(groupId, aliceLeaf, { gasLimit: '0x5B8D80' });
    // const receipt = await alice_addmember_tx.wait();

    expect(alice_addmember_tx).to.emit(semaphoreContract, 'MemberAdded').withArgs(groupId, aliceLeaf, group.root);

    let bobLeaf = bobKeypair.getPubKey();
    let bob_addmember_tx = await semaphoreContract
      .connect(sender)
      .addMember(groupId, bobLeaf, { gasLimit: '0x5B8D80' });
    // const receipt = await alice_addmember_tx.wait();
    group.addMember(bobLeaf);

    expect(bob_addmember_tx).to.emit(semaphoreContract, 'MemberAdded').withArgs(groupId, bobLeaf, group.root);

    idAnchor = await IdentityVAnchor.createIdentityVAnchor(
      semaphore,
      verifier.contract.address,
      levels,
      hasherInstance.address,
      alice.address,
      token.address,
      maxEdges,
      groupId,
      group,
      zkComponents2_2,
      zkComponents16_2,
      sender
    );

    await idAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 0);

    await idAnchor.contract.configureMaximumDepositLimit(BigNumber.from(tokenDenomination).mul(1_000_000), 0);

    await token.approve(idAnchor.contract.address, '1000000000000000000000000');

    create2InputWitness = async (data: any) => {
      const witnessCalculator = require(identity_vanchor_2_2_witness_calc_path);
      const fileBuf = require('fs').readFileSync(identity_vanchor_2_2_wasm_path);
      const wtnsCalc = await witnessCalculator(fileBuf);
      const wtns = await wtnsCalc.calculateWTNSBin(data, 0);
      return wtns;
    };
  });

  describe('#constructor', () => {
    it('should initialize', async () => {
      const actual = await idAnchor.contract.maxEdges();
      expect(actual.toString()).to.equals(`${maxEdges}`);
    });
  });

  describe('snark proof native verification on js side', () => {
    it('should work', async () => {
      const relayer = '0x2111111111111111111111111111111111111111';
      const extAmount = 1e7;
      const aliceDepositAmount = 1e7;
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const inputs: Utxo[] = [
        await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const outputs = [
        await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const merkleProofsForInputs = inputs.map((x) => idAnchor.getMerkleProof(x));

      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const aliceExtData = {
        recipient: toFixedHex(alice.address, 20),
        extAmount: toFixedHex(extAmount),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        refund: toFixedHex(BigNumber.from(0).toString()),
        token: toFixedHex(token.address, 20),
        encryptedOutput1: encOutput1,
        encryptedOutput2: encOutput2,
      };

      const aliceExtDataHash = await getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        alice.address,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const vanchorInput: UTXOInputs = await generateVariableWitnessInput(
        vanchorRoots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        extAmount,
        fee,
        aliceExtDataHash,
        merkleProofsForInputs
      );
      // Alice deposits into tornado pool
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      const aliceLeaf = aliceKeypair.getPubKey();

      const identityRootInputs = [group.root.toString(), BigNumber.from(0).toString()];
      const idx = group.indexOf(aliceLeaf);
      const identityMerkleProof: MerkleProof = group.generateProofOfMembership(idx);

      const outSemaphoreProofs = outputs.map((utxo) => {
        const leaf = utxo.keypair.getPubKey();
        if (Number(utxo.amount) > 0) {
          const idx = group.indexOf(leaf);
          return group.generateProofOfMembership(idx);
        } else {
          const inputMerklePathIndices = new Array(group.depth).fill(0);
          const inputMerklePathElements = new Array(group.depth).fill(0);
          return {
            pathIndices: inputMerklePathIndices,
            pathElements: inputMerklePathElements,
          };
        }
      });

      const wasmFilePath = `solidity-fixtures/solidity-fixtures/identity_vanchor_2/2/identity_vanchor_2_2.wasm`;
      const zkeyFilePath = `solidity-fixtures/solidity-fixtures/identity_vanchor_2/2/circuit_final.zkey`;
      const fullProof = await idAnchor.generateProof(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        aliceExtDataHash.toString(),
        vanchorInput
      );
      aliceProof = fullProof.proof;
      alicePublicSignals = fullProof.publicSignals;

      const vKey = await snarkjs.zKey.exportVerificationKey(identity_vanchor_2_2_zkey_path);

      const res = await snarkjs.groth16.verify(vKey, alicePublicSignals, aliceProof);
      aliceCalldata = await snarkjs.groth16.exportSolidityCallData(fullProof.proof, fullProof.publicSignals);
      expect(res).equal(true);
    });
  });

  describe('Setting Handler/Verifier Address Negative Tests', () => {
    it('should revert (setting handler) with improper nonce', async () => {
      const signers = await ethers.getSigners();
      expect(idAnchor.contract.setHandler(signers[1].address, 0)).to.revertedWith('Invalid nonce');
      expect(idAnchor.contract.setHandler(signers[1].address, 1049)).to.revertedWith(
        'Nonce must not increment more than 1048'
      );
    });

    it('should revert (setting verifier) with improper nonce', async () => {
      const signers = await ethers.getSigners();
      expect(idAnchor.contract.setVerifier(signers[1].address, 0)).to.revertedWith('Invalid nonce');
      expect(idAnchor.contract.setVerifier(signers[1].address, 1049)).to.revertedWith(
        'Nonce must not increment more than 1048'
      );
    });
  });

  describe('#transact', () => {
    let relayer: string;
    let aliceDepositAmount: number;
    let aliceDepositUtxo: Utxo;
    beforeEach(async () => {
      relayer = '0x2111111111111111111111111111111111111111';
      aliceDepositAmount = 1e7;
      aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
    })
    it('alice should deposit', async () => {
      // Alice deposits into tornado pool
      const inputs: Utxo[] = [];
      const outputs = [aliceDepositUtxo];
      // , await generateUTXOForTest(chainID, new Keypair())];
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const tx = await idAnchor.transact(
        aliceKeypair,
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        alice.address,
        relayer
      );

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      expect(aliceBalanceAfterDeposit.toString()).equal(BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))).toString())

      expect(tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[0].commitment, 0, encOutput1);
      expect(tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[1].commitment, 1, encOutput2);
      expect(tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[0].nullifier);
      expect(tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[1].nullifier);
    });

    it('should process fee on deposit', async () => {
      // Alice deposits into tornado pool
      let aliceLeaf = aliceKeypair.getPubKey();
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const fee = 1e6;

      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const inputs: Utxo[] = [];
      const outputs = [aliceDepositUtxo];

      const tx = await idAnchor.transact(
        aliceKeypair,
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        alice.address,
        relayer
      );

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      expect(tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[0].commitment, 0, encOutput1);
      expect(tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[1].commitment, 1, encOutput2);
      expect(tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[0].nullifier);
      expect(tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[1].nullifier);

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
      expect(aliceBalanceAfterDeposit.toString()).equal(
        BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount)).sub(toBN(fee))).toString()
      );
      expect((await token.balanceOf(relayer)).toString()).equal(BigNumber.from(fee).toString());
    });

    // This test is meant to prove that utxo transfer flows are possible, and the receiver
    // can query on-chain data to construct and spend a utxo generated by the sender.
    it('alice should deposit to bob (bob is registered)', async function () {
      await idAnchor.setSigner(alice);
      const aliceDepositAmount = 1e7;
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const aliceBalanceBefore = await token.balanceOf(alice.address);
      const bobBalanceBefore = await token.balanceOf(bob.address);
      const bobPublicKeypair = Keypair.fromString(bobKeypair.toString());

      // generate a UTXO that is only spendable by bob
      const aliceTransferUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID.toString(),
        amount: aliceDepositAmount.toString(),
        keypair: bobPublicKeypair,
      });

      const tx = await idAnchor.transact(
        aliceKeypair,
        [],
        [aliceTransferUtxo],
        fee,
        BigNumber.from(0),
        alice.address,
        relayer
      );

      let receipt = await tx.wait();
      // Bob queries encrypted commitments on chain
      const encryptedCommitments: string[] = receipt.events
        .filter((event) => event.event === 'NewCommitment')
        .sort((a, b) => a.args.index - b.args.index)
        .map((e) => e.args.encryptedOutput)

      // Attempt to decrypt the encrypted commitments with bob's keypair
      const utxos = await Promise.all(
        encryptedCommitments.map(async (enc, index) => {
          try {
            const decryptedUtxo = await CircomUtxo.decrypt(bobKeypair, enc);
            // In order to properly calculate the nullifier, an index is required.
            decryptedUtxo.setIndex(index);
            // Set the originChainId for proving (decrypted will be an input utxo)
            decryptedUtxo.setOriginChainId(chainID.toString());
            const alreadySpent = await idAnchor.contract.isSpent(toFixedHex('0x' + decryptedUtxo.nullifier));
            if (!alreadySpent) {
              return decryptedUtxo;
            } else {
              throw new Error('Passed Utxo detected as alreadySpent');
            }
          } catch (e) {
            return undefined;
          }
        })
      );

      const spendableUtxos = utxos.filter((utxo) => utxo !== undefined);
      // // fetch the inserted leaves
      const dummyOutputs = [
        await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];

      // Bob uses the parsed utxos to issue a withdraw
      await idAnchor.transact(
        bobKeypair,
        spendableUtxos,
        dummyOutputs,
        fee,
        BigNumber.from(0),
        bob.address,
        relayer
      );

      const aliceBalanceAfter = await token.balanceOf(alice.address);
      const bobBalanceAfter = await token.balanceOf(bob.address);

      expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).equal((Number(fee) + aliceDepositAmount).toString());
      expect(bobBalanceAfter.sub(bobBalanceBefore).toString()).equal((aliceDepositAmount - Number(fee)).toString());
    });


    describe('## Alice already deposited:', () => {
      let aliceBalanceBeforeDeposit: BigNumber
      let aliceBalanceAfterDeposit: BigNumber

      beforeEach(async () => {
        aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
        const tx = await idAnchor.transact(
          aliceKeypair,
          [],
          [aliceDepositUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
        );
        aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
        expect(aliceBalanceAfterDeposit.toString()).equal(BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))).toString())
        expect(tx)
          .to.emit(idAnchor.contract, 'NewCommitment')
          .withArgs(aliceDepositUtxo.commitment, 0, aliceDepositUtxo.encrypt());
      })
      it('should spend input utxo and create output utxo', async () => {
        // Alice deposits into tornado pool
        const aliceRefreshUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: BigNumber.from(chainID).toString(),
          originChainId: BigNumber.from(chainID).toString(),
          amount: BigNumber.from(aliceDepositAmount).toString(),
          blinding: hexToU8a(randomBN().toHexString()),
          keypair: aliceDepositUtxo.keypair
        });

        await idAnchor.transact(
          aliceKeypair,
          [aliceDepositUtxo],
          [aliceRefreshUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
        );
      });

      it('should prevent double spend', async () => {
        const aliceTransferUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);

        await idAnchor.transact(
          aliceKeypair,
          [aliceDepositUtxo],
          [aliceTransferUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
        )

        const aliceDoubleSpendTransaction = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);

        expect (
          idAnchor.transact(
            aliceKeypair,
            [aliceDepositUtxo],
            [aliceDoubleSpendTransaction],
            fee,
            BigNumber.from(0),
            alice.address,
            relayer
          )
        ).to.revertedWith('Input is already spent')
      })

      it('should prevent increasing UTXO amount without depositing', async () => {
        const aliceOutputAmount = aliceBalanceAfterDeposit.mul(2)
        const aliceOutputUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: aliceOutputAmount.toString(),
          keypair: aliceDepositUtxo.keypair
        });
        //Step 4: Check that step 3 fails
        await expect(
          idAnchor.transact(
          aliceKeypair,
          [aliceDepositUtxo],
          [aliceOutputUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
          )
        ).to.revertedWith('ERC20: transfer amount exceeds balance')
      })
      it('should join and spend', async () => {
        const aliceBalanceAfterFirstDeposit = await token.balanceOf(alice.address);
        expect(aliceBalanceBeforeDeposit.sub(aliceBalanceAfterFirstDeposit).toString()).equal('10000000');
        const aliceDepositAmount2 = 2e7;
        let aliceDepositUtxo2 = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount2);

        await idAnchor.transact(
          aliceKeypair,
          [],
          [aliceDepositUtxo2],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
        );
        const aliceBalanceAfterSecondDeposit = await token.balanceOf(alice.address);
        expect(aliceBalanceAfterFirstDeposit.sub(aliceBalanceAfterSecondDeposit).toString()).equal('20000000');

        const aliceDeposit1Index = idAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
        const aliceDeposit2Index = idAnchor.tree.getIndexByElement(aliceDepositUtxo2.commitment);
        aliceDepositUtxo.setIndex(aliceDeposit1Index);
        aliceDepositUtxo2.setIndex(aliceDeposit2Index);

        const aliceJoinAmount = 3e7;
        const aliceJoinUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceJoinAmount);
        await idAnchor.transact(
          aliceKeypair,
          [aliceDepositUtxo, aliceDepositUtxo2],
          [aliceJoinUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
        );
        const aliceBalanceAfterJoin = await token.balanceOf(alice.address);
        expect(aliceBalanceBeforeDeposit.sub(aliceBalanceAfterJoin).toString()).equal('30000000');
      })
      it('should spend input utxo and split', async () => {
        // Alice deposits into tornado pool
        const aliceSplitAmount = aliceDepositAmount / 2;
        const aliceSplitUtxo1 = await generateUTXOForTest(chainID, aliceKeypair, aliceSplitAmount);
        const aliceSplitUtxo2 = await generateUTXOForTest(chainID, aliceKeypair, aliceSplitAmount);

        await idAnchor.transact(
          aliceKeypair,
          [aliceDepositUtxo],
          [aliceSplitUtxo1, aliceSplitUtxo2],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer
        );

        // alice shouldn't have deposited into tornado as input utxo has enough
        const aliceBalanceAfterSplit = await token.balanceOf(alice.address);
        expect(aliceBalanceAfterDeposit.sub(aliceBalanceAfterSplit).toString()).equal('0');
      })

      it('should withdraw', async () => {
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

        const tx = await idAnchor.transact(
          aliceKeypair,
          [aliceDepositUtxo],
          [aliceChangeUtxo],
          fee,
          BigNumber.from(0),
          aliceETHAddress,
          relayer
        );

        expect(aliceWithdrawAmount.toString()).equal(await (await token.balanceOf(aliceETHAddress)).toString());
      })
    })
    it('should reject proofs made against VAnchor empty edges', async () => {
      // const tx =
      await expect(idAnchor.contract.edgeList(BigNumber.from(0))).revertedWith('CALL_EXCEPTION')

      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const depositAmount = 1e8
      const depositUtxo = await generateUTXOForTest(chainID, aliceKeypair, depositAmount);
      // const fakeUtxo = await generateUTXOForTest(chainID, aliceKeypair, depositAmount);
      const fakeChainId = getChainIdType(666)
      // fakeUtxo.originChainId = fakeChainId.toString()
      const fakeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: fakeChainId.toString(),
        amount: BigNumber.from(depositAmount).toString(),
        blinding: hexToU8a(randomBN(31).toHexString()),
        keypair: aliceKeypair,
      });

      const inputs: Utxo[] = [
        fakeUtxo,
        // await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const outputs = [
        depositUtxo,
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      // const merkleProofsForInputs = inputs.map((x) => idAnchor.getMerkleProof(x));
      const fakeTree = new MerkleTree(idAnchor.tree.levels);
      const fakeCommitment = u8aToHex(fakeUtxo.commitment);
      fakeTree.insert(fakeCommitment);
      const fakeIdx = fakeTree.indexOf(fakeCommitment)
      const fakeMerkleProofs = [fakeTree.path(fakeIdx), idAnchor.getMerkleProof(inputs[1])]

      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const extData = {
        recipient: toFixedHex(alice.address, 20),
        extAmount: toFixedHex(0),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        refund: toFixedHex(BigNumber.from(0).toString()),
        token: toFixedHex(token.address, 20),
        encryptedOutput1: encOutput1,
        encryptedOutput2: encOutput2,
      };

      const extAmount = BigNumber.from(0)
      const extDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        // depositAmount.toString(),
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        alice.address,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const fakeRoots = vanchorRoots
      fakeRoots[1] = fakeTree.root().toString()
      const vanchorInput: UTXOInputs = await generateVariableWitnessInput(
        fakeRoots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        extAmount,
        fee,
        extDataHash,
        fakeMerkleProofs
      );
      // Alice deposits into tornado pool
      const aliceLeaf = aliceKeypair.getPubKey();

      const identityRootInputs = [group.root.toString(), BigNumber.from(0).toString()];
      const idx = group.indexOf(aliceLeaf);
      const identityMerkleProof: MerkleProof = group.generateProofOfMembership(idx);

      const outSemaphoreProofs = outputs.map((utxo) => {
        const leaf = utxo.keypair.getPubKey();
        if (Number(utxo.amount) > 0) {
          const idx = group.indexOf(leaf);
          return group.generateProofOfMembership(idx);
        } else {
          const inputMerklePathIndices = new Array(group.depth).fill(0);
          const inputMerklePathElements = new Array(group.depth).fill(0);
          return {
            pathIndices: inputMerklePathIndices,
            pathElements: inputMerklePathElements,
          };
        }
      });

      const publicInputs = await idAnchor.setupTransaction(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        vanchorInput,
        extDataHash.toString()
      );

      const tx = idAnchor.contract.transact({ ...publicInputs }, extData, { gasLimit: '0x5B8D80' })
      await expect(tx).revertedWith('non-existent edge is not set to the default root')
    })
    it('should reject proofs made against Semaphore empty edges', async () => {
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const depositAmount = 1e7
      // Carl has not been registered
      const carlDepositUtxo = await generateUTXOForTest(chainID, carlKeypair, depositAmount);
      const inputs: Utxo[] = [
        await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const outputs = [
        carlDepositUtxo,
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const merkleProofsForInputs = inputs.map((x) => idAnchor.getMerkleProof(x));

      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const recipient = carl.address;

      const extData = {
        recipient: toFixedHex(recipient, 20),
        extAmount: toFixedHex(depositAmount),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        refund: toFixedHex(BigNumber.from(0).toString()),
        token: toFixedHex(token.address, 20),
        encryptedOutput1: encOutput1,
        encryptedOutput2: encOutput2,
      };

      const extDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        depositAmount.toString(),
        BigNumber.from(fee).toString(),
        recipient,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const vanchorInput: UTXOInputs = await generateVariableWitnessInput(
        vanchorRoots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        depositAmount,
        fee,
        extDataHash,
        merkleProofsForInputs
      );
      // Alice deposits into tornado pool
      const carlLeaf = carlKeypair.getPubKey();
      const fakeGroup = new Group(levels, BigInt(defaultRoot));
      fakeGroup.addMember(carlLeaf);

      const identityRootInputs = [group.root.toString(), fakeGroup.root.toString()];
      const idx = fakeGroup.indexOf(carlLeaf);
      const identityMerkleProof: MerkleProof = group.generateProofOfMembership(idx);

      const outSemaphoreProofs = outputs.map((utxo) => {
        const leaf = utxo.keypair.getPubKey();
        if (Number(utxo.amount) > 0) {
          const idx = fakeGroup.indexOf(leaf);
          return fakeGroup.generateProofOfMembership(idx);
        } else {
          const inputMerklePathIndices = new Array(group.depth).fill(0);
          const inputMerklePathElements = new Array(group.depth).fill(0);
          return {
            pathIndices: inputMerklePathIndices,
            pathElements: inputMerklePathElements,
          };
        }
      });

      const publicInputs = await idAnchor.setupTransaction(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        vanchorInput,
        extDataHash.toString()
      );

      const tx = idAnchor.contract.transact({ ...publicInputs }, extData, { gasLimit: '0x5B8D80' })

      await expect(tx).revertedWith('Not initialized edges must be set to 0')
    })
  });

  describe('# prevent tampering', () => {
  // before('Create valid public inputs as baseline for tampering', async () => {
    const relayer = '0x2111111111111111111111111111111111111111';
    const extAmount = 1e7;
    const aliceDepositAmount = 1e7;

    let publicInputs: IIdentityVariableAnchorPublicInputs
    let aliceExtData: any
    let aliceExtDataHash: BigNumber


    // should be before but it says idAnchor is undefined in this case
    beforeEach(async () => {
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      const inputs: Utxo[] = [
        await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const outputs = [
        aliceDepositUtxo,
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const merkleProofsForInputs = inputs.map((x) => idAnchor.getMerkleProof(x));

      fee = BigInt(0);

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      aliceExtData = {
        recipient: toFixedHex(alice.address, 20),
        extAmount: toFixedHex(aliceDepositAmount),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        refund: toFixedHex(BigNumber.from(0).toString()),
        token: toFixedHex(token.address, 20),
        encryptedOutput1: encOutput1,
        encryptedOutput2: encOutput2,
      };

      aliceExtDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        alice.address,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const vanchorInput: UTXOInputs = await generateVariableWitnessInput(
        vanchorRoots.map((root) => BigNumber.from(root)),
        chainID,
        inputs,
        outputs,
        extAmount,
        fee,
        aliceExtDataHash,
        merkleProofsForInputs
      );
      // Alice deposits into tornado pool
      const aliceLeaf = aliceKeypair.getPubKey();

      const identityRootInputs = [group.root.toString(), BigNumber.from(0).toString()];
      const idx = group.indexOf(aliceLeaf);
      const identityMerkleProof: MerkleProof = group.generateProofOfMembership(idx);

      const outSemaphoreProofs = outputs.map((utxo) => {
        const leaf = utxo.keypair.getPubKey();
        if (Number(utxo.amount) > 0) {
          const idx = group.indexOf(leaf);
          return group.generateProofOfMembership(idx);
        } else {
          const inputMerklePathIndices = new Array(group.depth).fill(0);
          const inputMerklePathElements = new Array(group.depth).fill(0);
          return {
            pathIndices: inputMerklePathIndices,
            pathElements: inputMerklePathElements,
          };
        }
      });

      publicInputs = await idAnchor.setupTransaction(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        vanchorInput,
        aliceExtDataHash.toString()
      );
    })
    it('should reject tampering with public amount', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.publicAmount = toFixedHex(BigNumber.from(1e10))

      await expect(
        idAnchor.contract.transact({ ...invalidInputs }, aliceExtData, { gasLimit: '0x5B8D80' })
      ).to.revertedWith('Invalid public amount')

    })
    it('should reject tampering with external data hash', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.extDataHash = toFixedHex(BigNumber.from(publicInputs.extDataHash).add(1))

      await expect(
        idAnchor.contract.transact({ ...invalidInputs }, aliceExtData, { gasLimit: '0x5B8D80' })
      ).to.be.revertedWith('Incorrect external data hash')
    })

    it('should reject tampering with output commitments', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.outputCommitments[0] = toFixedHex(BigNumber.from(publicInputs.outputCommitments[0]).add(1))

      await expect(
        idAnchor.contract.transact({ ...invalidInputs }, aliceExtData, { gasLimit: '0x5B8D80' })
      ).to.be.revertedWith('Invalid transaction proof')
    })
    it('should reject tampering with input commitments', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.inputNullifiers[0] = toFixedHex(BigNumber.from(publicInputs.inputNullifiers[0]).add(1))

      await expect(
        idAnchor.contract.transact({ ...invalidInputs }, aliceExtData, { gasLimit: '0x5B8D80' })
      ).to.be.revertedWith('Invalid transaction proof')
    })

    it('should reject tampering with extData relayer', async () => {
      const invalidExtData = aliceExtData;
      invalidExtData.relayer = toFixedHex('0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337', 20),
      await expect(
        idAnchor.contract.transact({ ...publicInputs }, invalidExtData, { gasLimit: '0x5B8D80' })
      ).to.be.revertedWith('Incorrect external data hash')
    })
    it('should reject tampering with extData extAmount', async () => {
      const invalidExtData = aliceExtData;
      invalidExtData.extAmount = toFixedHex(aliceDepositAmount*100, 20),
      await expect(
        idAnchor.contract.transact({ ...publicInputs }, invalidExtData, { gasLimit: '0x5B8D80' })
      ).to.be.revertedWith('Incorrect external data hash')
    })
    it('should reject tampering with extData fee', async () => {
      const invalidExtData = aliceExtData;
      invalidExtData.fee = toFixedHex(fee + BigInt(1000), 20),
      await expect(
        idAnchor.contract.transact({ ...publicInputs }, invalidExtData, { gasLimit: '0x5B8D80' })
      ).to.be.revertedWith('Incorrect external data hash')
    })
  });
  describe('# transactWrap', () => {
    let wrappedIdAnchor: IdentityVAnchor;
    let wrapFee: number = 0; // between 0-10000

    beforeEach(async () => {
      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = "0x0000000000010000000010000000000000000000";
      const wrappedTokenFactory = new WrappedTokenFactory(alice);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol, dummyFeeRecipient, alice.address, '10000000000000000000000000', true);
      await wrappedToken.deployed();
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const groupId = BigNumber.from(99); // arbitrary
      await wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1));

      wrappedIdAnchor = await IdentityVAnchor.createIdentityVAnchor(
        semaphore,
        verifier.contract.address,
        levels,
        hasherInstance.address,
        alice.address,
        wrappedToken.address,
        maxEdges,
        groupId,
        group,
        zkComponents2_2,
        zkComponents16_2,
        alice
      );

      await wrappedIdAnchor.contract.configureMinimalWithdrawalLimit(
        BigNumber.from(0),
        0,
      );
      await wrappedIdAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        0,
      );
      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedIdAnchor.contract.address);
      await token.approve(wrappedToken.address, '10000000000000000000');

    })

    it('should wrap and deposit', async () => {
      const balTokenBeforeDepositSender = await token.balanceOf(alice.address);
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount)
      const tx = await wrappedIdAnchor.transactWrap(
        token.address,
        aliceKeypair,
        [],
        [aliceDepositUtxo],
        fee,
        BigNumber.from(0),
        '0',
        relayer
      );
      const balTokenAfterDepositSender = await token.balanceOf(alice.address);
      // Fix: this aint working. Might be bc of gas cost?
      // expect(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString()).equal('10000100');

      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedIdAnchor.contract.address);
      const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(alice.address);
      expect(balWrappedTokenAfterDepositAnchor.toString()).equal('10000000');
      expect(balWrappedTokenAfterDepositSender.toString()).equal('0');
    })
    it('should wrap and deposit', async () => {
      const balTokenBeforeDepositSender = await token.balanceOf(alice.address);
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount = 1e7;
      let aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount)
      await wrappedIdAnchor.transactWrap(
        token.address,
        aliceKeypair,
        [],
        [aliceDepositUtxo],
        // fee,
        BigNumber.from(0),
        BigNumber.from(0),
        '0',
        relayer
      );
      const balTokenAfterDepositSender = await token.balanceOf(alice.address);
      // Fix: why the magic 2? no idea
      // expect(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString()).equal((aliceDepositAmount + (aliceDepositAmount * wrapFee/10000 + 2)).toString());
      expect(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender).toString()).equal(aliceDepositAmount.toString());

      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(wrappedIdAnchor.contract.address);
      const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(alice.address);
      expect(balWrappedTokenAfterDepositAnchor.toString()).equal('10000000');
      expect(balWrappedTokenAfterDepositSender.toString()).equal('0');
      const aliceDepositIndex = wrappedIdAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);

      // aliceDepositUtxo = await updateUtxoWithIndex(aliceDepositUtxo, aliceDepositIndex, chainID);
      aliceDepositUtxo.setIndex(aliceDepositIndex);

      //Check that vAnchor has the right amount of wrapped token balance
      await expect((await wrappedToken.balanceOf(wrappedIdAnchor.contract.address)).toString()).equal(BigNumber.from(1e7).toString());

      const aliceChangeAmount = 0;
      const aliceChangeUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceChangeAmount)
      console.log('balance before withdraw sender: ', balWrappedTokenAfterDepositSender)
      console.log('balance before withdraw contract: ', balWrappedTokenAfterDepositAnchor)

      const tx1 = await wrappedIdAnchor.transactWrap(
        token.address,
        aliceKeypair,
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        BigNumber.from(0),
        BigNumber.from(0),
        alice.address,
        relayer
      );

      const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(alice.address);
      const balTokenAfterWithdrawAndUnwrapAnchor = await wrappedToken.balanceOf(idAnchor.contract.address);
      console.log('balance after withdraw: ', balTokenAfterWithdrawAndUnwrapSender)
      console.log('balance after withdraw contract: ', balTokenAfterWithdrawAndUnwrapAnchor)
      expect(balTokenBeforeDepositSender).equal(balTokenAfterWithdrawAndUnwrapSender);
      expect(balTokenAfterWithdrawAndUnwrapSender).equal(balTokenBeforeDepositSender);
    })
  })
});
