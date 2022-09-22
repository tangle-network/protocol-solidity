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
import { Semaphore } from '@semaphore-anchor/semaphore';
import { Group } from '@semaphore-anchor/group';
import { writeFileSync } from 'fs';

const BN = require('bn.js');

const path = require('path');
const { poseidon } = require('circomlibjs');
const snarkjs = require('snarkjs');
const { toBN } = require('web3-utils');

const updateUtxoWithIndex = async (inputUtxo: Utxo, index: number, originChain: number): Promise<Utxo> => {
  const utxoString = inputUtxo.serialize();
  const parts = utxoString.split('&');
  parts[4] = index.toString();
  const outputUtxo = await CircomUtxo.deserialize(parts.join('&'));
  outputUtxo.setOriginChainId(originChain.toString());

  return outputUtxo;
};

describe('IdentityVAnchor for 2 max edges', () => {
  let idAnchor: IdentityVAnchor;
  let semaphore: Semaphore;
  let semaphoreContract: SemaphoreContract;

  const levels = 30;
  const defaultRoot = BigInt('21663839004416932945382355908790599225266501822907911457504978515578255421292');
  let fee = BigInt(new BN(`100000000000000000`).toString());
  let recipient = '0x1111111111111111111111111111111111111111';
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
  let aliceExtData: any;
  let aliceExtDataHash: any;
  let alicePublicSignals: any;
  let bobKeypair: Keypair;
  let carlKeypair: Keypair;

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
    await token.mint(sender.address, '10000000000000000000000');

    // create Anchor
    semaphore = await Semaphore.createSemaphore(levels, maxEdges, zkComponents2_2, sender);
    semaphoreContract = semaphore.contract;

    const groupId = BigNumber.from(99); // arbitrary
    const tx = await semaphore.createGroup(groupId, sender.address, maxEdges, levels);

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
      sender.address,
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

      aliceExtData = {
        recipient: toFixedHex(recipient, 20),
        extAmount: toFixedHex(extAmount),
        relayer: toFixedHex(relayer, 20),
        fee: toFixedHex(fee),
        refund: toFixedHex(BigNumber.from(0).toString()),
        token: toFixedHex(token.address, 20),
        encOutput1,
        encOutput2,
      };

      aliceExtDataHash = await getVAnchorExtDataHash(
        encOutput1,
        encOutput2,
        extAmount.toString(),
        BigNumber.from(fee).toString(),
        recipient,
        relayer,
        BigNumber.from(0).toString(),
        token.address
      );

      const vanchor_input: UTXOInputs = await generateVariableWitnessInput(
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
        vanchor_input
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
    it('alice should deposit', async () => {
      // Alice deposits into tornado pool
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      const inputs: Utxo[] = [];
      const outputs = [aliceDepositUtxo];
      // , await generateUTXOForTest(chainID, new Keypair())];
      const res = await idAnchor.transact(
        aliceKeypair,
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );

      expect(res.tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[0].commitment, 0, aliceExtData.encOutput1);
      expect(res.tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[1].commitment, 1, aliceExtData.encOutput2);
      expect(res.tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[0].nullifier);
      expect(res.tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[1].nullifier);
    });

    it('should process fee on deposit', async () => {
      // Alice deposits into tornado pool
      let aliceLeaf = aliceKeypair.getPubKey();
      const relayer = '0x2111111111111111111111111111111111111111';
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const aliceDepositAmount = 1e7;
      const fee = 1e6;

      const aliceBalanceBeforeDeposit = await token.balanceOf(sender.address);
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      const inputs: Utxo[] = [];
      const outputs = [aliceDepositUtxo];

      const res = await idAnchor.transact(
        aliceKeypair,
        inputs,
        outputs,
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );

      expect(res.tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[0].commitment, 0, aliceExtData.encOutput1);
      expect(res.tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(outputs[1].commitment, 1, aliceExtData.encOutput2);
      expect(res.tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[0].nullifier);
      expect(res.tx).to.emit(idAnchor.contract, 'NewNullifier').withArgs(inputs[1].nullifier);

      //Step 2: Check Alice's balance
      const aliceBalanceAfterDeposit = await token.balanceOf(sender.address);
      expect(aliceBalanceAfterDeposit.toString()).equal(
        BN(toBN(aliceBalanceBeforeDeposit).sub(toBN(aliceDepositAmount)).sub(toBN(fee))).toString()
      );
      expect((await token.balanceOf(relayer)).toString()).equal(BigNumber.from(fee).toString());
    });

    // This test is meant to prove that utxo transfer flows are possible, and the receiver
    // can query on-chain data to construct and spend a utxo generated by the sender.
    it('alice should transfer to bob (bob is registered)', async function () {
      const [sender, recipient] = await ethers.getSigners();
      await idAnchor.setSigner(sender);
      const relayer = '0x2111111111111111111111111111111111111111';
      const vanchorRoots = await idAnchor.populateVAnchorRootsForProof();
      const aliceDepositAmount = 1e7;
      const aliceBalanceBefore = await token.balanceOf(sender.address);
      const bobBalanceBefore = await token.balanceOf(recipient.address);
      // const registeredKeydata: string = receipt.events[0].args.key;
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
      // console.log("alice transfer: ", aliceTransferUtxo)

      let { publicInputs, tx } = await idAnchor.transact(
        aliceKeypair,
        [],
        [aliceTransferUtxo],
        fee,
        BigNumber.from(0),
        recipient.address,
        relayer
      );
      writeFileSync("transfer.json", JSON.stringify(publicInputs))
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
            // The decrypt function generates a utxo without an index, and the index is a readonly property.
            // So, regenerate the utxo with the proper index.
            const regeneratedUtxo = await CircomUtxo.generateUtxo({
              amount: decryptedUtxo.amount.toString(),
              backend: 'Circom',
              blinding: hexToU8a(decryptedUtxo.blinding),
              chainId: decryptedUtxo.chainId,
              curve: 'Bn254',
              keypair: bobKeypair,
              index: index.toString(),
              originChainId: decryptedUtxo.chainId
            });
            const alreadySpent = await idAnchor.contract.isSpent(toFixedHex(regeneratedUtxo.nullifier, 32));
            if (!alreadySpent) {
              return regeneratedUtxo;
            } else {
              return undefined;
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
      let { publicInputs: bobPublicInputs, tx: bobTx } = await idAnchor.transact(
        bobKeypair,
        spendableUtxos,
        dummyOutputs,
        fee,
        BigNumber.from(0),
        recipient.address,
        relayer
      );

      const aliceBalanceAfter = await token.balanceOf(sender.address);
      const bobBalanceAfter = await token.balanceOf(recipient.address);

      expect(aliceBalanceBefore.sub(aliceBalanceAfter).toString()).equal('10000000');
      expect(bobBalanceAfter.sub(bobBalanceBefore).toString()).equal('10000000');
    });

    it('should spend input utxo and create output utxo', async () => {
      // Alice deposits into tornado pool
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount = 1e7;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      // , await generateUTXOForTest(chainID, new Keypair())];
      const res = await idAnchor.transact(
        aliceKeypair,
        [],
        [aliceDepositUtxo],
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );

      expect(res.tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(aliceDepositUtxo.commitment, 0, aliceExtData.encOutput1);

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
        recipient,
        relayer
      );
    });

    it('should spend input utxo and split', async () => {
      // Alice deposits into tornado pool
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount = 10;
      const aliceDepositUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount);
      // , await generateUTXOForTest(chainID, new Keypair())];
      const res = await idAnchor.transact(
        aliceKeypair,
        [],
        [aliceDepositUtxo],
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );

      expect(res.tx)
        .to.emit(idAnchor.contract, 'NewCommitment')
        .withArgs(aliceDepositUtxo.commitment, 0, aliceExtData.encOutput1);

      const aliceSplitAmount = 5;
      const aliceSplitUtxo1 = await generateUTXOForTest(chainID, aliceKeypair, aliceSplitAmount);
      const aliceSplitUtxo2 = await generateUTXOForTest(chainID, aliceKeypair, aliceSplitAmount);

      await idAnchor.transact(
        aliceKeypair,
        [aliceDepositUtxo],
        [aliceSplitUtxo1, aliceSplitUtxo2],
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );
    })

    it('should join and spend', async () => {
      const relayer = '0x2111111111111111111111111111111111111111';
      const aliceDepositAmount1 = 1e7;
      const aliceBalanceBeforeDeposit = await token.balanceOf(sender.address);
      let aliceDepositUtxo1 = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount1);

      await idAnchor.transact(
        aliceKeypair,
        [],
        [aliceDepositUtxo1],
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );

      const aliceBalanceAfterFirstDeposit = await token.balanceOf(sender.address);
      expect(aliceBalanceBeforeDeposit.sub(aliceBalanceAfterFirstDeposit).toString()).equal('10000000');
      const aliceDepositAmount2 = 1e7;
      let aliceDepositUtxo2 = await generateUTXOForTest(chainID, aliceKeypair, aliceDepositAmount2);

      await idAnchor.transact(
        aliceKeypair,
        [],
        [aliceDepositUtxo2],
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );

      const aliceJoinAmount = 2e7;
      const aliceJoinUtxo = await generateUTXOForTest(chainID, aliceKeypair, aliceJoinAmount);
      await idAnchor.transact(
        aliceKeypair,
        [aliceDepositUtxo1, aliceDepositUtxo2],
        [aliceJoinUtxo],
        fee,
        BigNumber.from(0),
        recipient,
        relayer
      );
    })
  });
});
