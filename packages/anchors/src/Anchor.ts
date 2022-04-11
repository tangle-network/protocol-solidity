// @ts-nocheck
import { BigNumberish, ethers, BigNumber, ContractTransaction } from 'ethers';
import { FixedDepositAnchor as AnchorContract, FixedDepositAnchor__factory as Anchor__factory} from '@webb-tools/contracts'
import { RefreshEvent, WithdrawalEvent } from '@webb-tools/contracts/src/FixedDepositAnchor';
import { IAnchorDeposit, IAnchorDepositInfo, IAnchor, IFixedAnchorPublicInputs, IMerkleProofData, IFixedAnchorExtData } from '@webb-tools/interfaces';
import { toFixedHex, toHex, rbigint, p256, PoseidonHasher, ZkComponents, Utxo, getChainIdType, getFixedAnchorExtDataHash } from '@webb-tools/utils';
import { MerkleTree } from '@webb-tools/merkle-tree';

const snarkjs = require('snarkjs');
const zeroAddress = "0x0000000000000000000000000000000000000000";

function checkNativeAddress(tokenAddress: string): boolean {
  if (tokenAddress === zeroAddress || tokenAddress === '0') {
    return true;
  }
  return false;
}

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods 
class Anchor implements IAnchor {
  signer: ethers.Signer;
  contract: AnchorContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  zkComponents: ZkComponents;

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
  }
  
  getAddress(): string {
    return this.contract.address;
  }

  bridgedTransactWrap(tokenAddress: string, inputs: Utxo[], outputs: Utxo[], fee: BigNumberish, recipient: string, relayer: string, merkleProofsForInputs: any[]): Promise<ethers.ContractReceipt> {
    throw new Error("Method not implemented.");
  }
  getMerkleProof(input: Utxo): IMerkleProofData {
    throw new Error("Method not implemented.");
  }
  bridgedTransact(inputs: Utxo[], outputs: Utxo[], fee: BigNumberish, recipient: string, relayer: string, merkleProofsForInputs: any[]): Promise<ethers.ContractReceipt> {
    throw new Error("Method not implemented.");
  }
  getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount: string): Promise<string> {
    throw new Error("Method not implemented.");
  }
  getMaxDepositLimitProposalData(_maximumDepositAmount: string): Promise<string> {
    throw new Error("Method not implemented.");
  }

  // Deploys an Anchor contract and sets the signer for deposit and withdraws on this contract.
  public static async createAnchor(
    verifier: string,
    hasher: string,
    denomination: BigNumberish,
    merkleTreeHeight: number,
    token: string,
    handler: string,
    maxEdges: number,
    zkComponents: ZkComponents,
    signer: ethers.Signer,
  ) {
    const factory = new Anchor__factory(signer);
    const anchor = await factory.deploy(handler, token, verifier, hasher, denomination, merkleTreeHeight, maxEdges, {});
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

    const hasher = new PoseidonHasher();
    const commitment = hasher.hash3([chainID, nullifier, secret]).toString();
    const nullifierHash = hasher.hash(null, nullifier, nullifier);

    const deposit: IAnchorDepositInfo = {
      chainID,
      secret,
      nullifier,
      commitment,
      nullifierHash
    };
  
    return deposit
  }

  public static createRootsBytes(rootArray: string[] | BigNumberish[]) {
    let rootsBytes = "0x";
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes) 
  };

  public static async groth16ExportSolidityCallData(proof: any, pub: any) {
    let inputs = "";
    for (let i = 0; i < pub.length; i++) {
      if (inputs != "") inputs = inputs + ",";
      inputs = inputs + p256(pub[i]);
    }
  
    let S;
    S=`[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
      `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(proof.pi_b[1][0])}]],` +
      `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
      `[${inputs}]`;
  
    return S;
  }
  
  public static async generateWithdrawProofCallData(proof: any, publicSignals: any) {
    const result = await Anchor.groth16ExportSolidityCallData(proof, publicSignals);
    const fullProof = JSON.parse("[" + result + "]");
    const pi_a = fullProof[0];
    const pi_b = fullProof[1];
    const pi_c = fullProof[2];

    let proofEncoded = [
      pi_a[0],
      pi_a[1],
      pi_b[0][0],
      pi_b[0][1],
      pi_b[1][0],
      pi_b[1][1],
      pi_c[0],
      pi_c[1],
    ]
    .map(elt => elt.substr(2))
    .join('');

    return proofEncoded;
  }

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address
        + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async setHandler(handlerAddress: string) {
    const tx = await this.contract.setHandler(handlerAddress, BigNumber.from((await this.contract.getProposalNonce())).add(1));
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

  // given a list of leaves and a latest synced block, update internal tree state
  // The function will create a new tree, and check on chain root before updating its member variable
  // If the passed leaves match on chain data, 
  //      update this instance and return true
  // else
  //      return false
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

  // Proposal data is used to update linkedAnchors via bridge proposals 
  // on other chains with this anchor's state
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {

    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("updateEdge(uint256,bytes32,uint256)")).slice(0, 10).padEnd(10, '0');
    const dummyNonce = 1;
    const chainID = getChainIdType(await this.signer.getChainId());
    const merkleRoot = this.depositHistory[leafIndex];

    return '0x' +
      toHex(resourceID, 32).substr(2)+ 
      functionSig.slice(2) + 
      toHex(dummyNonce,4).substr(2) +
      toHex(chainID, 6).substr(2) + 
      toHex(leafIndex, 4).substr(2) + 
      toHex(merkleRoot, 32).substr(2);
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
    
    const tx = await this.contract.deposit(toFixedHex(deposit.commitment), { gasLimit: '0x5B8D80' });
    const receipt = await tx.wait();

    // Deposit history and state altered.
    this.tree.insert(deposit.commitment);
    let index = this.tree.number_of_elements() - 1;
    this.depositHistory[index] = await this.contract.getLastRoot();
    this.latestSyncedBlock = receipt.blockNumber;

    const root = await this.contract.getLastRoot();

    return { deposit, index, originChainId };
  }

  public getAmountToWrap(wrappingFee: number) {
    return BigNumber.from(this.denomination).mul(100).div(100 - wrappingFee);
  }

  /**
   * Assumes the anchor has the correct, full deposit history.
   * 
   */
  public async wrapAndDeposit(tokenAddress: string, wrappingFee: number = 0,destinationChainId?: number): Promise<IAnchorDeposit> {
    const originChainId = getChainIdType(await this.signer.getChainId());
    const chainId = (destinationChainId) ? destinationChainId : originChainId;
    const deposit = Anchor.generateDeposit(chainId);
    let tx: ContractTransaction;
    if (checkNativeAddress(tokenAddress)) {
      tx = await this.contract.wrapAndDeposit(tokenAddress, toFixedHex(deposit.commitment), {
        value: this.getAmountToWrap(wrappingFee).toString(),
        gasLimit: '0x5B8D80'
      });
    } else {
      tx = await this.contract.wrapAndDeposit(tokenAddress, toFixedHex(deposit.commitment), {
        gasLimit: '0x5B8D80'
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

  // sync the local tree with the tree on chain.
  // Start syncing from the given block number, otherwise latest synced block.
  public async update(blockNumber?: number) {
    const filter = this.contract.filters.Deposit();
    const currentBlockNumber = await this.signer.provider!.getBlockNumber();
    const events = await this.contract.queryFilter(filter, blockNumber || this.latestSyncedBlock + 1);
    console.log(`current block number: ${currentBlockNumber} this.latestSyncedBlock: ${this.latestSyncedBlock}`);
    const commitments = events.map((event) => event.args.commitment);

    let index = Object.keys(this.depositHistory).length;
    for (const commitment of commitments) {
      this.tree.insert(commitment);
      this.depositHistory[index] = toFixedHex(this.tree.root());
      index++;
    }

    this.latestSyncedBlock = currentBlockNumber;
  }

  public async populateRootsForProof(): Promise<string[]> {
    const neighborRoots = await this.contract.getLatestNeighborRoots();
    return [await this.contract.getLastRoot(), ...neighborRoots];
  }

  public async generateWitnessInput(
    deposit: IAnchorDepositInfo,
    originChain: number,
    refreshCommitment: string | number,
    recipient: string,
    relayer: string,
    fee: BigInt,
    refund: BigInt,
    roots: string[],
    pathElements: any[],
    pathIndices: any[],
  ): Promise<any> {
    const { chainID, nullifierHash, nullifier, secret } = deposit;
    const extDataHash = getFixedAnchorExtDataHash({_refreshCommitment: refreshCommitment, _recipient: recipient, _relayer: relayer, _fee: fee, _refund: refund});
    let input = {
      // public
      nullifierHash, extDataHash: extDataHash.toString(), chainID, roots,
      // private
      nullifier, secret, pathElements, pathIndices,
    };

    let extData: IFixedAnchorExtData = { 
      _refreshCommitment: toFixedHex(refreshCommitment), 
      _recipient: toFixedHex(recipient, 20), 
      _relayer: toFixedHex(relayer, 20), 
      _fee: fee as bigint, 
      _refund: refund as bigint, 
    };

    return {
      input,
      extData,
    }
  }

  public async checkKnownRoot() {
    const isKnownRoot = await this.contract.isKnownRoot(toFixedHex(await this.tree.root()));
    if (!isKnownRoot) {
      await this.update(this.latestSyncedBlock);
    }
  }

  public async createWitness(data: any) {
    console.log('before witness');
    const buff = await this.zkComponents.witnessCalculator.calculateWTNSBin(data,0);
    console.log('witness created');
    return buff;
  }

  public async proveAndVerify(wtns: any) {
    let res = await snarkjs.groth16.prove(this.zkComponents.zkey, wtns);
    let proof = res.proof;
    let publicSignals = res.publicSignals;

    const vKey = await snarkjs.zKey.exportVerificationKey(this.zkComponents.zkey);
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    if (!res) {
      throw new Error('Verification failed');
    }

    let proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
    return proofEncoded;
  }

  public async setupWithdraw(
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();
    const { merkleRoot, pathElements, pathIndices } = await this.tree.path(index);
    const chainId = getChainIdType(await this.signer.getChainId());
    const roots = await this.populateRootsForProof();
    const refund = BigInt(0);
    const { input, extData } = await this.generateWitnessInput(
      deposit,
      chainId,
      refreshCommitment,
      recipient,
      relayer,
      BigInt(fee),
      refund,
      roots,
      pathElements,
      pathIndices,
    );
    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);
    const args = [
      `0x${proofEncoded}`,
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.extDataHash),
    ];
    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    return {
      input,
      args,
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
    const { args, input, publicInputs, extData } = await this.setupWithdraw(
      deposit,
      index,
      recipient,
      relayer,
      fee,
      refreshCommitment,
    );
    //@ts-ignore
    let tx = await this.contract.withdraw(
      publicInputs,
      extData,
      { gasLimit: '0x5B8D80' }
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
    originChainId: number,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string,
    tokenAddress: string,
  ): Promise<WithdrawalEvent> {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();

    const { merkleRoot, pathElements, pathIndices } = await this.tree.path(index);

    const roots = await this.populateRootsForProof();
    const refund = BigInt(0);

    const { input, extData } = await this.generateWitnessInput(
      deposit,
      originChainId,
      refreshCommitment,
      recipient,
      relayer,
      BigInt(fee),
      refund,
      roots,
      pathElements,
      pathIndices,
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);
    const args = [
      `0x${proofEncoded}`,
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.extDataHash),
    ];

    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    //@ts-ignore
    let tx = await this.contract.withdrawAndUnwrap(publicInputs, extData, tokenAddress, { gasLimit: '0x5B8D80' });
    const receipt = await tx.wait();

    const filter = this.contract.filters.Withdrawal(null, null, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }

  // A bridgedWithdraw needs the merkle proof to be generated from an anchor other than this one,
  public async bridgedWithdrawAndUnwrap(
    deposit: IAnchorDeposit,
    merkleProof: any,
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string,
    tokenAddress: string,
  ): Promise<WithdrawalEvent> {
    const { pathElements, pathIndices, merkleRoot } = merkleProof;
    const isKnownNeighborRoot = await this.contract.isKnownNeighborRoot(deposit.originChainId, toFixedHex(merkleRoot));
    if (!isKnownNeighborRoot) {
      throw new Error("Neighbor root not found");
    }
    refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';

    const roots = await this.populateRootsForProof();

    const { input, extData } = await this.generateWitnessInput(
      deposit.deposit,
      deposit.originChainId,
      refreshCommitment,
      recipient,
      relayer,
      BigInt(fee),
      BigInt(refund),
      roots,
      pathElements,
      pathIndices,
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);

    const args = [
      `0x${proofEncoded}`,
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.extDataHash),
    ];

    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    //@ts-ignore
    let tx = await this.contract.withdrawAndUnwrap(
      publicInputs,
      extData,
      tokenAddress,
      {
        gasLimit: '0x5B8D80'
      },
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
    deposit: IAnchorDepositInfo,
    merkleProof: any,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ) {
    const { pathElements, pathIndices } = merkleProof;

    // first, check if the merkle root is known on chain - if not, then update
    const chainId = getChainIdType(await this.signer.getChainId());
    const roots = await this.populateRootsForProof();
    const refund = BigInt(0);
    const { input, extData } = await this.generateWitnessInput(
      deposit,
      chainId,
      refreshCommitment,
      recipient,
      relayer,
      BigInt(fee),
      refund,
      roots,
      pathElements,
      pathIndices,
    );
    console.log('input retrieved: ', input);
    console.log('input secret: ', input.secret);
    console.log('input nullifierHash: ', input.nullifierHash);
    console.log('input roots: ', input.roots);
    console.log('input pathIndices: ', input.pathIndices);
    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);
    const args = [
      `0x${proofEncoded}`,
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.extDataHash),
    ];
    const publicInputs = Anchor.convertArgsArrayToStruct(args);

    return {
      input,
      args,
      publicInputs,
      extData,
    };
  }

  public async bridgedWithdraw(
    deposit: IAnchorDeposit,
    merkleProof: any,
    recipient: string,
    relayer: string,
    fee: string,
    refund: string,
    refreshCommitment: string,
  ): Promise<WithdrawalEvent> {
    const { pathElements, pathIndices, merkleRoot } = merkleProof;
    const isKnownNeighborRoot = await this.contract.isKnownNeighborRoot(deposit.originChainId, toFixedHex(merkleRoot));
    if (!isKnownNeighborRoot) {
      throw new Error("Neighbor root not found");
    }
    refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';

    const lastRoot = await this.tree.root();

    const roots = await this.populateRootsForProof();

    const { input, extData } = await this.generateWitnessInput(
      deposit.deposit,
      deposit.originChainId,
      refreshCommitment,
      recipient,
      relayer,
      BigInt(fee),
      BigInt(refund),
      roots,
      pathElements,
      pathIndices,
    );

    const wtns = await this.createWitness(input);
    let proofEncoded = await this.proveAndVerify(wtns);

    const args = [
      `0x${proofEncoded}`,
      Anchor.createRootsBytes(input.roots),
      toFixedHex(input.nullifierHash),
      toFixedHex(input.extDataHash),
    ];

    const publicInputs = Anchor.convertArgsArrayToStruct(args);
    //@ts-ignore
    let tx = await this.contract.withdraw(
      publicInputs,
      extData,
      {
        gasLimit: '0x5B8D80'
      },
    );

    const receipt = await tx.wait();
    
    const filter = this.contract.filters.Withdrawal(null, relayer, null);
    const events = await this.contract.queryFilter(filter, receipt.blockHash);
    return events[0];
  }
}

export { Anchor };
