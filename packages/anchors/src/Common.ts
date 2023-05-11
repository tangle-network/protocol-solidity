import { BaseContract, BigNumber, BigNumberish, PayableOverrides, ethers } from 'ethers';
import {
  VAnchor as VAnchorContract,
  ChainalysisVAnchor as ChainalysisVAnchorContract,
  VAnchorForest as VAnchorForestContract,
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
import { hexToU8a, getChainIdType, ZERO_BYTES32, FIELD_SIZE } from '@webb-tools/utils';
import { checkNativeAddress, splitTransactionOptions } from './utils';
import { OverridesWithFrom, SetupTransactionResult, TransactionOptions } from './types';
import { IVariableAnchorExtData } from '@webb-tools/interfaces';

export type WebbContracts = VAnchorContract | ChainalysisVAnchorContract | VAnchorForestContract;

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
      BigNumber.from(await this.contract.getProposalNonce()).add(1)
    );
    await tx.wait();
  }

  public async setSigner(newSigner: ethers.Signer) {
    const currentChainId = await this.signer.getChainId();
    const newChainId = await newSigner.getChainId();

    if (currentChainId === newChainId) {
      this.signer = newSigner;
      this.contract = (this.contract as BaseContract).connect(newSigner) as A;
      return true;
    }
    return false;
  }

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async getMinWithdrawalLimitProposalData(
    _minimalWithdrawalAmount: string
  ): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('configureMinimalWithdrawalLimit(uint256,uint32)'))
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
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('configureMaximumDepositLimit(uint256,uint32)'))
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
    const chainID = getChainIdType(await this.signer.getChainId());
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('updateEdge(uint256,uint32,bytes32)'))
      .slice(0, 10)
      .padEnd(10, '0');

    const srcContract = this.contract.address;
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
    return BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));
  }

  public async getWrapUnwrapOptions(
    extAmount: BigNumber,
    refund: BigNumber,
    wrapUnwrapToken: string
  ) {
    let options = {};
    if (extAmount.gt(0) && checkNativeAddress(wrapUnwrapToken)) {
      let tokenWrapper = TokenWrapper__factory.connect(await this.contract.token(), this.signer);
      let valueToSend = await tokenWrapper.getAmountToWrap(extAmount);

      options = {
        value: valueToSend.toHexString(),
      };
    } else if (extAmount.lt(0)) {
      options = {
        value: refund.toHexString(),
      };
    }

    if (refund.gt(0) && extAmount.gte(0)) {
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
    const evmId = await this.signer.getChainId();
    const chainId = getChainIdType(evmId);
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
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('setHandler(address,uint32)'))
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

  public generateExtData(
    recipient: string,
    extAmount: BigNumberish,
    relayer: string,
    fee: BigNumberish,
    refund: BigNumberish,
    wrapUnwrapToken: string,
    encryptedOutput1: string,
    encryptedOutput2: string
  ): { extData: IVariableAnchorExtData; extDataHash: BigNumberish } {
    const extData: IVariableAnchorExtData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      refund: toFixedHex(refund.toString()),
      token: toFixedHex(wrapUnwrapToken, 20),
      encryptedOutput1,
      encryptedOutput2,
    };

    const extDataHash = this.getVAnchorExtDataHash(extData);
    return { extData, extDataHash };
  }

  public getVAnchorExtDataHash(extData: IVariableAnchorExtData): BigNumberish {
    const abi = new ethers.utils.AbiCoder();
    const abiString =
      'tuple(address recipient,int256 extAmount,address relayer,uint256 fee,uint256 refund,address token,bytes encryptedOutput1,bytes encryptedOutput2)';
    const encodedData = abi.encode([abiString], [extData]);
    const hash = ethers.utils.keccak256(encodedData);
    return BigNumber.from(hash).mod(FIELD_SIZE);
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
    leavesMap: Record<string, Uint8Array[]>,
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
    leavesMap: Record<string, Uint8Array[]>, // subtree
    overridesTransaction?: OverridesWithFrom<PayableOverrides> & TransactionOptions
  ): Promise<ethers.ContractReceipt> {
    const [overrides, txOptions] = splitTransactionOptions(overridesTransaction);

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
      extAmount,
      BigNumber.from(refund),
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
        // extensionRoots: isForest ? [] :  publicInputs.extensionRoots ,
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
      { ...options, ...overrides }
    );
    const receipt = await tx.wait();
    await this.updateTreeOrForestState(outputs);
    return receipt;
  }
}
