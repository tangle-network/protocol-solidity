import { BigNumberish, ethers, BigNumber, ContractTransaction } from 'ethers';
import { FixedDepositAnchor as AnchorContract, FixedDepositAnchor__factory as Anchor__factory, ERC20__factory} from '@webb-tools/contracts'
import { RefreshEvent, WithdrawalEvent } from '@webb-tools/contracts/src/FixedDepositAnchor';
import { IAnchorDeposit, IAnchorDepositInfo, IAnchor, IFixedAnchorPublicInputs, IFixedAnchorExtData } from '@webb-tools/interfaces';
import { 
  toFixedHex,
  toHex,
  rbigint,
  MerkleTree,
  Utxo,
  Note,
  CircomProvingManager,
  NoteGenInput,
  ProvingManagerSetupInput,
  getFixedAnchorExtDataHash,
  MerkleProof,
} from '@webb-tools/sdk-core';
import { hexToU8a } from '@polkadot/util';
import { ZkComponents, getChainIdType } from '@webb-tools/utils'
import { poseidon } from 'circomlibjs';

const zeroAddress = "0x0000000000000000000000000000000000000000";

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

/**
 * It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
 * Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
 * Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
 */
class Anchor implements IAnchor {
  signer: ethers.Signer;
  contract: AnchorContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  zkComponents: ZkComponents;
  provingManager: CircomProvingManager;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;

  private constructor(
    contract: AnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    zkComponents: ZkComponents,
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.depositHistory = {};
    this.zkComponents = zkComponents;
    this.provingManager = new CircomProvingManager(zkComponents.wasm, treeHeight, null);
  }
  
  getAddress(): string {
    return this.contract.address;
  }
  getMerkleProof(input: Utxo): MerkleProof {
    throw new Error("Method not implemented.");
  }
  getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getMaxDepositLimitProposalData(_maximumDepositAmount: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  /**
   * Deploys an Anchor contract and sets the signer for deposit and withdraws on this contract.
   */
  public static async createAnchor(
    verifier: string,
    hasher: string,
    denomination: BigNumberish,
    merkleTreeHeight: number,
    token: string,
    handler: string,
    maxEdges: number,
    zkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const factory = new Anchor__factory(signer);
    const deployTx = factory.getDeployTransaction(handler, token, verifier, hasher, denomination, merkleTreeHeight, maxEdges).data;
    const gasEstimate = await factory.signer.estimateGas({ data: deployTx });
    const anchor = await factory.deploy(handler, token, verifier, hasher, denomination, merkleTreeHeight, maxEdges, { gasLimit: gasEstimate });
    await anchor.deployed();
    const createdAnchor = new Anchor(anchor, signer, merkleTreeHeight, maxEdges, zkComponents);
    createdAnchor.latestSyncedBlock = anchor.deployTransaction.blockNumber!;
    createdAnchor.denomination = denomination.toString();
    createdAnchor.token = token;
    return createdAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    zkFiles: ZkComponents,
    signer: ethers.Signer,
  ) {
    const anchor = Anchor__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges()
    const treeHeight = await anchor.levels();
    const createdAnchor = new Anchor(anchor, signer, treeHeight, maxEdges, zkFiles);
    createdAnchor.token = await anchor.token();
    createdAnchor.denomination = (await anchor.denomination()).toString();
    return createdAnchor;
  }

  public static generateDeposit(destinationChainId: number, secretBytesLen: number = 31, nullifierBytesLen: number = 31): IAnchorDepositInfo {
    const chainID = BigInt(destinationChainId);
    const secret = rbigint(secretBytesLen);
    const nullifier = rbigint(nullifierBytesLen);
    const commitment = BigNumber.from(poseidon([chainID, nullifier, secret])).toHexString();
    const nullifierHash = BigNumber.from(poseidon([nullifier, nullifier])).toHexString();

    const deposit: IAnchorDepositInfo = {
      chainID,
      secret,
      nullifier,
      commitment,
      nullifierHash
    };
  
    return deposit
  } 

  public static createRootsBytes(rootArray: string[] | BigNumberish[]): string {
    let rootsBytes = "0x";
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes) 
  };

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address
        + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async setHandler(handlerAddress: string) {
    const gasEstimate = await this.contract.estimateGas.setHandler(handlerAddress, BigNumber.from((await this.contract.getProposalNonce())).add(1));
    const tx = await this.contract.setHandler(handlerAddress, BigNumber.from((await this.contract.getProposalNonce())).add(1), {gasLimit: gasEstimate});
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

  /**
   * Proposal data is used to update linkedAnchors via bridge proposals 
   * on other chains with this anchor's state
   */
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {

    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("updateEdge(uint256,bytes32,uint256,bytes32)")).slice(0, 10).padEnd(10, '0');
    const dummyNonce = 1;
    const chainID = getChainIdType(await this.signer.getChainId());
    const merkleRoot = this.depositHistory[leafIndex];
    const targetContract = this.contract.address;

    return '0x' +
      toHex(resourceID, 32).substr(2)+ 
      functionSig.slice(2) + 
      toHex(dummyNonce,4).substr(2) +
      toHex(chainID, 6).substr(2) + 
      toHex(leafIndex, 4).substr(2) + 
      toHex(merkleRoot, 32).substr(2) +
      toHex(targetContract, 32).substr(2);
  }

