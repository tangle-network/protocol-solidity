import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  OpenVAnchor as OpenVAnchorContract,
  OpenVAnchor__factory,
} from '@webb-tools/contracts';
import { solidityPack } from 'ethers/lib/utils';
import {
  toHex,
  toFixedHex,
  Utxo,
  MerkleTree,
  median,
  mean,
  max,
  min,
  CircomProvingManager,
  MerkleProof,
} from '@webb-tools/sdk-core';
import { u8aToHex, getChainIdType, ZkComponents } from '@webb-tools/utils';

const zeroAddress = '0x0000000000000000000000000000000000000000';
function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

export var gasBenchmark = [];
export var proofTimeBenchmark = [];
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class OpenVAnchor {
  signer: ethers.Signer;
  contract: OpenVAnchorContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;
  provingManager: CircomProvingManager;

  constructor(
    contract: OpenVAnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
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
    const openVAnchor = await factory.deploy(levels, hasher, handler, token, {});
    await openVAnchor.deployed();
    const createdVAnchor = new OpenVAnchor(
      openVAnchor,
      signer,
      BigNumber.from(levels).toNumber(),
    );
    createdVAnchor.latestSyncedBlock = openVAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    signer: ethers.Signer
  ) {
    const anchor = OpenVAnchor__factory.connect(address, signer);
    const treeHeight = await anchor.levels();
    const createdAnchor = new OpenVAnchor(
      anchor,
      signer,
      treeHeight,
    );
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
    return toHex(this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2), 32);
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
      this.contract = this.contract.connect(newSigner);
      return true;
    }
    return false;
  }

  // Proposal data is used to update linkedAnchors via bridge proposals
  // on other chains with this anchor's state
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {
    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const chainID = getChainIdType(await this.signer.getChainId());
    const merkleRoot = this.depositHistory[leafIndex];
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('updateEdge(bytes32,uint32,bytes32)'))
      .slice(0, 10)
      .padEnd(10, '0');

    const srcContract = this.contract.address;
    const srcResourceId =
      '0x' + toHex(0, 6).substring(2) + toHex(srcContract, 20).substr(2) + toHex(chainID, 6).substr(2);
    return (
      '0x' +
      toHex(resourceID, 32).substr(2) +
      functionSig.slice(2) +
      toHex(leafIndex, 4).substr(2) +
      toHex(merkleRoot, 32).substr(2) +
      toHex(srcResourceId, 32).substr(2)
    );
  }

  public async getHandler(): Promise<string> {
    return this.contract.handler();
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

  public async getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount: string): Promise<string> {
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

  public async populateRootsForProof(): Promise<string[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot, ...neighborRootInfos];
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
    let inputMerklePathElements: BigNumber[];

    if (Number(input.amount) > 0) {
      if (input.index < 0) {
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
      element: BigNumber.from(u8aToHex(input.commitment)),
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
        syncedBlock = await this.signer.provider.getBlockNumber();
      }
      this.tree = newTree;
      this.latestSyncedBlock = syncedBlock;
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
			delegatedCalldata: string,
			blinding: BigNumberish
  ): string {
    const delegatedCalldataHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'))

    console.log('calldata hash: ', delegatedCalldataHash)

    const packedValues = solidityPack([ "uint256", "uint256", "address", "bytes32", "uint256" ], [ chainId, amount, recipientAddr, delegatedCalldataHash, blinding]);
    console.log('packedValues: ', packedValues)
    const commitment = ethers.utils.keccak256(ethers.utils.arrayify(packedValues));
    console.log('commitment: ', commitment)
    return commitment
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns an object with two fields, publicInput
   */
  public async wrapAndDeposit(
    depositAmount: BigNumberish,
    destinationChainId: number,
    recipient: string,
    delegatedCalldata: string,
    blinding: BigNumberish,
  ): Promise<ethers.ContractReceipt> {
    // Default UTXO chain ID will match with the configured signer's chain ID
    const evmId = await this.signer.getChainId();
    const chainId = getChainIdType(evmId);

    let tx = await this.contract.wrapAndDeposit(
      depositAmount,
      destinationChainId,
      recipient,
      delegatedCalldata,
      this.token,
      blinding,
      { gasLimit: '0x5B8D80' }
    );

    const receipt = await tx.wait();
    gasBenchmark.push(receipt.gasUsed.toString());

		const commitment = this.getCommitment(
			destinationChainId,
			depositAmount,
			recipient,
			delegatedCalldata,
			blinding
		);

    // Add the leaves to the tree
    this.tree.insert(commitment);
    let numOfElements = this.tree.number_of_elements();
    this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());

    return receipt;
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns an object with two fields, publicInput
   */
  public async withdraw(
    recipient: string,
    withdrawAmount: BigNumberish,
    delegatedCalldata: string,
    blinding: BigNumberish,
    merkleProof: MerkleProof,
    commitmentIndex: number
  ): Promise<ethers.ContractReceipt> {
    const evmId = await this.signer.getChainId();
    const chainId = getChainIdType(evmId);

		const commitment = this.getCommitment(
			chainId,
			withdrawAmount,
			recipient,
			delegatedCalldata,
			blinding
		);

    let tx = await this.contract.withdraw(
      recipient,
      withdrawAmount,
      delegatedCalldata,
      blinding,
      merkleProof.pathElements.map((bignum) => bignum.toHexString()),
      commitmentIndex,
      merkleProof.merkleRoot.toHexString(),
      { gasLimit: '0x5B8D80' }
    );

    const receipt = await tx.wait();
    gasBenchmark.push(receipt.gasUsed.toString());

    // Add the leaves to the tree
    this.tree.insert(commitment);
    let numOfElements = this.tree.number_of_elements();
    this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());

    return receipt;
  }
}

export default OpenVAnchor;
