import { Log } from '@ethersproject/abstract-provider';
import {
  ERC20,
  ERC20__factory,
  VAnchorEncodeInputs__factory,
  VAnchorTree as VAnchorTreeContract,
  VAnchorTree__factory,
} from '@webb-tools/contracts';
import {
  IVAnchor,
  IVariableAnchorExtData,
  IVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import {
  CircomProvingManager,
  CircomUtxo,
  FIELD_SIZE,
  Keypair,
  LeafIdentifier,
  MerkleProof,
  MerkleTree,
  ProvingManagerSetupInput,
  Utxo,
  generateVariableWitnessInput,
  toFixedHex,
} from '@webb-tools/sdk-core';
import {
  VAnchorProofInputs,
  ZERO_BYTES32,
  ZkComponents,
  getChainIdType,
  hexToU8a,
  u8aToHex,
} from '@webb-tools/utils';
import { BigNumberish, BytesLike, ContractTransactionReceipt, Overrides, ethers } from 'ethers';
import { PayableOverrides } from '@ethersproject/contracts';
import { groth16 } from 'snarkjs';
import { WebbBridge } from './Common';
import { Deployer } from './Deployer';
import { OverridesWithFrom, SetupTransactionResult, TransactionOptions } from './types';
import { zeroAddress } from './utils';

// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods
export class VAnchor extends WebbBridge implements IVAnchor {
  contract: VAnchorTreeContract;

  maxEdges: number;
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  token?: string;
  denomination?: string;
  provingManager: CircomProvingManager;

  constructor(
    contract: VAnchorTreeContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
    super(contract, signer, treeHeight);
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.maxEdges = maxEdges;
    this.depositHistory = {};
    this.smallCircuitZkComponents = smallCircuitZkComponents;
    this.largeCircuitZkComponents = largeCircuitZkComponents;
  }

  public static async create2VAnchor(
    deployer: Deployer,
    saltHex: string,
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const { contract: libraryContract } = await deployer.deploy(
      VAnchorEncodeInputs__factory,
      saltHex,
      signer
    );

    let libraryAddresses = {
      ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: libraryContract.address,
    };

    const argTypes = ['address', 'uint32', 'address', 'address', 'address', 'uint8'];
    const args = [verifier, levels, hasher, handler, token, maxEdges];
    const { contract: vanchor, receipt } = await deployer.deploy(
      VAnchorTree__factory,
      saltHex,
      signer,
      libraryAddresses,
      argTypes,
      args
    );
    const createdVAnchor = new VAnchor(
      vanchor,
      signer,
      Number(levels),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = receipt.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async createVAnchor(
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const encodeLibraryFactory = new VAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    await encodeLibrary.deployed();

    const factory = new VAnchorTree__factory(
      { ['contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs']: encodeLibrary.address },
      signer
    );
    const vAnchor = await factory.deploy(verifier, levels, hasher, handler, token, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new VAnchor(
      vAnchor,
      signer,
      Number(levels),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    const tx = await createdVAnchor.contract.initialize(
      BigInt('1'),
      BigInt('2') ^ (BigInt('256') - BigInt('1'))
    );
    await tx.wait();
    return createdVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const anchor = VAnchorTree__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges();
    const treeHeight = await anchor.levels();
    const createdAnchor = new VAnchor(
      anchor,
      signer,
      treeHeight,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public static convertToPublicInputsStruct(args: any[]): IVariableAnchorPublicInputs {
    return {
      proof: args[0],
      roots: args[1],
      extensionRoots: '0x00',
      inputNullifiers: args[2],
      outputCommitments: args[3],
      publicAmount: args[4],
      extDataHash: args[5],
    };
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

  public async populateRootsForProof(): Promise<BigInt[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData: any) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot, ...neighborRootInfos];
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns
   */
  public getMerkleProof(input: Utxo, leavesMap?: BigNumberish[]): MerkleProof {
    let inputMerklePathIndices: number[];
    let inputMerklePathElements: BigNumberish[];

    if (Number(input.amount) > 0) {
      if (input.index === undefined) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} index was not set`);
      }
      if (input.index < 0) {
        throw new Error(`Input commitment ${u8aToHex(input.commitment)} index should be >= 0`);
      }
      if (leavesMap === undefined) {
        const path = this.tree.path(input.index);
        inputMerklePathIndices = path.pathIndices;
        inputMerklePathElements = path.pathElements;
      } else {
        const mt = new MerkleTree(this.treeHeight, leavesMap);
        const path = mt.path(input.index);
        inputMerklePathIndices = path.pathIndices;
        inputMerklePathElements = path.pathElements;
      }
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

  public generatePublicInputs(
    proof: any,
    roots: BigInt[],
    inputs: Utxo[],
    outputs: Utxo[],
    publicAmount: BigNumberish,
    extDataHash: BigInt
  ): IVariableAnchorPublicInputs {
    // public inputs to the contract
    const args: IVariableAnchorPublicInputs = {
      proof: `0x${proof}`,
      roots: `0x${roots.map((x) => toFixedHex(x.toString()).slice(2)).join('')}`,
      extensionRoots: '0x',
      inputNullifiers: inputs.map((x) => BigInt(toFixedHex('0x' + x.nullifier))),
      outputCommitments: [
        BigInt(toFixedHex(u8aToHex(outputs[0].commitment))),
        BigInt(toFixedHex(u8aToHex(outputs[1].commitment))),
      ],
      publicAmount: toFixedHex(publicAmount),
      extDataHash: extDataHash.toString(),
    };

    return args;
  }

  /**
   * Given a list of leaves and a latest synced block, update internal tree state
   * The function will create a new tree, and check on chain root before updating its member variable
   * If the passed leaves match on chain data,
   *   update this instance and return true
   * else
   *   return false
   */

  // Verify the leaf occurred at the reported block
  // This is important to check the behavior of relayers before modifying local storage
  async leafCreatedAtBlock(leaf: string, blockNumber: number): Promise<boolean> {
    const filter = this.contract.filters.NewCommitment(null, null, null);
    const logs = await this.contract.provider.getLogs({
      fromBlock: blockNumber,
      toBlock: blockNumber,
      ...filter,
    });
    const events = logs.map((log: any) => this.contract.interface.parseLog(log));

    for (let i = 0; i < events.length; i++) {
      if (events[i].args.commitment?._hex === leaf) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate the proof inputs given all private and public inputs for the zkSNARK
   * @param inputs The input UTXOs
   * @param outputs The output UTXOs
   * @param chainId The chain ID where the transaction is happening
   * @param extAmount The external amount defining a deposit, transfer, or withdrawal
   * @param fee The fee for the relayer
   * @param extDataHash The external data hash for the transaction
   * @param leavesMap The leaves map for the transaction
   * @param txOptions The transaction options
   * @returns
   */
  public async generateProofInputs(
    inputs: Utxo[],
    outputs: Utxo[],
    chainId: number,
    extAmount: BigNumberish,
    fee: BigNumberish,
    extDataHash: BigNumberish,
    leavesMap: Record<string, BigNumberish[]>, // subtree leaves
    txOptions?: TransactionOptions
  ): Promise<VAnchorProofInputs> {
    const vanchorRoots = await this.populateRootsForProof();
    let vanchorMerkleProof: any;
    if (Object.keys(leavesMap).length === 0) {
      vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x));
    } else {
      const treeChainId: string | undefined = txOptions?.treeChainId;
      if (treeChainId === undefined) {
        throw new Error(
          'Need to specify chainId on txOptions in order to generate merkleProof correctly'
        );
      }
      const treeElements: BigNumberish[] = leavesMap[treeChainId];
      vanchorMerkleProof = inputs.map((x) => this.getMerkleProof(x, treeElements));
    }
    const vanchorInput: VAnchorProofInputs = await generateVariableWitnessInput(
      vanchorRoots.map((root) => root.toString()),
      chainId,
      inputs,
      outputs,
      extAmount,
      fee,
      BigInt(extDataHash),
      vanchorMerkleProof
    );

    return vanchorInput;
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
   * @returns `SetupTransactionResult` object
   */
  public async setupTransaction(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, BigNumberish[]>,
    txOptions?: TransactionOptions
  ): Promise<SetupTransactionResult> {
    // WrapUnwrap token validation
    if (wrapUnwrapToken.length === 0) {
      if (!this.token) {
        throw new Error('Token address not set');
      }

      wrapUnwrapToken = this.token;
    }

    // Output length validation
    if (outputs.length !== 2) {
      throw new Error('Only two outputs are supported');
    }

    // Get chainId
    const chainIdBigInt = (await this.signer.provider?.getNetwork())?.chainId;
    const chainId = getChainIdType(Number(chainIdBigInt));
    const roots = await this.populateRootsForProof();
    let extAmount = this.getExtAmount(inputs, outputs, fee);

    // calculate the sum of input notes (for calculating the public amount)
    let sumInputUtxosAmount: BigNumberish = 0;

    // Pass the identifier for leaves alongside the proof input
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigInt(sumInputUtxosAmount) + BigInt(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index!, // TODO: remove non-null assertion here
        typedChainId: Number(inputUtxo.originChainId),
      });
    }

    const { extData, extDataHash } = await this.generateExtData(
      recipient,
      BigInt(extAmount),
      relayer,
      BigInt(fee),
      BigInt(refund),
      wrapUnwrapToken,
      outputs[0].encrypt(),
      outputs[1].encrypt()
    );
    const proofInput: VAnchorProofInputs = await this.generateProofInputs(
      inputs,
      outputs,
      chainId,
      BigInt(extAmount),
      BigInt(fee),
      extDataHash.toString(),
      leavesMap,
      txOptions
    );

    let wasmFile;
    let zkeyFile;
    if (inputs.length > 2) {
      wasmFile = this.largeCircuitZkComponents.wasm;
      zkeyFile = this.largeCircuitZkComponents.zkey;
    } else {
      wasmFile = this.smallCircuitZkComponents.wasm;
      zkeyFile = this.smallCircuitZkComponents.zkey;
    }

    let proof = await groth16.fullProve(proofInput, wasmFile, zkeyFile);

    const publicInputs: IVariableAnchorPublicInputs = this.generatePublicInputs(
      proof.proof,
      roots,
      inputs,
      outputs,
      proofInput.publicAmount,
      BigInt(u8aToHex(proof.extDataHash))
    );

    return {
      extAmount,
      extData,
      publicInputs,
    };
  }

  public updateTreeOrForestState(outputs: Utxo[]): void {
    outputs.forEach((x) => {
      this.tree.insert(u8aToHex(x.commitment));
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });
  }

  public async generateProof(
    roots: string[],
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    tokenAddress: string,
    recipient: string,
    relayer: string,
    leavesMap: Record<string, Uint8Array[]>
  ) {
    let extAmount = this.getExtAmount(inputs, outputs, fee);

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];
    const chainIdBigInt = (await this.signer.provider?.getNetwork())?.chainId;
    const chainId = getChainIdType(Number(chainIdBigInt));

    let sumInputUtxosAmount: BigNumberish = 0;
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigInt(sumInputUtxosAmount) + BigInt(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index!, // TODO: remove non-null assertion here
        typedChainId: Number(inputUtxo.originChainId),
      });
    }

    const proofInput: ProvingManagerSetupInput<'vanchor'> = {
      inputUtxos: inputs,
      leavesMap,
      leafIds,
      roots: roots.map((root) => hexToU8a(root)),
      chainId: chainId.toString(),
      output: [outputs[0], outputs[1]],
      encryptedCommitments,
      publicAmount: (
        BigInt(extAmount) -
        BigInt(fee) +
        (BigInt(FIELD_SIZE) % BigInt(FIELD_SIZE))
      ).toString(),
      provingKey:
        inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigInt(extAmount)),
      fee: BigInt(fee).toString(),
      refund: BigInt(refund).toString(),
      token: hexToU8a(tokenAddress),
    };

    inputs.length > 2
      ? (this.provingManager = new CircomProvingManager(
          this.largeCircuitZkComponents.wasm,
          this.tree.levels,
          null
        ))
      : (this.provingManager = new CircomProvingManager(
          this.smallCircuitZkComponents.wasm,
          this.tree.levels,
          null
        ));

    const proof = await this.provingManager.prove('vanchor', proofInput);
    return { proof, extAmount, proofInput };
  }

  public async register(
    owner: string,
    keyData: BytesLike,
    overridesTransaction?: OverridesWithFrom<Overrides>
  ): Promise<ContractTransactionReceipt> {
    const tx = await this.contract.register(
      {
        owner,
        keyData,
      },
      overridesTransaction
    );

    const receipt = await tx.wait();
    return receipt;
  }

  public async registerAndTransact(
    owner: string,
    keyData: string,
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, BigNumberish[]>,
    overridesTransaction?: PayableOverrides
  ): Promise<ContractTransactionReceipt> {
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extAmount, extData, publicInputs } = await this.setupTransaction(
      inputs,
      [outputs[0], outputs[1]],
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    let options = await this.getWrapUnwrapOptions(
      BigInt(extAmount),
      BigInt(refund),
      wrapUnwrapToken
    );

    let tx = await this.contract.registerAndTransact(
      { owner, keyData: keyData },
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
        extensionRoots: [],
        inputNullifiers: publicInputs.inputNullifiers,
        outputCommitments: [
          BigInt(publicInputs.outputCommitments[0]),
          BigInt(publicInputs.outputCommitments[1]),
        ],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      {
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      { ...options, ...overridesTransaction }
    );
    const receipt = await tx.wait();

    // Add the leaves to the tree
    this.updateTreeOrForestState(outputs);

    return receipt;
  }

  async getWebbToken(): Promise<ERC20> {
    const tokenAddress = await this.contract.token();
    const tokenInstance = ERC20__factory.connect(tokenAddress, this.signer);

    return tokenInstance;
  }

  public async setWithLeaves(leaves: string[], syncedBlock?: number): Promise<Boolean> {
    let newTree = new MerkleTree(this.tree.levels, leaves);
    let root = toFixedHex(newTree.root());
    let validTree = await this.contract.isKnownRoot(root);

    if (validTree) {
      let index = 0;
      for (const _leaf of newTree.elements()) {
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
      this.latestSyncedBlock = syncedBlock;
      return true;
    } else {
      return false;
    }
  }

  async isWebbTokenApprovalRequired(depositAmount: BigNumberish) {
    const userAddress = await this.signer.getAddress();
    const tokenInstance = await this.getWebbToken();
    const tokenAllowance = await tokenInstance.allowance(userAddress, this.contract.address);

    if (tokenAllowance.lt(depositAmount)) {
      return true;
    }

    return false;
  }

  async isWrappableTokenApprovalRequired(tokenAddress: string, depositAmount: BigNumberish) {
    const userAddress = await this.signer.getAddress();
    const tokenInstance = ERC20__factory.connect(tokenAddress, this.signer);
    const tokenAllowance = await tokenInstance.allowance(userAddress, this.contract.address);

    if (tokenAllowance.lt(depositAmount)) {
      return true;
    }

    return false;
  }

  async hasEnoughBalance(depositAmount: BigNumberish, tokenAddress?: string) {
    const userAddress = await this.signer.getAddress();
    let tokenBalance: BigInt;

    // If a token address was supplied, the user is querying for enough balance of a wrappableToken
    if (tokenAddress) {
      // query for native balance
      if (tokenAddress === zeroAddress) {
        tokenBalance = await this.signer.provider!.getBalance(await this.signer.getAddress());
      } else {
        const tokenInstance = ERC20__factory.connect(tokenAddress, this.signer);

        tokenBalance = await tokenInstance.balanceOf(userAddress);
      }
    } else {
      // Querying for balance of the webbToken
      const tokenInstance = await this.getWebbToken();

      tokenBalance = await tokenInstance.balanceOf(userAddress);
    }

    if (BigInt(tokenBalance.toString()) < BigInt(depositAmount)) {
      return false;
    }

    return true;
  }

  async getDepositLeaves(
    startingBlock: number,
    finalBlock: number,
    retryPromise: (...args: any[]) => PromiseLike<any>, // TODO: Determine the type of this function
    abortSignal?: AbortSignal
  ): Promise<{ lastQueriedBlock: number; newLeaves: string[] }> {
    const filter = this.contract.filters.NewCommitment(null, null, null);

    console.log('Getting leaves with filter', filter);
    finalBlock = finalBlock || (await this.contract.provider.getBlockNumber());
    console.log(`finalBlock detected as: ${finalBlock}`);

    let logs: Array<Log> = []; // Read the stored logs into this variable
    const step = 1000; // Metamask infura caps requests at 1000 blocks
    console.log(`Fetching leaves with steps of ${step} logs/request`);

    try {
      for (let i = startingBlock; i <= finalBlock; i += step) {
        const toBlock = finalBlock - i > step ? i + step - 1 : finalBlock;
        const nextLogs = await retryPromise(
          () => {
            return this.contract.provider.getLogs({
              fromBlock: i,
              toBlock,
              ...filter,
            });
          },
          20,
          10,
          abortSignal
        );

        logs = [...logs, ...nextLogs];

        console.log(`Getting logs for block range: ${i} through ${toBlock}`);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }

    const events = logs.map((log) => this.contract.interface.parseLog(log));

    const newCommitments = events
      .sort((a, b) => a.args.index - b.args.index) // Sort events in chronological order
      .map((e) => toFixedHex(BigInt(e.args.commitment).toString(16)));
    return {
      lastQueriedBlock: finalBlock,
      newLeaves: newCommitments,
    };
  }

  // This function will query the chain for notes that are spendable by a keypair in a block range
  async getSpendableUtxosFromChain(
    owner: Keypair,
    startingBlock: number,
    finalBlock: number,
    retryPromise: (...args: any[]) => PromiseLike<any>, // TODO: Determine the type of this function
    abortSignal?: AbortSignal
  ): Promise<Utxo[]> {
    const filter = this.contract.filters.NewCommitment(null, null, null);
    let logs: Array<Log> = []; // Read the stored logs into this variable

    finalBlock = finalBlock || (await this.contract.provider.getBlockNumber());
    console.log(`Getting notes from chain`);
    // number of blocks to query at a time
    const step = 1000;
    console.log(`Fetching notes with steps of ${step} logs/request`);

    try {
      for (let i = startingBlock; i < finalBlock; i += step) {
        const toBlock = finalBlock - i > step ? i + step - 1 : finalBlock;
        const nextLogs = await retryPromise(
          () => {
            return this.contract.provider.getLogs({
              fromBlock: i,
              toBlock,
              ...filter,
            });
          },
          20,
          10,
          abortSignal
        );

        logs = [...logs, ...nextLogs];

        console.log(`Getting logs for block range: ${i} through ${toBlock}`);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }

    const events = logs.map((log) => this.contract.interface.parseLog(log));
    const encryptedCommitments: string[] = events
      .sort((a, b) => a.args.index - b.args.index) // Sort events in chronological order
      .map((e) => e.args.encryptedOutput);

    // Attempt to decrypt with the owner's keypair
    const utxos = await Promise.all(
      encryptedCommitments.map(async (enc, index) => {
        try {
          const decryptedUtxo = await CircomUtxo.decrypt(owner, enc);
          // In order to properly calculate the nullifier, an index is required.
          // The decrypt function generates a utxo without an index, and the index is a readonly property.
          // So, regenerate the utxo with the proper index.
          const regeneratedUtxo = await CircomUtxo.generateUtxo({
            amount: decryptedUtxo.amount,
            backend: 'Circom',
            blinding: hexToU8a(decryptedUtxo.blinding),
            chainId: decryptedUtxo.chainId,
            curve: 'Bn254',
            keypair: owner,
            index: index.toString(),
          });

          return regeneratedUtxo;
        } catch (e) {
          return undefined;
        }
      })
    );

    // Unsure why the following filter statement does not change type from (Utxo | undefined)[] to Utxo[]
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const decryptedUtxos: Utxo[] = utxos.filter((value) => value !== undefined);

    return decryptedUtxos;
  }
}

export default VAnchor;