  public async getHandler(): Promise<string> {
    return this.contract.handler();
  }

  public async getHandlerProposalData(newHandler: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("setHandler(address,uint32)")).slice(0, 10).padEnd(10, '0');  
    const nonce = Number(await this.contract.getProposalNonce()) + 1;;

    return '0x' +
      toHex(resourceID, 32).substr(2)+ 
      functionSig.slice(2) + 
      toHex(nonce,4).substr(2) +
      toHex(newHandler, 20).substr(2) 
  }

  /**
   * Makes a deposit of the anchor's fixed sized denomination into the smart contracts.
   * Assumes the sender possesses the anchor's fixed sized denomination.
   * Assumes the anchor has the correct, full deposit history.
   * @param destinationChainId 
   * @returns 
   */
  public async deposit(destinationChainId?: number): Promise<IAnchorDeposit> {
    const originChainId = getChainIdType(await this.signer.getChainId());
    const destChainId = (destinationChainId) ? destinationChainId : originChainId;
    const deposit = Anchor.generateDeposit(destChainId);
    
    const gasEstimate = await this.contract.estimateGas.deposit(toFixedHex(deposit.commitment));
    const tx = await this.contract.deposit(toFixedHex(deposit.commitment), {gasLimit: gasEstimate});

    const receipt = await tx.wait();

    // Deposit history and state altered.
    this.tree.insert(deposit.commitment);
    let index = this.tree.number_of_elements() - 1;
    this.depositHistory[index] = await this.contract.getLastRoot();
    this.latestSyncedBlock = receipt.blockNumber;

    return { deposit, index, originChainId };
  }

  public getAmountToWrap(wrappingFee: number) {
    return BigNumber.from(this.denomination).mul(100).div(100 - wrappingFee);
  }

  /**
   * Assumes the anchor has the correct, full deposit history.
   */
  public async wrapAndDeposit(tokenAddress: string, wrappingFee: number, destinationChainId: number): Promise<IAnchorDeposit> {
    const originChainId = getChainIdType(await this.signer.getChainId());
    const chainId = destinationChainId;
    const deposit = Anchor.generateDeposit(chainId);
    const gasEstimate = await this.contract.estimateGas.wrapAndDeposit(tokenAddress, toFixedHex(deposit.commitment));
    let tx: ContractTransaction;
    if (checkNativeAddress(tokenAddress)) {
      tx = await this.contract.wrapAndDeposit(tokenAddress, toFixedHex(deposit.commitment), {
        value: this.getAmountToWrap(wrappingFee).toString(),
        gasLimit: gasEstimate
      });
    } else {
      tx = await this.contract.wrapAndDeposit(tokenAddress, toFixedHex(deposit.commitment), {
        gasLimit: gasEstimate
      });
    }
    const receipt = await tx.wait();
    
    // Deposit history and state altered.
    this.tree.insert(deposit.commitment);
    let index = this.tree.number_of_elements() - 1;
    const root = await this.contract.getLastRoot();
    this.latestSyncedBlock = receipt.blockNumber;
    this.depositHistory[index] = root;

    return { deposit, index, originChainId };
  }

  /**
   * Sync the local tree with the tree on chain.
   * Start syncing from the given block number, otherwise latest synced block.
   */
  public async update(blockNumber?: number) {
    const filter = this.contract.filters.Deposit();
    const currentBlockNumber = await this.signer.provider!.getBlockNumber();
    const events = await this.contract.queryFilter(filter, blockNumber || this.latestSyncedBlock + 1);
    const commitments = events.map((event) => event.args.commitment);

    let index = Object.keys(this.depositHistory).length;
    for (const commitment of commitments) {
      this.tree.insert(commitment);
      this.depositHistory[index] = toFixedHex(this.tree.root());
      index++;
    }

    this.latestSyncedBlock = currentBlockNumber;
  }

  // Used to populate the roots for a bridged withdraw
  public async populateRootsForProof(): Promise<string[]> {
    const neighborRoots = await this.contract.getLatestNeighborRoots();
    return [await this.contract.getLastRoot(), ...neighborRoots];
  }

  public async checkKnownRoot() {
    const isKnownRoot = await this.contract.isKnownRoot(toFixedHex(await this.tree.root()));
    if (!isKnownRoot) {
      await this.update(this.latestSyncedBlock);
    }
  }

  public async setupWithdraw(
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ): Promise<{
    publicInputs: IFixedAnchorPublicInputs,
    extData: IFixedAnchorExtData
  }> {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();
    const chainId = getChainIdType(await this.signer.getChainId());
    const roots = await this.populateRootsForProof();
    const refund = BigInt(0);
    const tokenInstance = ERC20__factory.connect(this.token, this.signer);
    const tokenSymbol = await tokenInstance.symbol();

    const noteInput: NoteGenInput = {
      amount: this.denomination,
      backend: 'Circom',
      curve: 'Bn254',
      denomination: '18',
      exponentiation: '5',
      hashFunction: 'Poseidon',
      protocol: 'anchor',
      sourceChain: chainId.toString(),
      sourceIdentifyingData: this.contract.address,
      targetChain: chainId.toString(),
      targetIdentifyingData: this.contract.address,
      secrets:
        `${toFixedHex(BigNumber.from(deposit.chainID), 8).slice(2)}:` +
        `${toFixedHex(BigNumber.from(deposit.nullifier).toHexString()).slice(2)}:` +
        `${toFixedHex(BigNumber.from(deposit.secret).toHexString()).slice(2)}`,
      version: 'v2',
      width: '4',
      tokenSymbol
    }

    const note = await Note.generateNote(noteInput);
    const proofInput: ProvingManagerSetupInput<'anchor'> = {
      fee: Number(fee),
      leaves: this.tree.elements().map((leaf) => hexToU8a(leaf.toHexString())),
      leafIndex: index,
      note: note.serialize(),
      provingKey: this.zkComponents.zkey,
      recipient,
      refund: 0,
      refreshCommitment: refreshCommitment.toString(),
      relayer,
      roots: roots.map((root) => hexToU8a(root)),
    }

    const proof = await this.provingManager.prove('anchor', proofInput);

    const extData: IFixedAnchorExtData = {
      _fee: fee,
      _refreshCommitment: toFixedHex(refreshCommitment),
      _recipient: toFixedHex(recipient, 20),
      _relayer: toFixedHex(relayer, 20),
      _refund: refund,
    };

    const extDataHash = getFixedAnchorExtDataHash(
      fee,
      recipient,
      refreshCommitment,
      refund,
      relayer
    );

    const args = [
      proof.proof,
      Anchor.createRootsBytes(proof.roots),
      toFixedHex(proof.nullifierHash),
      toFixedHex(extDataHash),
    ];
    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    return {
      publicInputs,
      extData,
    };
  }

  public async withdraw(
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ): Promise<RefreshEvent | WithdrawalEvent> {
    const { publicInputs, extData } = await this.setupWithdraw(
      deposit,
      index,
      recipient,
      relayer,
      fee,
      refreshCommitment,
    );
    const gasEstimate = await this.contract.estimateGas.withdraw(
      publicInputs,
      extData
    );
    const tx = await this.contract.withdraw(
      publicInputs,
      extData,
      { gasLimit: gasEstimate }
    );
    const receipt = await tx.wait();

    if (extData._refreshCommitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      this.tree.insert(refreshCommitment);
      const filter = this.contract.filters.Refresh(null, null, null);
      const events = await this.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    } else {
      const filter = this.contract.filters.Withdrawal(null, relayer, null);
      const events = await this.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    }
  }

  public async withdrawAndUnwrap(
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string,
    tokenAddress: string
  ): Promise<WithdrawalEvent> {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();

    const { publicInputs, extData } = await this.setupWithdraw(
      deposit,
      index,
      recipient,
      relayer,
      fee,
      refreshCommitment
    )
    const gasEstimate = await this.contract.estimateGas.withdrawAndUnwrap(publicInputs, extData, tokenAddress);

    const tx = await this.contract.withdrawAndUnwrap(publicInputs, extData, tokenAddress, { gasLimit: gasEstimate });
    const receipt = await tx.wait();

    const filter = this.contract.filters.Withdrawal(null, null, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }

  /**
   * A bridgedWithdraw needs the merkle proof to be generated from an anchor other than this one,
   */
  public async bridgedWithdrawAndUnwrap(
    deposit: IAnchorDeposit,
    leaves: BigNumberish[],
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string,
    tokenAddress: string,
  ): Promise<WithdrawalEvent> {
    refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';

    const { publicInputs, extData } = await this.setupBridgedWithdraw(
      deposit,
      leaves,
      deposit.index,
      recipient,
      relayer,
      BigInt(fee),
      refreshCommitment
    );
    const gasEstimate = await this.contract.estimateGas.withdrawAndUnwrap(
      publicInputs,
      extData,
      tokenAddress
    );

    const tx = await this.contract.withdrawAndUnwrap(
      publicInputs,
      extData,
      tokenAddress,
      { gasLimit: gasEstimate },
    );
    const receipt = await tx.wait();

    const filter = this.contract.filters.Withdrawal(null, relayer, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }

  public static convertArgsArrayToStruct(args: any[]): IFixedAnchorPublicInputs {
    return {
      proof: args[0],
      _roots: args[1],
      _nullifierHash: args[2],
      _extDataHash: args[3],
    };
  }

  public async setupBridgedWithdraw(
    deposit: IAnchorDeposit,
    leaves: BigNumberish[],
    leafIndex: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ): Promise<{
    publicInputs: IFixedAnchorPublicInputs,
    extData: IFixedAnchorExtData
  }> {
    const chainId = getChainIdType(await this.signer.getChainId());
    const roots = await this.populateRootsForProof();
    const refund = BigInt(0);
    
    const noteInput: NoteGenInput = {
      amount: this.denomination,
      backend: 'Circom',
      curve: 'Bn254',
      denomination: '18',
      exponentiation: '5',
      hashFunction: 'Poseidon',
      protocol: 'anchor',
      sourceChain: deposit.originChainId.toString(),
      sourceIdentifyingData: 'unknown',
      targetChain: chainId.toString(),
      targetIdentifyingData: this.contract.address,
      secrets:
        `${toFixedHex(BigNumber.from(deposit.deposit.chainID), 8).slice(2)}:` +
        `${toFixedHex(BigNumber.from(deposit.deposit.nullifier).toHexString()).slice(2)}:` +
        `${toFixedHex(BigNumber.from(deposit.deposit.secret).toHexString()).slice(2)}`,
      version: 'v2',
      width: '4',
      tokenSymbol: this.token
    }

    const note = await Note.generateNote(noteInput);
    const proofInput: ProvingManagerSetupInput<'anchor'> = {
      fee: Number(fee),
      leaves: leaves.map((leaf) => hexToU8a(BigNumber.from(leaf).toHexString())),
      leafIndex,
      note: note.serialize(),
      provingKey: this.zkComponents.zkey,
      recipient,
      refund: 0,
      refreshCommitment: refreshCommitment.toString(),
      relayer,
      roots: roots.map((root) => hexToU8a(root)),
    }

    const proof = await this.provingManager.prove('anchor', proofInput);

    const extData: IFixedAnchorExtData = {
      _fee: fee,
      _refreshCommitment: toFixedHex(refreshCommitment),
      _recipient: toFixedHex(recipient, 20),
      _relayer: toFixedHex(relayer, 20),
      _refund: refund,
    };

    const extDataHash = getFixedAnchorExtDataHash(
      BigNumber.from(fee),
      recipient,
      refreshCommitment,
      BigNumber.from(refund),
      relayer
    );

    const args = [
      proof.proof,
      Anchor.createRootsBytes(proof.roots),
      toFixedHex(proof.nullifierHash),
      toFixedHex(extDataHash),
    ];
    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    return {
      publicInputs,
      extData,
    };
  }

  public async bridgedWithdraw(
    deposit: IAnchorDeposit,
    leaves: BigNumberish[],
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string
  ): Promise<WithdrawalEvent> {
    refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';

    const { publicInputs, extData } = await this.setupBridgedWithdraw(
      deposit,
      leaves,
      deposit.index,
      recipient,
      relayer,
      BigInt(fee),
      refreshCommitment
    );

    const gasEstimate = await this.contract.estimateGas.withdraw(
      publicInputs,
      extData
    );

    const tx = await this.contract.withdraw(
      publicInputs,
      extData,
      { gasLimit: gasEstimate },
    );

    const receipt = await tx.wait();
    
    const filter = this.contract.filters.Withdrawal(null, relayer, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }
}

export { Anchor };
