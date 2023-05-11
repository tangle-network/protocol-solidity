/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
import { expect } from 'chai';
import { ethers } from 'hardhat';
import '@nomicfoundation/hardhat-chai-matchers';
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  FungibleTokenWrapper as WrappedToken,
  FungibleTokenWrapper__factory as WrappedTokenFactory,
} from '@webb-tools/contracts';
import { startGanacheServer } from '@webb-tools/evm-test-utils';

import {
  hexToU8a,
  getChainIdType,
  ZkComponents,
  u8aToHex,
  VAnchorProofInputs,
  ZERO_BYTES32,
  identityVAnchorFixtures,
} from '@webb-tools/utils';
import { BigNumber, ContractReceipt } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import {
  Utxo,
  Keypair,
  MerkleProof,
  MerkleTree,
  randomBN,
  toFixedHex,
  getVAnchorExtDataHash,
  generateVariableWitnessInput,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import { IdentityVAnchor, IdentityVerifier } from '@webb-tools/identity-anchors';
import { IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { Semaphore } from '@webb-tools/semaphore';
import { LinkedGroup } from '@webb-tools/semaphore-group';
import { TransactionOptions, PoseidonHasher } from '@webb-tools/anchors';

const BN = require('bn.js');
const path = require('path');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');

describe('IdentityVAnchor for 2 max edges', () => {
  let idAnchor: IdentityVAnchor;
  let semaphore: Semaphore;

  const levels = 30;
  const defaultRoot = BigInt(
    '21663839004416932945382355908790599225266501822907911457504978515578255421292'
  );
  let fee = BigInt(new BN(`100`).toString());
  let verifier: IdentityVerifier;
  let token: ERC20PresetMinterPauser;
  let wrappedToken: WrappedToken;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  const chainID = getChainIdType(31337);
  const maxEdges = 1;
  let create2InputWitness: any;
  let sender: SignerWithAddress;
  let zkComponents2_2: ZkComponents;
  let zkComponents16_2: ZkComponents;
  let group: LinkedGroup;
  let aliceCalldata: any;
  let aliceKeypair: Keypair;
  let aliceProof: any;
  let alicePublicSignals: any;
  let bobKeypair: Keypair;
  let carlKeypair: Keypair;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carl: SignerWithAddress;

  const generateUTXOForTest = async (chainId: number, keypair: Keypair, amount?: number) => {
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
    zkComponents2_2 = await identityVAnchorFixtures[22]();
    zkComponents16_2 = await identityVAnchorFixtures[162]();

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
    const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

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
    semaphore = await Semaphore.createSemaphore(levels, zkComponents2_2, zkComponents2_2, sender);
    const groupId = BigNumber.from(99); // arbitrary
    const tx = await semaphore.createGroup(groupId.toNumber(), levels, alice.address, maxEdges);
    let aliceLeaf = aliceKeypair.getPubKey();
    group = new LinkedGroup(levels, maxEdges, BigInt(defaultRoot));
    group.addMember(aliceLeaf);
    let alice_addmember_tx = await semaphore.contract
      .connect(sender)
      .addMember(groupId, aliceLeaf, { gasLimit: '0x5B8D80' });
    // const receipt = await alice_addmember_tx.wait();
    expect(alice_addmember_tx)
      .to.emit(semaphore.contract, 'MemberAdded')
      .withArgs(groupId, aliceLeaf, group.root);
    let bobLeaf = bobKeypair.getPubKey();
    let bob_addmember_tx = await semaphore.contract
      .connect(sender)
      .addMember(groupId, bobLeaf, { gasLimit: '0x5B8D80' });
    group.addMember(bobLeaf);

    expect(bob_addmember_tx)
      .to.emit(semaphore.contract, 'MemberAdded')
      .withArgs(groupId, bobLeaf, group.root);
    idAnchor = await IdentityVAnchor.createIdentityVAnchor(
      semaphore,
      verifier.contract.address,
      levels,
      hasherInstance.contract.address,
      alice.address,
      token.address,
      maxEdges,
      groupId,
      group,
      zkComponents2_2,
      zkComponents16_2,
      sender
    );
    await idAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
    await idAnchor.contract.configureMaximumDepositLimit(
      BigNumber.from(tokenDenomination).mul(1_000_000),
      2
    );

    await token.approve(idAnchor.contract.address, '1000000000000000000000000');

    create2InputWitness = async (data: any) => {
      const wtns = await zkComponents2_2.witnessCalculator.calculateWTNSBin(data, 0);
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

      const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
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

      const identityRootInputs = group.getRoots().map((bignum: BigNumber) => bignum.toString());
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
            element: BigNumber.from(defaultRoot),
            merkleRoot: BigNumber.from(defaultRoot),
          };
        }
      });

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

      const vKey = await identityVAnchorFixtures.vkey_2_2();

      const res = await snarkjs.groth16.verify(vKey, alicePublicSignals, aliceProof);
      aliceCalldata = await snarkjs.groth16.exportSolidityCallData(
        fullProof.proof,
        fullProof.publicSignals
      );
      expect(res).equal(true);
    });
  });

  describe('Setting Handler/Verifier Address Negative Tests', () => {
    it('should revert (setting handler) with improper nonce', async () => {
      const signers = await ethers.getSigners();
      expect(idAnchor.contract.setHandler(signers[1].address, 0)).to.revertedWith(
        'ProposalNonceTracker: Invalid nonce'
      );
      expect(idAnchor.contract.setHandler(signers[1].address, 4)).to.revertedWith(
        'ProposalNonceTracker: Nonce must not increment more than 1'
      );
    });

    it('should revert (setting verifier) with improper nonce', async () => {
      const signers = await ethers.getSigners();
      expect(idAnchor.contract.setVerifier(signers[1].address, 0)).to.revertedWith(
        'ProposalNonceTracker: Invalid nonce'
      );
      expect(idAnchor.contract.setVerifier(signers[1].address, 4)).to.revertedWith(
        'ProposalNonceTracker: Nonce must not increment more than 1'
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
    });
    it('alice should deposit', async () => {
      // Alice deposits into tornado pool
      const inputs: Utxo[] = [];
      const outputs = [aliceDepositUtxo];
      // , await generateUTXOForTest(chainID, new Keypair())];
      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const tx = await idAnchor.transact(
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        alice.address,
        relayer,
        '',
        {},
        { gasLimit: '0x5B8D80', keypair: aliceKeypair }
      );

      const encOutput1 = outputs[0].encrypt();
      const encOutput2 = outputs[1].encrypt();

      const aliceBalanceAfterDeposit = await token.balanceOf(alice.address);

      expect(tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[0].commitment, 0, encOutput1);
      expect(tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[1].commitment, 1, encOutput2);
      expect(tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[0].nullifier);
      expect(tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[1].nullifier);
      const expectedBalance = aliceBalanceBeforeDeposit.sub(aliceDepositAmount).sub(fee);
      // expect(aliceBalanceAfterDeposit.add(BigNumber.from(fee))).equal(BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount))))
      expect(aliceBalanceAfterDeposit).equal(expectedBalance);
    });

    it('should process fee on deposit', async () => {
      // Alice deposits into tornado pool
      const fee = 1e6;

      const aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
      const inputs: Utxo[] = [];
      const outputs = [aliceDepositUtxo];

      const tx = await idAnchor.transact(
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        alice.address,
        relayer,
        '',
        {},
        { keypair: aliceKeypair }
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

      const receipt: ContractReceipt = (await idAnchor.transact(
        [],
        [aliceTransferUtxo],
        fee,
        BigNumber.from(0),
        alice.address,
        relayer,
        '',
        {},
        { keypair: aliceKeypair }
      )) as ContractReceipt;

      // Bob queries encrypted commitments on chain
      const encryptedCommitments: string[] = receipt.events
        .filter((event) => event.event === 'NewCommitment')
        .sort((a, b) => a.args.index - b.args.index)
        .map((e) => e.args.encryptedOutput);

      // Attempt to decrypt the encrypted commitments with bob's keypair
      const utxos = await Promise.all(
        encryptedCommitments.map(async (enc, index) => {
          try {
            const decryptedUtxo = await CircomUtxo.decrypt(bobKeypair, enc);
            // In order to properly calculate the nullifier, an index is required.
            decryptedUtxo.setIndex(index);
            // Set the originChainId for proving (decrypted will be an input utxo)
            decryptedUtxo.setOriginChainId(chainID.toString());
            const alreadySpent = await idAnchor.contract.isSpent(
              toFixedHex('0x' + decryptedUtxo.nullifier)
            );
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
        spendableUtxos,
        dummyOutputs,
        fee,
        BigNumber.from(0),
        bob.address,
        relayer,
        '',
        {},
        { keypair: bobKeypair }
      );

      const aliceBalanceAfter = await token.balanceOf(alice.address);
      const bobBalanceAfter = await token.balanceOf(bob.address);

      expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).equal(
        (Number(fee) + aliceDepositAmount).toString()
      );
      expect(bobBalanceAfter.sub(bobBalanceBefore).toString()).equal(
        (aliceDepositAmount - Number(fee)).toString()
      );
    });

    describe('## Alice already deposited:', () => {
      let aliceBalanceBeforeDeposit: BigNumber;
      let aliceBalanceAfterDeposit: BigNumber;

      beforeEach(async () => {
        aliceBalanceBeforeDeposit = await token.balanceOf(alice.address);
        const tx = await idAnchor.transact(
          [],
          [aliceDepositUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );
        const aliceDepositIndex = idAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);
        aliceDepositUtxo.setIndex(aliceDepositIndex);
        aliceBalanceAfterDeposit = await token.balanceOf(alice.address);
        expect(aliceBalanceAfterDeposit).equal(
          aliceBalanceBeforeDeposit.sub(aliceDepositAmount).sub(fee)
        );
        expect(tx)
          .to.emit(idAnchor.contract, 'NewCommitment')
          .withArgs(aliceDepositUtxo.commitment, 0, aliceDepositUtxo.encrypt());
      });
      it('should spend input utxo and create output utxo', async () => {
        // Alice deposits into tornado pool
        const aliceRefreshUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: BigNumber.from(chainID).toString(),
          originChainId: BigNumber.from(chainID).toString(),
          amount: BigNumber.from(aliceDepositAmount).toString(),
          blinding: hexToU8a(randomBN().toHexString()),
          keypair: aliceDepositUtxo.keypair,
        });

        await idAnchor.transact(
          [aliceDepositUtxo],
          [aliceRefreshUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );
      });
      it('Should be able to generate proof using leavesMap', async () => {
        // Alice deposits into tornado pool
        const aliceRefreshUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: BigNumber.from(chainID).toString(),
          originChainId: BigNumber.from(chainID).toString(),
          amount: BigNumber.from(aliceDepositAmount).toString(),
          blinding: hexToU8a(randomBN().toHexString()),
          keypair: aliceDepositUtxo.keypair,
        });

        const leaves = idAnchor.tree.elements().map((el) => hexToU8a(el.toHexString()));
        const leavesMap = { [chainID]: leaves };
        const txOptions = { keypair: aliceKeypair, treeChainId: chainID.toString() };
        await idAnchor.transact(
          [aliceDepositUtxo],
          [aliceRefreshUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          leavesMap,
          txOptions
        );
      });

      it('should prevent double spend', async () => {
        const aliceTransferUtxo = await generateUTXOForTest(
          chainID,
          aliceKeypair,
          aliceDepositAmount
        );

        await idAnchor.transact(
          [aliceDepositUtxo],
          [aliceTransferUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );

        const aliceDoubleSpendTransaction = await generateUTXOForTest(
          chainID,
          aliceKeypair,
          aliceDepositAmount
        );

        expect(
          idAnchor.transact(
            [aliceDepositUtxo],
            [aliceDoubleSpendTransaction],
            fee,
            BigNumber.from(0),
            alice.address,
            relayer,
            '',
            {},
            { keypair: aliceKeypair }
          )
        ).to.revertedWith('Input is already spent');
      });

      it('should prevent increasing UTXO amount without depositing', async () => {
        const aliceOutputAmount = aliceBalanceAfterDeposit.mul(2);
        const aliceOutputUtxo = await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainID.toString(),
          originChainId: chainID.toString(),
          amount: aliceOutputAmount.toString(),
          keypair: aliceDepositUtxo.keypair,
        });
        //Step 4: Check that step 3 fails
        await expect(
          idAnchor.transact(
            [aliceDepositUtxo],
            [aliceOutputUtxo],
            fee,
            BigNumber.from(0),
            alice.address,
            relayer,
            '',
            {},
            { keypair: aliceKeypair }
          )
        ).to.revertedWith('ERC20: transfer amount exceeds balance');
      });
      it('should join and spend', async () => {
        const aliceBalanceAfterFirstDeposit = await token.balanceOf(alice.address);
        expect(aliceBalanceBeforeDeposit.sub(aliceBalanceAfterFirstDeposit).toString()).equal(
          '10000000'
        );
        const aliceDepositAmount2 = 2e7;
        let aliceDepositUtxo2 = await generateUTXOForTest(
          chainID,
          aliceKeypair,
          aliceDepositAmount2
        );

        await idAnchor.transact(
          [],
          [aliceDepositUtxo2],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );
        const aliceBalanceAfterSecondDeposit = await token.balanceOf(alice.address);
        expect(aliceBalanceAfterFirstDeposit.sub(aliceBalanceAfterSecondDeposit).toString()).equal(
          '20000000'
        );

        const aliceDeposit2Index = idAnchor.tree.getIndexByElement(aliceDepositUtxo2.commitment);
        aliceDepositUtxo2.setIndex(aliceDeposit2Index);

        const aliceJoinAmount = 3e7;
        const aliceJoinUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceJoinAmount);
        await idAnchor.transact(
          [aliceDepositUtxo, aliceDepositUtxo2],
          [aliceJoinUtxo],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );
        const aliceBalanceAfterJoin = await token.balanceOf(alice.address);
        expect(aliceBalanceBeforeDeposit.sub(aliceBalanceAfterJoin).toString()).equal('30000000');
      });
      it('should spend input utxo and split', async () => {
        // Alice deposits into tornado pool
        const aliceSplitAmount = aliceDepositAmount / 2;
        const aliceSplitUtxo1 = await generateUTXOForTest(chainID, aliceKeypair, aliceSplitAmount);
        const aliceSplitUtxo2 = await generateUTXOForTest(chainID, aliceKeypair, aliceSplitAmount);

        await idAnchor.transact(
          [aliceDepositUtxo],
          [aliceSplitUtxo1, aliceSplitUtxo2],
          fee,
          BigNumber.from(0),
          alice.address,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );

        // alice shouldn't have deposited into tornado as input utxo has enough
        const aliceBalanceAfterSplit = await token.balanceOf(alice.address);
        expect(aliceBalanceAfterDeposit.sub(aliceBalanceAfterSplit).toString()).equal('0');
      });

      it('should withdraw', async () => {
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

        const tx = await idAnchor.transact(
          [aliceDepositUtxo],
          [aliceChangeUtxo],
          fee,
          BigNumber.from(0),
          aliceETHAddress,
          relayer,
          '',
          {},
          { keypair: aliceKeypair }
        );

        expect(aliceWithdrawAmount.toString()).equal(
          (await token.balanceOf(aliceETHAddress)).toString()
        );
      });
    });

    it('should reject proofs made against VAnchor empty edges', async () => {
      await expect(idAnchor.contract.edgeList(BigNumber.from(0))).reverted;
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const depositAmount = 1e8;
      const depositUtxo = await generateUTXOForTest(chainID, aliceKeypair, depositAmount);
      const fakeChainId = getChainIdType(666);
      const fakeUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: fakeChainId.toString(),
        amount: BigNumber.from(depositAmount).toString(),
        blinding: hexToU8a(randomBN(31).toHexString()),
        keypair: aliceKeypair,
      });

      const inputs: Utxo[] = [fakeUtxo, await generateUTXOForTest(chainID, new Keypair())];
      const outputs = [depositUtxo, await generateUTXOForTest(chainID, new Keypair())];
      const fakeTree = new MerkleTree(idAnchor.tree.levels);
      const fakeCommitment = u8aToHex(fakeUtxo.commitment);
      fakeTree.insert(fakeCommitment);
      const fakeIdx = fakeTree.indexOf(fakeCommitment);
      const fakeMerkleProofs = [fakeTree.path(fakeIdx), idAnchor.getMerkleProof(inputs[1])];

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

      const extAmount = BigNumber.from(0);
      const extDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        alice.address,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const fakeRoots = vanchorRoots;
      fakeRoots[1] = fakeTree.root().toString();
      const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
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

      const identityRootInputs = group.getRoots().map((bignum: BigNumber) => bignum.toString());
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
            element: BigNumber.from(defaultRoot),
            merkleRoot: BigNumber.from(defaultRoot),
          };
        }
      });

      const fullProof = await idAnchor.generateProof(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        extDataHash.toString(),
        vanchorInput
      );
      const proof = await idAnchor.generateProofCalldata(fullProof);
      const vKey = await snarkjs.zKey.exportVerificationKey(idAnchor.smallCircuitZkComponents.zkey);
      const calldata = await snarkjs.groth16.exportSolidityCallData(
        fullProof.proof,
        fullProof.publicSignals
      );

      const publicInputs: IVariableAnchorPublicInputs = idAnchor.generatePublicInputs(
        proof,
        calldata
      );

      const is_valid: boolean = await snarkjs.groth16.verify(
        vKey,
        fullProof.publicSignals,
        fullProof.proof
      );
      expect(is_valid).equals(true);
      const tx = idAnchor.contract.transact(
        publicInputs.proof,
        ZERO_BYTES32,
        {
          recipient: extData.recipient,
          extAmount: extData.extAmount,
          relayer: extData.relayer,
          fee: extData.fee,
          refund: extData.refund,
          token: extData.token,
        },
        {
          roots: publicInputs.roots,
          extensionRoots: publicInputs.extensionRoots,
          inputNullifiers: publicInputs.inputNullifiers,
          outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]],
          publicAmount: publicInputs.publicAmount,
          extDataHash: publicInputs.extDataHash,
        },
        {
          encryptedOutput1: encOutput1,
          encryptedOutput2: encOutput2,
        },
        { gasLimit: '0x5B8D80' }
      );
      await expect(tx).revertedWith('non-existent edge is not set to the default root');
    });
    it('should reject proofs made against Semaphore empty edges', async () => {
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const depositAmount = 1e7;
      // Carl has not been registered
      const carlDepositUtxo = await generateUTXOForTest(chainID, carlKeypair, depositAmount);
      const inputs: Utxo[] = [
        await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const outputs = [carlDepositUtxo, await generateUTXOForTest(chainID, new Keypair())];
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

      const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
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
      const fakeGroup = new LinkedGroup(levels, maxEdges, BigInt(defaultRoot));
      fakeGroup.addMember(carlLeaf);

      const identityRootInputs = group.getRoots().map((bignum: BigNumber) => bignum.toString());
      identityRootInputs[1] = fakeGroup.root.toString();
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
            element: BigNumber.from(defaultRoot),
            merkleRoot: BigNumber.from(defaultRoot),
          };
        }
      });

      const fullProof = await idAnchor.generateProof(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        extDataHash.toString(),
        vanchorInput
      );
      const proof = await idAnchor.generateProofCalldata(fullProof);
      const vKey = await snarkjs.zKey.exportVerificationKey(idAnchor.smallCircuitZkComponents.zkey);
      const calldata = await snarkjs.groth16.exportSolidityCallData(
        fullProof.proof,
        fullProof.publicSignals
      );

      const publicInputs: IVariableAnchorPublicInputs = idAnchor.generatePublicInputs(
        proof,
        calldata
      );

      const is_valid: boolean = await snarkjs.groth16.verify(
        vKey,
        fullProof.publicSignals,
        fullProof.proof
      );
      expect(is_valid).equals(true);

      const tx = idAnchor.contract.transact(
        publicInputs.proof,
        ZERO_BYTES32,
        {
          recipient: extData.recipient,
          extAmount: extData.extAmount,
          relayer: extData.relayer,
          fee: extData.fee,
          refund: extData.refund,
          token: extData.token,
        },
        {
          roots: publicInputs.roots,
          extensionRoots: publicInputs.extensionRoots,
          inputNullifiers: publicInputs.inputNullifiers,
          outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]],
          publicAmount: publicInputs.publicAmount,
          extDataHash: publicInputs.extDataHash,
        },
        {
          encryptedOutput1: encOutput1,
          encryptedOutput2: encOutput2,
        },
        { gasLimit: '0x5B8D80' }
      );

      await expect(tx).revertedWith('non-existent edge is not set to the default root');
    });
  });

  describe('# prevent tampering', () => {
    // before('Create valid public inputs as baseline for tampering', async () => {
    const relayer = '0x2111111111111111111111111111111111111111';
    const extAmount = 1e7;
    const aliceDepositAmount = 1e7;

    let publicInputs: IVariableAnchorPublicInputs;
    let aliceExtData: any;

    let encOutput1: string;
    let encOutput2: string;

    // should be before but it says idAnchor is undefined in this case
    beforeEach(async () => {
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      const inputs: Utxo[] = [
        await generateUTXOForTest(chainID, new Keypair()),
        await generateUTXOForTest(chainID, new Keypair()),
      ];
      const outputs = [aliceDepositUtxo, await generateUTXOForTest(chainID, new Keypair())];
      const merkleProofsForInputs = inputs.map((x) => idAnchor.getMerkleProof(x));

      fee = BigInt(0);

      encOutput1 = outputs[0].encrypt();
      encOutput2 = outputs[1].encrypt();

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

      const aliceExtDataHash = getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        alice.address,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
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

      const identityRootInputs = group.getRoots().map((bignum: BigNumber) => bignum.toString());
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
            merkleRoot: BigNumber.from(defaultRoot),
            element: BigNumber.from(defaultRoot),
          };
        }
      });

      const fullProof = await idAnchor.generateProof(
        aliceKeypair,
        identityRootInputs,
        identityMerkleProof,
        outSemaphoreProofs,
        aliceExtDataHash.toString(),
        vanchorInput
      );
      const proof = await idAnchor.generateProofCalldata(fullProof);
      const vKey = await snarkjs.zKey.exportVerificationKey(idAnchor.smallCircuitZkComponents.zkey);
      const calldata = await snarkjs.groth16.exportSolidityCallData(
        fullProof.proof,
        fullProof.publicSignals
      );

      publicInputs = idAnchor.generatePublicInputs(proof, calldata);
      const is_valid: boolean = await snarkjs.groth16.verify(
        vKey,
        fullProof.publicSignals,
        fullProof.proof
      );
      expect(is_valid).equals(true);
    });
    it('should reject tampering with public amount', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.publicAmount = toFixedHex(BigNumber.from(1e10));

      await expect(
        idAnchor.contract.transact(
          invalidInputs.proof,
          ZERO_BYTES32,
          {
            recipient: aliceExtData.recipient,
            extAmount: aliceExtData.extAmount,
            relayer: aliceExtData.relayer,
            fee: aliceExtData.fee,
            refund: aliceExtData.refund,
            token: aliceExtData.token,
          },
          {
            roots: invalidInputs.roots,
            extensionRoots: invalidInputs.extensionRoots,
            inputNullifiers: invalidInputs.inputNullifiers,
            outputCommitments: [
              invalidInputs.outputCommitments[0],
              invalidInputs.outputCommitments[1],
            ],
            publicAmount: invalidInputs.publicAmount,
            extDataHash: invalidInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.revertedWith('Invalid public amount');
    });
    it('should reject tampering with external data hash', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.extDataHash = BigNumber.from(publicInputs.extDataHash).add(1);

      await expect(
        idAnchor.contract.transact(
          invalidInputs.proof,
          ZERO_BYTES32,
          {
            recipient: aliceExtData.recipient,
            extAmount: aliceExtData.extAmount,
            relayer: aliceExtData.relayer,
            fee: aliceExtData.fee,
            refund: aliceExtData.refund,
            token: aliceExtData.token,
          },
          {
            roots: invalidInputs.roots,
            extensionRoots: invalidInputs.extensionRoots,
            inputNullifiers: invalidInputs.inputNullifiers,
            outputCommitments: [
              invalidInputs.outputCommitments[0],
              invalidInputs.outputCommitments[1],
            ],
            publicAmount: invalidInputs.publicAmount,
            extDataHash: invalidInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.be.revertedWith('Incorrect external data hash');
    });

    it('should reject tampering with output commitments', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.outputCommitments[0] = BigNumber.from(publicInputs.outputCommitments[0]).add(1);
      await expect(
        idAnchor.contract.transact(
          invalidInputs.proof,
          ZERO_BYTES32,
          {
            recipient: aliceExtData.recipient,
            extAmount: aliceExtData.extAmount,
            relayer: aliceExtData.relayer,
            fee: aliceExtData.fee,
            refund: aliceExtData.refund,
            token: aliceExtData.token,
          },
          {
            roots: invalidInputs.roots,
            extensionRoots: invalidInputs.extensionRoots,
            inputNullifiers: invalidInputs.inputNullifiers,
            outputCommitments: [
              invalidInputs.outputCommitments[0],
              invalidInputs.outputCommitments[1],
            ],
            publicAmount: invalidInputs.publicAmount,
            extDataHash: invalidInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.be.revertedWith('Invalid withdraw proof');
    });
    it('should reject tampering with input commitments', async () => {
      const invalidInputs = publicInputs;
      invalidInputs.inputNullifiers[0] = BigNumber.from(publicInputs.inputNullifiers[0]).add(1);

      await expect(
        idAnchor.contract.transact(
          invalidInputs.proof,
          ZERO_BYTES32,
          {
            recipient: aliceExtData.recipient,
            extAmount: aliceExtData.extAmount,
            relayer: aliceExtData.relayer,
            fee: aliceExtData.fee,
            refund: aliceExtData.refund,
            token: aliceExtData.token,
          },
          {
            roots: invalidInputs.roots,
            extensionRoots: invalidInputs.extensionRoots,
            inputNullifiers: invalidInputs.inputNullifiers,
            outputCommitments: [
              invalidInputs.outputCommitments[0],
              invalidInputs.outputCommitments[1],
            ],
            publicAmount: invalidInputs.publicAmount,
            extDataHash: invalidInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.be.revertedWith('Invalid withdraw proof');
    });

    it('should reject tampering with extData relayer', async () => {
      const invalidExtData = aliceExtData;
      invalidExtData.relayer = toFixedHex(
        '0x0000000000000000000000007a1f9131357404ef86d7c38dbffed2da70321337',
        20
      );
      await expect(
        idAnchor.contract.transact(
          publicInputs.proof,
          ZERO_BYTES32,
          {
            recipient: invalidExtData.recipient,
            extAmount: invalidExtData.extAmount,
            relayer: invalidExtData.relayer,
            fee: invalidExtData.fee,
            refund: invalidExtData.refund,
            token: invalidExtData.token,
          },
          {
            roots: publicInputs.roots,
            extensionRoots: publicInputs.extensionRoots,
            inputNullifiers: publicInputs.inputNullifiers,
            outputCommitments: [
              publicInputs.outputCommitments[0],
              publicInputs.outputCommitments[1],
            ],
            publicAmount: publicInputs.publicAmount,
            extDataHash: publicInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.be.revertedWith('Incorrect external data hash');
    });
    it('should reject tampering with extData extAmount', async () => {
      const invalidExtData = aliceExtData;
      invalidExtData.extAmount = toFixedHex(aliceDepositAmount * 100, 20);
      await expect(
        idAnchor.contract.transact(
          publicInputs.proof,
          ZERO_BYTES32,
          {
            recipient: invalidExtData.recipient,
            extAmount: invalidExtData.extAmount,
            relayer: invalidExtData.relayer,
            fee: invalidExtData.fee,
            refund: invalidExtData.refund,
            token: invalidExtData.token,
          },
          {
            roots: publicInputs.roots,
            extensionRoots: publicInputs.extensionRoots,
            inputNullifiers: publicInputs.inputNullifiers,
            outputCommitments: [
              publicInputs.outputCommitments[0],
              publicInputs.outputCommitments[1],
            ],
            publicAmount: publicInputs.publicAmount,
            extDataHash: publicInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.be.revertedWith('Incorrect external data hash');
    });
    it('should reject tampering with extData fee', async () => {
      const invalidExtData = aliceExtData;
      invalidExtData.fee = toFixedHex(fee + BigInt(1000), 20);
      await expect(
        idAnchor.contract.transact(
          publicInputs.proof,
          ZERO_BYTES32,
          {
            recipient: invalidExtData.recipient,
            extAmount: invalidExtData.extAmount,
            relayer: invalidExtData.relayer,
            fee: invalidExtData.fee,
            refund: invalidExtData.refund,
            token: invalidExtData.token,
          },
          {
            roots: publicInputs.roots,
            extensionRoots: publicInputs.extensionRoots,
            inputNullifiers: publicInputs.inputNullifiers,
            outputCommitments: [
              publicInputs.outputCommitments[0],
              publicInputs.outputCommitments[1],
            ],
            publicAmount: publicInputs.publicAmount,
            extDataHash: publicInputs.extDataHash,
          },
          {
            encryptedOutput1: encOutput1,
            encryptedOutput2: encOutput2,
          },
          { gasLimit: '0x5B8D80' }
        )
      ).to.be.revertedWith('Incorrect external data hash');
    });
  });
  describe('#transact and wrap', () => {
    let wrappedIdAnchor: IdentityVAnchor;
    let wrapFee: number = 0; // between 0-10000

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      // create poseidon hasher
      const hasherInstance = await PoseidonHasher.createPoseidonHasher(wallet);

      const name = 'webbETH';
      const symbol = 'webbETH';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(alice);
      wrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await wrappedToken.deployed();
      await wrappedToken.initialize(
        0,
        dummyFeeRecipient,
        alice.address,
        '10000000000000000000000000',
        true,
        wallet.address
      );
      await wrappedToken.add(token.address, (await wrappedToken.proposalNonce()).add(1));
      const groupId = BigNumber.from(99); // arbitrary
      await wrappedToken.setFee(wrapFee, (await wrappedToken.proposalNonce()).add(1));

      wrappedIdAnchor = await IdentityVAnchor.createIdentityVAnchor(
        semaphore,
        verifier.contract.address,
        levels,
        hasherInstance.contract.address,
        alice.address,
        wrappedToken.address,
        maxEdges,
        groupId,
        group,
        zkComponents2_2,
        zkComponents16_2,
        alice
      );

      await wrappedIdAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
      await wrappedIdAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        2
      );
      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await wrappedToken.grantRole(MINTER_ROLE, wrappedIdAnchor.contract.address);
      await token.approve(wrappedToken.address, '10000000000000000000');
    });

    it('should wrap and deposit and transact', async () => {
      const balTokenBeforeDepositSender = await token.balanceOf(alice.address);
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount = 1e7;
      let aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      await wrappedIdAnchor.transact(
        [],
        [aliceDepositUtxo],
        BigNumber.from(0),
        BigNumber.from(0),
        '0',
        relayer,
        token.address,
        {},
        { keypair: aliceKeypair }
      );
      const balTokenAfterDepositSender = await token.balanceOf(alice.address);
      expect(balTokenBeforeDepositSender.sub(balTokenAfterDepositSender)).equal(aliceDepositAmount);

      const balWrappedTokenAfterDepositAnchor = await wrappedToken.balanceOf(
        wrappedIdAnchor.contract.address
      );
      const balWrappedTokenAfterDepositSender = await wrappedToken.balanceOf(alice.address);
      expect(balWrappedTokenAfterDepositAnchor.toString()).equal('10000000');
      expect(balWrappedTokenAfterDepositSender.toString()).equal('0');
      const aliceDepositIndex = wrappedIdAnchor.tree.getIndexByElement(aliceDepositUtxo.commitment);

      aliceDepositUtxo.setIndex(aliceDepositIndex);

      //Check that vAnchor has the right amount of wrapped token balance
      expect((await wrappedToken.balanceOf(wrappedIdAnchor.contract.address)).toString()).equal(
        BigNumber.from(1e7).toString()
      );

      const aliceChangeAmount = 0;
      const aliceChangeUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceChangeAmount);

      await wrappedIdAnchor.transact(
        [aliceDepositUtxo],
        [aliceChangeUtxo],
        BigNumber.from(0),
        BigNumber.from(0),
        alice.address,
        relayer,
        token.address,
        {},
        { keypair: aliceKeypair }
      );

      const balTokenAfterWithdrawAndUnwrapSender = await token.balanceOf(alice.address);
      expect(balTokenBeforeDepositSender).equal(balTokenAfterWithdrawAndUnwrapSender);
      expect(balTokenAfterWithdrawAndUnwrapSender).equal(balTokenBeforeDepositSender);
    });
  });
  describe('#cross-chain test', () => {
    const SECOND_CHAIN_ID = 10100;
    const chainID2 = getChainIdType(SECOND_CHAIN_ID);
    let ganacheServer: any;
    let ganacheAnchor: IdentityVAnchor;
    let ganacheProvider = new ethers.providers.JsonRpcProvider(
      `http://localhost:${SECOND_CHAIN_ID}`
    );
    ganacheProvider.pollingInterval = 1;
    let ganacheWallet = new ethers.Wallet(
      'c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
      ganacheProvider
    );

    let ganacheGroup: LinkedGroup;
    let ganacheVerifier: IdentityVerifier;
    let ganacheToken: ERC20PresetMinterPauser;
    let ganacheWrappedToken: WrappedToken;
    let ganacheSemaphore: Semaphore;
    let johnKeypair = new Keypair();
    const groupId = BigNumber.from(99); // arbitrary
    let john = ganacheWallet;

    before('start ganache server', async () => {
      ganacheServer = await startGanacheServer(SECOND_CHAIN_ID, SECOND_CHAIN_ID, [
        {
          balance: '0x1000000000000000000000',
          secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
        },
      ]);
      await ganacheProvider.ready;
    });
    beforeEach(async () => {
      const ganacheHasherInstance = await PoseidonHasher.createPoseidonHasher(ganacheWallet);

      // create bridge verifier
      ganacheVerifier = await IdentityVerifier.createVerifier(ganacheWallet);

      // create token
      const tokenFactory = new ERC20PresetMinterPauser__factory(ganacheWallet);
      ganacheToken = await tokenFactory.deploy('test token 2', 'TEST 2');
      await ganacheToken.deployed();
      await ganacheToken.mint(ganacheWallet.address, '10000000000000000000000');
      await ganacheToken.mint(alice.address, BigNumber.from(1e10).toString());
      await ganacheToken.mint(bob.address, BigNumber.from(1e10).toString());
      await ganacheToken.mint(carl.address, BigNumber.from(1e10).toString());

      // create wrapped token
      const name = 'webbETH2';
      const symbol = 'webbETH2';
      const dummyFeeRecipient = '0x0000000000010000000010000000000000000000';
      const wrappedTokenFactory = new WrappedTokenFactory(ganacheWallet);
      ganacheWrappedToken = await wrappedTokenFactory.deploy(name, symbol);
      await ganacheWrappedToken.deployed();
      await ganacheWrappedToken.initialize(
        0,
        dummyFeeRecipient,
        ganacheWallet.address,
        '10000000000000000000000000',
        true,
        ganacheWallet.address
      );
      await ganacheWrappedToken.add(
        ganacheToken.address,
        (await ganacheWrappedToken.proposalNonce()).add(1)
      );
      ganacheSemaphore = await Semaphore.createSemaphore(
        levels,
        zkComponents2_2,
        zkComponents2_2,
        ganacheWallet
      );
      const groupId = BigNumber.from(99); // arbitrary

      const tx = await ganacheSemaphore.createGroup(
        groupId.toNumber(),
        levels,
        ganacheWallet.address,
        maxEdges
      );
      let johnLeaf = johnKeypair.getPubKey();
      ganacheGroup = new LinkedGroup(levels, maxEdges, BigInt(defaultRoot));
      ganacheGroup.addMember(johnLeaf);
      let john_addmember_tx = await ganacheSemaphore.contract
        .connect(ganacheWallet)
        .addMember(groupId, johnLeaf, { gasLimit: '0x5B8D80' });
      // const receipt = await alice_addmember_tx.wait();
      expect(john_addmember_tx)
        .to.emit(ganacheSemaphore.contract, 'MemberAdded')
        .withArgs(groupId, johnLeaf, ganacheGroup.root);

      await ganacheSemaphore.updateEdge(groupId.toNumber(), group.root.toString(), 2, chainID);

      // update group edges cross-chain
      ganacheGroup.updateEdge(chainID, group.root.toString());

      await semaphore.updateEdge(groupId.toNumber(), ganacheGroup.root.toString(), 0, chainID2);

      group.updateEdge(chainID2, ganacheGroup.root.toString());
      // create Anchor
      ganacheAnchor = await IdentityVAnchor.createIdentityVAnchor(
        ganacheSemaphore,
        ganacheVerifier.contract.address,
        levels,
        ganacheHasherInstance.contract.address,
        ganacheWallet.address,
        ganacheToken.address,
        1,
        groupId,
        ganacheGroup,
        zkComponents2_2,
        zkComponents16_2,
        ganacheWallet
      );

      await ganacheAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(0), 1);
      await ganacheAnchor.contract.configureMaximumDepositLimit(
        BigNumber.from(tokenDenomination).mul(1_000_000),
        2
      );

      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await ganacheWrappedToken.grantRole(MINTER_ROLE, ganacheAnchor.contract.address);
      await ganacheToken.approve(ganacheWrappedToken.address, '1000000000000000000000000');
      await ganacheToken.approve(ganacheAnchor.contract.address, '1000000000000000000000000');
    });
    it('should initialize', async () => {
      const maxEdges = await ganacheAnchor.contract.maxEdges();
      expect(maxEdges.toString()).to.equal(`1`);
    });
    it('john should be able to deposit on chainB', async () => {
      const relayer = '0x2111111111111111111111111111111111111111';
      const johnDepositAmount = 1e7;
      const johnDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID2.toString(),
        originChainId: chainID2.toString(),
        amount: johnDepositAmount.toString(),
        blinding: hexToU8a(randomBN(31).toHexString()),
        keypair: johnKeypair,
      });
      // John deposits into tornado pool
      const inputs: Utxo[] = [];
      const outputs = [johnDepositUtxo];
      const txOptions: TransactionOptions = { keypair: johnKeypair };
      await ganacheAnchor.transact(
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        ganacheWallet.address,
        relayer,
        '',
        {},
        { gasLimit: '0x5B8D80', ...txOptions }
      );
    });
    it('john should be able to deposit on chainA', async () => {
      const relayer = '0x2111111111111111111111111111111111111111';
      const johnDepositAmount = 1e7;
      const johnDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID2.toString(),
        originChainId: chainID2.toString(),
        amount: johnDepositAmount.toString(),
        blinding: hexToU8a(randomBN(31).toHexString()),
        keypair: johnKeypair,
      });
      // Alice deposits into tornado pool
      await token.mint(john.address, BigNumber.from(1e10).toString());
      const txOptions: TransactionOptions = {
        keypair: johnKeypair,
        externalLeaves: ganacheGroup.members.map((bignum: BigNumber) =>
          hexToU8a(bignum.toHexString())
        ),
      };

      await idAnchor.transact(
        [],
        [johnDepositUtxo],
        fee,
        BigNumber.from(0),
        john.address,
        relayer,
        '',
        {},
        { gasLimit: '0x5B8D80', ...txOptions }
      );
    });
    it('john should be able to withdraw on chainA', async () => {
      const relayer = '0x2111111111111111111111111111111111111111';
      const johnDepositAmount = 1e7;
      const johnDepositUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: chainID.toString(),
        originChainId: chainID2.toString(),
        amount: johnDepositAmount.toString(),
        blinding: hexToU8a(randomBN(31).toHexString()),
        keypair: johnKeypair,
      });
      // john deposits into tornado pool
      const johnBalanceBeforeDeposit = await ganacheToken.balanceOf(john.address);
      const txOptions: TransactionOptions = { keypair: johnKeypair };
      await ganacheAnchor.transact(
        [],
        [johnDepositUtxo],
        fee,
        BigNumber.from(0),
        ganacheWallet.address,
        relayer,
        '',
        {},
        { gasLimit: '0x5B8D80', ...txOptions }
      );

      await idAnchor.contract.updateEdge(
        ganacheAnchor.tree.root().toString(),
        0,
        toFixedHex(ganacheAnchor.contract.address + chainID2)
      );

      const johnBalanceAfterDeposit = await ganacheToken.balanceOf(john.address);
      expect(johnBalanceAfterDeposit).to.equal(
        johnBalanceBeforeDeposit.sub(BigInt(johnDepositAmount) + fee)
      );

      const johnWithdrawAmount = 5e6;
      const johnWithdrawUtxo = await CircomUtxo.generateUtxo({
        curve: 'Bn254',
        backend: 'Circom',
        chainId: BigNumber.from(chainID).toString(),
        originChainId: BigNumber.from(chainID).toString(),
        amount: BigNumber.from(johnWithdrawAmount).toString(),
        blinding: hexToU8a(randomBN().toHexString()),
        keypair: johnDepositUtxo.keypair,
      });
      const txOptions2: TransactionOptions = {
        keypair: johnKeypair,
        externalLeaves: ganacheGroup.members.map((bignum: BigNumber) =>
          hexToU8a(bignum.toHexString())
        ),
        treeChainId: chainID2.toString(),
      };
      await token.mint(idAnchor.contract.address, BigNumber.from(1e10).toString());
      const leaves = ganacheAnchor.tree.elements().map((el) => hexToU8a(el.toHexString()));
      const leavesMap = { [chainID2]: leaves };

      const johnBalanceBeforeWithdraw = await token.balanceOf(john.address);

      await idAnchor.transact(
        [johnDepositUtxo],
        [johnWithdrawUtxo],
        fee,
        BigNumber.from(0),
        john.address,
        relayer,
        '',
        leavesMap,
        { gasLimit: '0x5B8D80', ...txOptions2 }
      );
      const johnBalanceAfterWithdraw = await token.balanceOf(john.address);
      expect(johnBalanceAfterWithdraw).to.equal(
        johnBalanceBeforeWithdraw.add(BigInt(johnWithdrawAmount) - fee)
      );
    });
    after('terminate networks', async () => {
      await ganacheServer.close();
    });
  });
});
