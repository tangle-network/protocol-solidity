import { BigNumber, BigNumberish, BytesLike, ethers } from 'ethers';
import { Log } from '@ethersproject/abstract-provider';
import {
  VAnchorTree as VAnchorTreeContract,
  VAnchorTree__factory,
  VAnchorEncodeInputs__factory,
  ERC20,
  ERC20__factory,
} from '@webb-tools/contracts';
import {
  toFixedHex,
  Utxo,
  MerkleTree,
  CircomProvingManager,
  ProvingManagerSetupInput,
  MerkleProof,
  FIELD_SIZE,
  LeafIdentifier,
  Keypair,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import {
  IVAnchor,
  IVariableAnchorExtData,
  IVariableAnchorPublicInputs,
} from '@webb-tools/interfaces';
import { WebbBridge } from './Common';
import { Deployer } from '@webb-tools/create2-utils';
import { hexToU8a, u8aToHex, getChainIdType, ZkComponents, ZERO_BYTES32 } from '@webb-tools/utils';
import { SetupTransactionResult, TransactionOptions } from '.';

const zeroAddress = '0x0000000000000000000000000000000000000000';

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
    super(contract, signer);
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
      BigNumber.from(levels).toNumber(),
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
      BigNumber.from(levels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    const tx = await createdVAnchor.contract.initialize(
      BigNumber.from('1'),
      BigNumber.from(2).pow(256).sub(1)
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

  public async populateRootsForProof(): Promise<BigNumber[]> {
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

  public generatePublicInputs(
    proof: any,
    roots: BigNumber[],
    inputs: Utxo[],
    outputs: Utxo[],
    publicAmount: BigNumberish,
    extDataHash: BigNumber
  ): IVariableAnchorPublicInputs {
    // public inputs to the contract
    const args: IVariableAnchorPublicInputs = {
      proof: `0x${proof}`,
      roots: `0x${roots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      extensionRoots: '0x',
      inputNullifiers: inputs.map((x) => BigNumber.from(toFixedHex('0x' + x.nullifier))),
      outputCommitments: [
        BigNumber.from(toFixedHex(u8aToHex(outputs[0].commitment))),
        BigNumber.from(toFixedHex(u8aToHex(outputs[1].commitment))),
      ],
      publicAmount: toFixedHex(publicAmount),
      extDataHash,
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

  // Verify the leaf occurred at the reported block
  // This is important to check the behavior of relayers before modifying local storage
  async leafCreatedAtBlock(leaf: string, blockNumber: number): Promise<boolean> {
    const filter = this.contract.filters.NewCommitment(null, null, null);
    const logs = await this.contract.provider.getLogs({
      fromBlock: blockNumber,
      toBlock: blockNumber,
      ...filter,
    });
    const events = logs.map((log) => this.contract.interface.parseLog(log));

    for (let i = 0; i < events.length; i++) {
      if (events[i].args.commitment?._hex === leaf) {
        return true;
      }
    }

    return false;
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
    leavesMap: Record<string, Uint8Array[]>
  ): Promise<SetupTransactionResult> {
    // first, check if the merkle root is known on chain - if not, then update
    if (wrapUnwrapToken.length === 0) {
      wrapUnwrapToken = this.token;
    }

    if (outputs.length !== 2) {
      throw new Error('Only two outputs are supported');
    }
    const chainId = getChainIdType(await this.signer.getChainId());
    const roots = await this.populateRootsForProof();
    let extAmount = this.getExtAmount(inputs, outputs, fee);

    // calculate the sum of input notes (for calculating the public amount)
    let sumInputUtxosAmount: BigNumberish = 0;

    // Pass the identifier for leaves alongside the proof input
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigNumber.from(sumInputUtxosAmount).add(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index,
        typedChainId: Number(inputUtxo.originChainId),
      });
    }

    const encryptedCommitments: [Uint8Array, Uint8Array] = [
      hexToU8a(outputs[0].encrypt()),
      hexToU8a(outputs[1].encrypt()),
    ];

    const proofInput: ProvingManagerSetupInput<'vanchor'> = {
      inputUtxos: inputs,
      leavesMap,
      leafIds,
      roots: roots.map((root) => hexToU8a(root.toHexString())),
      chainId: chainId.toString(),
      output: [outputs[0], outputs[1]],
      encryptedCommitments,
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      provingKey:
        inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigNumber.from(extAmount)),
      fee: BigNumber.from(fee).toString(),
      refund: BigNumber.from(refund).toString(),
      token: hexToU8a(wrapUnwrapToken),
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

    const publicInputs: IVariableAnchorPublicInputs = this.generatePublicInputs(
      proof.proof,
      roots,
      inputs,
      outputs,
      proofInput.publicAmount,
      BigNumber.from(u8aToHex(proof.extDataHash))
    );

    const extData: IVariableAnchorExtData = {
      recipient: toFixedHex(proofInput.recipient, 20),
      extAmount: toFixedHex(proofInput.extAmount),
      relayer: toFixedHex(proofInput.relayer, 20),
      fee: toFixedHex(proofInput.fee),
      refund: toFixedHex(proofInput.refund),
      token: toFixedHex(proofInput.token, 20),
      encryptedOutput1: u8aToHex(proofInput.encryptedCommitments[0]),
      encryptedOutput2: u8aToHex(proofInput.encryptedCommitments[1]),
    };

    return {
      extAmount,
      extData,
      publicInputs,
    };
  }

  public updateTreeState(outputs: Utxo[]): void {
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
    const chainId = getChainIdType(await this.signer.getChainId());

    let sumInputUtxosAmount: BigNumberish = 0;
    let leafIds: LeafIdentifier[] = [];

    for (const inputUtxo of inputs) {
      sumInputUtxosAmount = BigNumber.from(sumInputUtxosAmount).add(inputUtxo.amount);
      leafIds.push({
        index: inputUtxo.index,
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
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      provingKey:
        inputs.length > 2 ? this.largeCircuitZkComponents.zkey : this.smallCircuitZkComponents.zkey,
      relayer: hexToU8a(relayer),
      recipient: hexToU8a(recipient),
      extAmount: toFixedHex(BigNumber.from(extAmount)),
      fee: BigNumber.from(fee).toString(),
      refund: BigNumber.from(refund).toString(),
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

  public async transact(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrapUnwrapToken: string,
    leavesMap: Record<string, Uint8Array[]>,
    txOptions?: TransactionOptions
  ): Promise<ethers.ContractReceipt | SetupTransactionResult> {
    // Default UTXO chain ID will match with the configured signer's chain ID
    inputs = await this.padUtxos(inputs, 16);
    outputs = await this.padUtxos(outputs, 2);

    const { extData, extAmount, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      fee,
      refund,
      recipient,
      relayer,
      wrapUnwrapToken,
      leavesMap
    );

    if (txOptions?.relaying) {
      return { extAmount, extData, publicInputs };
    } else {
      let options = await this.getWrapUnwrapOptions(extAmount, wrapUnwrapToken);

      if (txOptions?.gasLimit) {
        options = { ...options, gasLimit: txOptions.gasLimit };
      }

      if (txOptions?.gasPrice) {
        options = { ...options, gasPrice: txOptions.gasPrice };
      }

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
        options
      );
      const receipt = await tx.wait();
      // Add the leaves to the tree
      this.updateTreeState(outputs);
      return receipt;
    }
  }

  public async register(owner: string, keyData: BytesLike): Promise<ethers.ContractReceipt> {
    const tx = await this.contract.register({
      owner,
      keyData,
    });
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
    leavesMap: Record<string, Uint8Array[]>,
    txOptions?: TransactionOptions
  ): Promise<ethers.ContractReceipt> {
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

    let options = await this.getWrapUnwrapOptions(extAmount, wrapUnwrapToken);

    if (txOptions?.gasLimit) {
      options = { ...options, gasLimit: txOptions.gasLimit };
    }

    if (txOptions?.gasPrice) {
      options = { ...options, gasPrice: txOptions.gasPrice };
    }

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
          BigNumber.from(publicInputs.outputCommitments[0]),
          BigNumber.from(publicInputs.outputCommitments[1]),
        ],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      {
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      options
    );
    const receipt = await tx.wait();

    // Add the leaves to the tree
    this.updateTreeState(outputs);

    return receipt;
  }

  async getWebbToken(): Promise<ERC20> {
    const tokenAddress = await this.contract.token();
    const tokenInstance = ERC20__factory.connect(tokenAddress, this.signer);

    return tokenInstance;
  }

  async isWebbTokenApprovalRequired(depositAmount: BigNumberish) {
    const userAddress = await this.signer.getAddress();
    const tokenInstance = await this.getWebbToken();
    const tokenAllowance = await tokenInstance.allowance(userAddress, this.contract.address);

    if (tokenAllowance < depositAmount) {
      return true;
    }

    return false;
  }

  async isWrappableTokenApprovalRequired(tokenAddress: string, depositAmount: BigNumberish) {
    const userAddress = await this.signer.getAddress();
    const webbToken = await this.getWebbToken();
    const tokenAllowance = await webbToken.allowance(userAddress, webbToken.address);

    if (tokenAllowance < depositAmount) {
      return true;
    }

    return false;
  }

  async hasEnoughBalance(depositAmount: BigNumberish, tokenAddress?: string) {
    const userAddress = await this.signer.getAddress();
    let tokenBalance: BigNumber;

    // If a token address was supplied, the user is querying for enough balance of a wrappableToken
    if (tokenAddress) {
      // query for native balance
      if (tokenAddress === zeroAddress) {
        tokenBalance = await this.signer.getBalance();
      } else {
        const tokenInstance = ERC20__factory.connect(tokenAddress, this.signer);

        tokenBalance = await tokenInstance.balanceOf(userAddress);
      }
    } else {
      // Querying for balance of the webbToken
      const tokenInstance = await this.getWebbToken();

      tokenBalance = await tokenInstance.balanceOf(userAddress);
    }

    if (tokenBalance.lt(BigNumber.from(depositAmount))) {
      return false;
    }

    return true;
  }

  async getDepositLeaves(
    startingBlock: number,
    finalBlock: number,
    abortSignal: AbortSignal,
    retryPromise
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
        const nextLogs = await retryPromise(
          () => {
            return this.contract.provider.getLogs({
              fromBlock: i,
              toBlock: finalBlock - i > step ? i + step : finalBlock,
              ...filter,
            });
          },
          20,
          10,
          abortSignal
        );

        logs = [...logs, ...nextLogs];

        console.log(`Getting logs for block range: ${i} through ${i + step}`);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }

    const events = logs.map((log) => this.contract.interface.parseLog(log));

    const newCommitments = events
      .sort((a, b) => a.args.index - b.args.index) // Sort events in chronological order
      .map((e) => BigNumber.from(e.args.commitment).toHexString());
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
    abortSignal: AbortSignal,
    retryPromise: any
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
        const nextLogs = await retryPromise(
          () => {
            return this.contract.provider.getLogs({
              fromBlock: i,
              toBlock: finalBlock - i > step ? i + step : finalBlock,
              ...filter,
            });
          },
          20,
          10,
          abortSignal
        );

        logs = [...logs, ...nextLogs];

        console.log(`Getting logs for block range: ${i} through ${i + step}`);
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
          const alreadySpent = await this.contract.isSpent(
            toFixedHex(`0x${regeneratedUtxo.nullifier}`, 32)
          );
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

    // Unsure why the following filter statement does not change type from (Utxo | undefined)[] to Utxo[]
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const decryptedUtxos: Utxo[] = utxos.filter((value) => value !== undefined);

    return decryptedUtxos;
  }
}

export default VAnchor;
