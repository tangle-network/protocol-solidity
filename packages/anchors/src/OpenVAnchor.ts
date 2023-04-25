import { OpenVAnchor as OpenVAnchorContract, OpenVAnchor__factory } from '@webb-tools/contracts';
import { IVAnchor } from '@webb-tools/interfaces';
import {
  CircomProvingManager,
  MerkleProof,
  MerkleTree,
  Utxo,
  max,
  mean,
  median,
  min,
  toFixedHex,
  toHex,
} from '@webb-tools/sdk-core';
import { getChainIdType, u8aToHex } from '@webb-tools/utils';
import { BigNumberish, ContractTransactionReceipt, Overrides, ethers, getBytes, keccak256, solidityPacked, toUtf8Bytes } from 'ethers';
import { PayableOverrides } from '@ethersproject/contracts';
import { WebbBridge } from './Common';
import { OverridesWithFrom, SetupTransactionResult, TransactionOptions } from './types';

function sha3Hash(left: BigNumberish, right: BigNumberish) {
  const packed = solidityPacked(['bytes32', 'bytes32'], [toFixedHex(left), toFixedHex(right)]);
  return BigInt(keccak256(getBytes(packed)));
}

export var gasBenchmark: string[] = [];
export var proofTimeBenchmark: number[] = [];

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class OpenVAnchor extends WebbBridge implements IVAnchor {
  contract: OpenVAnchorContract;
  latestSyncedBlock = 0;

  token?: string;
  denomination?: string;
  provingManager: CircomProvingManager;

  constructor(contract: OpenVAnchorContract, signer: ethers.Signer, treeHeight: number) {
    super(contract, signer, treeHeight);
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight, [], { hashFunction: sha3Hash });
    this.depositHistory = {};
  }

  getAddress(): string {
    return this.contract.address;
  }

  public static async createOpenVAnchor(
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    signer: ethers.Signer
  ) {
    const factory = new OpenVAnchor__factory(signer);
    const openVAnchor = await factory.deploy(hasher, levels, handler, token, {});
    await openVAnchor.deployed();
    const createdVAnchor = new OpenVAnchor(openVAnchor, signer, Number(levels));
    createdVAnchor.token = token;
    const tx = await createdVAnchor.contract.initialize(
      BigInt('1'),
      BigInt('2') ^ BigInt('256') - BigInt('1')
    );
    await tx.wait();
    return createdVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    signer: ethers.Signer
  ) {
    const anchor = OpenVAnchor__factory.connect(address, signer);
    const treeHeight = await anchor.outerLevels();
    const createdAnchor = new OpenVAnchor(anchor, signer, treeHeight);
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public static createRootsBytes(rootArray: string[]) {
    let rootsBytes = '0x';
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes)
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

  // Sync the local tree with the tree on chain.
  // Start syncing from the given block number, otherwise zero.
  public async update(blockNumber?: number) {
    // const filter = this.contract.filters.Deposit();
    // const currentBlockNumber = await this.signer.provider!.getBlockNumber();
    // const events = await this.contract.queryFilter(filter, blockNumber || 0);
    // const commitments = events.map((event) => event.args.commitment);
    // this.tree.batch_insert(commitments);
    // this.latestSyncedBlock = currentBlockNumber;
  }

  public async createResourceId(): Promise<string> {
    const chainId = (await this.signer.provider?.getNetwork())?.chainId;
    return toHex(
      this.contract.address + toHex(getChainIdType(Number(chainId)), 6).substr(2),
      32
    );
  }

  public async setHandler(handlerAddress: string) {
    const tx = await this.contract.setHandler(
      handlerAddress,
      BigInt(await this.contract.getProposalNonce()) + BigInt(0)
    );
    await tx.wait();
  }

  public async setSigner(newSigner: ethers.Signer) {
    const currentChainId = (await this.signer.provider?.getNetwork())?.chainId;
    const newChainId = (await newSigner.provider?.getNetwork())?.chainId;

    if (currentChainId === newChainId) {
      this.signer = newSigner;
      this.contract = this.contract.connect(newSigner);
      return true;
    }
    return false;
  }

  public async getHandler(): Promise<string> {
    return this.contract.handler();
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

  public async populateRootsForProof(): Promise<string[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot.toString(), ...neighborRootInfos.map((root: BigNumberish) => root.toString())];
  }

  public async getClassAndContractRoots() {
    return [this.tree.root(), await this.contract.getLastRoot()];
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns
   */
  public getMerkleProof(input: Utxo): MerkleProof {
    let inputMerklePathIndices: number[];
    let inputMerklePathElements: BigNumberish[];

    if (Number(input.amount) > 0) {
      if (!input.index || input.index < 0) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} was not found`);
      }
      const path = this.tree.path(input.index);
      inputMerklePathIndices = path.pathIndices;
      inputMerklePathElements = path.pathElements;
    } else {
      inputMerklePathIndices = new Array(this.tree.levels).fill(0);
      inputMerklePathElements = new Array(this.tree.levels).fill(0);
    }

    return {
      element: BigInt(u8aToHex(input.commitment)),
      pathElements: inputMerklePathElements,
      pathIndices: inputMerklePathIndices,
      merkleRoot: this.tree.root(),
    };
  }

  /**
   * Given a list of leaves and a latest synced block, update internal tree state
   * The function will create a new tree, and check on chain root before updating its member variable
   * If the passed leaves match on chain data,
   *   update this instance and return true
   * else
   *   return false
   */
  public async setWithLeaves(leaves: string[], syncedBlock?: number): Promise<Boolean> {
    let newTree = new MerkleTree(this.tree.levels, leaves);
    let root = toFixedHex(newTree.root());
    let validTree = await this.contract.isKnownRoot(root);

    if (validTree) {
      let index = 0;
      for (const leaf of newTree.elements()) {
        this.depositHistory[index] = toFixedHex(this.tree.root());
        index++;
      }
      if (!syncedBlock) {
        if (!this.signer.provider) {
          throw new Error('Signer does not have a provider');
        }

        syncedBlock = await this.signer.provider.getBlockNumber();
      }
      this.tree = newTree;
      return true;
    } else {
      return false;
    }
  }

  public async getGasBenchmark() {
    const gasValues = gasBenchmark.map(Number);
    const meanGas = mean(gasValues);
    const medianGas = median(gasValues);
    const maxGas = max(gasValues);
    const minGas = min(gasValues);
    return {
      gasValues,
      meanGas,
      medianGas,
      maxGas,
      minGas,
    };
    // return gasBenchmark;
  }

  public async getProofTimeBenchmark() {
    const meanTime = mean(proofTimeBenchmark);
    const medianTime = median(proofTimeBenchmark);
    const maxTime = max(proofTimeBenchmark);
    const minTime = min(proofTimeBenchmark);
    return {
      proofTimeBenchmark,
      meanTime,
      medianTime,
      maxTime,
      minTime,
    };
  }

  public getCommitment(
    chainId: number,
    amount: BigNumberish,
    recipientAddr: string,
    delegatedCalldata: BigNumberish,
    blinding: BigNumberish,
    relayingFee: BigNumberish
  ): string {
    const delegatedCalldataHash = keccak256(getBytes('0x00'));

    const packedValues = solidityPacked(
      ['uint48', 'uint256', 'address', 'bytes32', 'uint256', 'uint256'],
      [chainId, amount, recipientAddr, delegatedCalldataHash, blinding, relayingFee]
    );
    const commitment = keccak256(getBytes(packedValues));
    return commitment;
  }

  public async deposit(
    destinationChainId: number,
    depositAmount: BigNumberish,
    recipient: string,
    delegatedCalldata: string,
    blinding: BigNumberish,
    relayingFee: BigNumberish,
    overridesTransaction?: OverridesWithFrom<Overrides>
  ): Promise<ContractTransactionReceipt> {
    let tx = await this.contract.deposit(
      depositAmount,
      destinationChainId,
      recipient,
      delegatedCalldata,
      blinding,
      relayingFee,
      { gasLimit: '0x5B8D80', ...overridesTransaction }
    );

    const receipt = await tx.wait();
    gasBenchmark.push(receipt.gasUsed.toString());

    const commitment = this.getCommitment(
      destinationChainId,
      depositAmount,
      recipient,
      delegatedCalldata,
      blinding,
      relayingFee
    );

    // Add the leaves to the tree
    this.tree.insert(toFixedHex(BigInt(commitment)));
    let numOfElements = this.tree.number_of_elements();
    this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());

    return receipt;
  }

  public async wrapAndDeposit(
    destinationChainId: number,
    depositAmount: BigNumberish,
    recipient: string,
    delegatedCalldata: string,
    blinding: BigNumberish,
    relayingFee: BigNumberish,
    tokenAddress: string,
    overridesTransaction?: PayableOverrides
  ): Promise<ContractTransactionReceipt> {
    let tx = await this.contract.wrapAndDeposit(
      destinationChainId,
      depositAmount,
      recipient,
      delegatedCalldata,
      blinding,
      relayingFee,
      tokenAddress,
      { gasLimit: '0x5B8D80', ...overridesTransaction }
    );

    const receipt = await tx.wait();
    gasBenchmark.push(receipt.gasUsed.toString());

    const commitment = this.getCommitment(
      destinationChainId,
      depositAmount,
      recipient,
      delegatedCalldata,
      blinding,
      relayingFee
    );

    // Add the leaves to the tree
    this.tree.insert(commitment);
    let numOfElements = this.tree.number_of_elements();
    this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());

    return receipt;
  }

  public async withdraw(
    withdrawAmount: BigNumberish,
    recipient: string,
    delegatedCalldata: string,
    blinding: BigNumberish,
    relayingFee: BigNumberish,
    merkleProof: MerkleProof,
    commitmentIndex: number,
    overridesTransaction?: OverridesWithFrom<Overrides>
  ): Promise<ContractTransactionReceipt> {
    let tx = await this.contract.withdraw(
      withdrawAmount,
      recipient,
      delegatedCalldata,
      blinding,
      relayingFee,
      merkleProof.pathElements.map((bignum) => bignum.toString(16)),
      commitmentIndex,
      merkleProof.merkleRoot.toString(16),
      { gasLimit: '0x5B8D80', ...overridesTransaction }
    );

    const receipt = await tx.wait();
    gasBenchmark.push(receipt.gasUsed.toString());

    return receipt;
  }

  public async withdrawAndUnwrap(
    withdrawAmount: BigNumberish,
    recipient: string,
    delegatedCalldata: string,
    blinding: BigNumberish,
    relayingFee: BigNumberish,
    merkleProof: MerkleProof,
    commitmentIndex: number,
    tokenAddress: string,
    overridesTransaction?: PayableOverrides
  ): Promise<ContractTransactionReceipt> {
    let tx = await this.contract.withdrawAndUnwrap(
      withdrawAmount,
      recipient,
      delegatedCalldata,
      blinding,
      relayingFee,
      merkleProof.pathElements.map((bignum) => bignum.toString(16)),
      commitmentIndex,
      merkleProof.merkleRoot.toString(16),
      tokenAddress,
      { gasLimit: '0x5B8D80', ...overridesTransaction }
    );

    const receipt = await tx.wait();
    gasBenchmark.push(receipt.gasUsed.toString());

    return receipt;
  }
  public setupTransaction(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>,
    txOptions?: TransactionOptions | undefined
  ): Promise<SetupTransactionResult> {
    throw new Error('Method not supported on `OpenVAnchor` contract');
  }
  public updateTreeOrForestState(outputs: Utxo[]): void | Promise<void> {
    throw new Error('Method not supported on `OpenVAnchor` contract');
  }
}

export default OpenVAnchor;
