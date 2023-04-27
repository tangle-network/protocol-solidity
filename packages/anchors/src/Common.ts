import { BigNumberish, ContractReceipt, ethers } from 'ethers';
import { PayableOverrides } from '@ethersproject/contracts';
import {
  VAnchor as VAnchorContract,
  ChainalysisVAnchor as ChainalysisVAnchorContract,
  VAnchorForest as VAnchorForestContract,
  OpenVAnchor as OpenVAnchorContract,
  TokenWrapper__factory,
} from '@webb-tools/contracts';
import {
  toHex,
  Keypair,
  toFixedHex,
  Utxo,
  randomBN,
  UtxoGenInput,
  CircomUtxo,
  MerkleTree,
  getVAnchorExtDataHash,
} from '@webb-tools/sdk-core';
import { hexToU8a, getChainIdType, ZERO_BYTES32 } from '@webb-tools/utils';
import { checkNativeAddress, splitTransactionOptions } from './utils';
import { SetupTransactionResult, TransactionOptions } from './types';
import { IVariableAnchorExtData } from '@webb-tools/interfaces';
import { keccak256, toUtf8Bytes } from 'ethers/lib/utils';

type WebbContracts =
  | VAnchorContract
  | ChainalysisVAnchorContract
  | VAnchorForestContract
  | OpenVAnchorContract;

function isOpenVAnchorContract(contract: WebbContracts): contract is OpenVAnchorContract {
  return (
    'deposit' in contract &&
    'withdraw' in contract &&
    'wrapAndDeposit' in contract &&
    'unwrapAndWithdraw' in contract &&
    !('transact' in contract)
  );
}

export abstract class WebbBridge<A extends WebbContracts> {
  signer: ethers.Signer;
  contract: A;

  tree: MerkleTree;
  treeHeight: number;
  latestSyncedBlock: number;
  token?: string;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;

  constructor(contract: A, signer: ethers.Signer, treeHeight: number) {
    this.contract = contract;
    this.signer = signer;
    this.treeHeight = treeHeight;
    this.latestSyncedBlock = 0;
  }

  public static async generateUTXO(input: UtxoGenInput): Promise<Utxo> {
    return CircomUtxo.generateUtxo(input);
  }

  public static createRootsBytes(rootArray: string[]) {
    let rootsBytes = '0x';
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes)
  }

  getAddress(): string {
    return this.contract.address;
  }

  // Convert a hex string to a byte array
  public static hexStringToByte(str: string) {
    if (!str) {
      return new Uint8Array();
    }

    var a = [];
    for (var i = 0, len = str.length; i < len; i += 2) {
      a.push(parseInt(str.substr(i, 2), 16));
    }

    return new Uint8Array(a);
  }

  public async setHandler(handlerAddress: string) {
    const tx = await this.contract.setHandler(
      handlerAddress,
      BigInt((await this.contract.getProposalNonce()).toString()) + BigInt(1)
    );
    await tx.wait();
  }

  public async setSigner(newSigner: ethers.Signer) {
    const currentChainId = (await this.signer.provider!.getNetwork()).chainId;
    const newChainId = (await newSigner.provider!.getNetwork()).chainId;

    if (currentChainId === newChainId) {
      this.signer = newSigner;
      this.contract = this.contract.connect(newSigner) as A;
      return true;
    }
    return false;
  }

  public async createResourceId(): Promise<string> {
    const chainId = (await this.signer.provider!.getNetwork()).chainId;
    return toHex(
      (await this.contract.address) + toHex(getChainIdType(Number(chainId)), 6).substr(2),
      32
    );
  }

  public async getMinWithdrawalLimitProposalData(
    _minimalWithdrawalAmount: string
  ): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = keccak256(toUtf8Bytes('configureMinimalWithdrawalLimit(uint256,uint32)'))
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.getProposalNonce()) + 1;
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      toFixedHex(_minimalWithdrawalAmount).substr(2)
    );
  }

  public async getMaxDepositLimitProposalData(_maximumDepositAmount: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = keccak256(toUtf8Bytes('configureMaximumDepositLimit(uint256,uint32)'))
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.getProposalNonce()) + 1;
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      toFixedHex(_maximumDepositAmount).substr(2)
    );
  }

  // Proposal data is used to update linkedAnchors via bridge proposals
  // on other chains with this anchor's state
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {
    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const merkleRoot = this.depositHistory[leafIndex];
    return this.genProposalData(resourceID, merkleRoot, leafIndex);
  }

  // Proposal data is used to update linkedAnchors via bridge proposals
  // on other chains with this anchor's state
  public async genProposalData(
    resourceID: string,
    merkleRoot: string,
    leafIndex: number
  ): Promise<string> {
    // If no leaf index passed in, set it to the most recent one.
    const chainIdBigInt = (await this.signer.provider!.getNetwork()).chainId;
    const chainID = getChainIdType(Number(chainIdBigInt));
    const functionSig = keccak256(toUtf8Bytes('updateEdge(uint256,uint32,bytes32)'))
      .slice(0, 10)
      .padEnd(10, '0');

    const srcContract = await this.contract.address;
    const srcResourceId =
      '0x' +
      toHex(0, 6).substring(2) +
      toHex(srcContract, 20).substr(2) +
      toHex(chainID, 6).substr(2);
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(leafIndex, 4).substr(2) +
      toHex(merkleRoot, 32).substr(2) +
      toHex(srcResourceId, 32).substr(2)
    );
  }

  public getExtAmount(inputs: Utxo[], outputs: Utxo[], fee: BigNumberish) {
    return (
      BigInt(fee.toString()) +
      outputs.reduce((sum, x) => sum + BigInt(x.amount), BigInt(0)) -
      inputs.reduce((sum, x) => sum + BigInt(x.amount), BigInt(0))
    );
  }

  public async getWrapUnwrapOptions(extAmount: BigInt, refund: BigInt, wrapUnwrapToken: string) {
    let options = {};
    if (BigInt(extAmount.toString()) > BigInt(0) && checkNativeAddress(wrapUnwrapToken)) {
      let tokenWrapper = TokenWrapper__factory.connect(await this.contract.token(), this.signer);
      let valueToSend = await tokenWrapper.getAmountToWrap(extAmount.toString());

      options = {
        value: valueToSend.toHexString(),
      };
    } else if (BigInt(extAmount.toString()) < BigInt(0)) {
      options = {
        value: refund.toString(16),
      };
    }

    if (BigInt(refund.toString()) > BigInt(0) && BigInt(extAmount.toString()) >= BigInt(0)) {
      throw new Error('Refund should be zero');
    }
    return options;
  }

  public async encodeSolidityProof(calldata: any): Promise<String> {
    const proof = JSON.parse('[' + calldata + ']');
    const pi_a = proof[0];
    const pi_b = proof[1];
    const pi_c = proof[2];

    const proofEncoded = [
      pi_a[0],
      pi_a[1],
      pi_b[0][0],
      pi_b[0][1],
      pi_b[1][0],
      pi_b[1][1],
      pi_c[0],
      pi_c[1],
    ]
      .map((elt) => elt.substr(2))
      .join('');

    return proofEncoded;
  }

  public async padUtxos(utxos: Utxo[], maxLen: number): Promise<Utxo[]> {
    const evmId = (await this.signer.provider!.getNetwork()).chainId;
    const chainId = getChainIdType(Number(evmId));
    const randomKeypair = new Keypair();

    while (utxos.length !== 2 && utxos.length < maxLen) {
      utxos.push(
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainId.toString(),
          originChainId: chainId.toString(),
          amount: '0',
          blinding: hexToU8a(randomBN(31).toHexString()),
          keypair: randomKeypair,
        })
      );
    }
    if (utxos.length !== 2 && utxos.length !== maxLen) {
      throw new Error('Invalid utxo length');
    }
    return utxos;
  }

  // Proposal data is used to update linkedAnchors via bridge proposals
  // on other chains with this anchor's state

  public async getHandler(): Promise<string> {
    return this.contract.handler();
  }

  public validateInputs(inputs: Utxo[]): void {
    inputs.map((utxo) => {
      if (utxo.originChainId === undefined) {
        throw new Error('Input Utxo does not have a configured originChainId');
      }
    });
  }

  public async getHandlerProposalData(newHandler: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = keccak256(toUtf8Bytes('setHandler(address,uint32)'))
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.getProposalNonce()) + 1;

    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      toHex(newHandler, 20).substr(2)
    );
  }
  public async getClassAndContractRoots() {
    return [this.tree.root(), await this.contract.getLastRoot()];
  }

  public async generateExtData(
    recipient: string,
    extAmount: BigInt,
    relayer: string,
    fee: BigInt,
    refund: BigInt,
    wrapUnwrapToken: string,
    encryptedOutput1: string,
    encryptedOutput2: string
  ): Promise<{ extData: IVariableAnchorExtData; extDataHash: BigInt }> {
    const extData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount.toString()),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee.toString()),
      refund: toFixedHex(refund.toString()),
      token: toFixedHex(wrapUnwrapToken, 20),
      encryptedOutput1,
      encryptedOutput2,
    };

    const extDataHash = BigInt(
      getVAnchorExtDataHash(
        encryptedOutput1,
        encryptedOutput2,
        extAmount.toString(),
        fee.toString(),
        recipient,
        relayer,
        refund.toString(),
        wrapUnwrapToken
      ).toString()
    );
    return { extData, extDataHash };
  }

  public static convertToExtDataStruct(args: any[]): IVariableAnchorExtData {
    return {
      recipient: args[0],
      extAmount: args[1],
      relayer: args[2],
      fee: args[3],
      refund: args[4],
      token: args[5],
      encryptedOutput1: args[6],
      encryptedOutput2: args[7],
    };
  }

  /**
   * Sets up a VAnchor transaction by generate the necessary inputs to the tx.
   * @param inputs a list of UTXOs that are either inside the tree or are dummy inputs
   * @param outputs a list of output UTXOs. Needs to have 2 elements.
   * @param fee transaction fee.
   * @param refund amount given as gas to withdraw address
   * @param recipient address to the recipient
   * @param relayer address to the relayer
   * @param wrapUnwrapToken address to the token being transacted. can be the empty string to use native token
   * @param leavesMap map from chainId to merkle leaves
   * @param txOptions the optional transaction options
   * @returns `SetupTransactionResult` object
   */
  public abstract setupTransaction(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, BigNumberish[]>,
    txOptions?: TransactionOptions
  ): Promise<SetupTransactionResult>;

  public abstract updateTreeOrForestState(outputs: Utxo[]): Promise<void> | void;

  public async transact(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, BigNumberish[]>, // subtree
    overridesTransaction?: PayableOverrides & TransactionOptions
  ): Promise<ContractReceipt> {
    if (isOpenVAnchorContract(this.contract)) {
      throw new Error('OpenVAnchor contract does not support the `transact` method');
    }
    const [_, txOptions] = splitTransactionOptions(overridesTransaction);

    // Default UTXO chain ID will match with the configured signer's chain ID
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extAmount, extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap,
      txOptions
    );

    let options = await this.getWrapUnwrapOptions(
      BigInt(extAmount.toString()),
      BigInt(refund.toString()),
      wrapUnwrapToken
    );

    const tx = await this.contract.transact(
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
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      { ...options }
    );
    const receipt = await tx.wait();
    await this.updateTreeOrForestState(outputs);
    return receipt!;
  }
}
