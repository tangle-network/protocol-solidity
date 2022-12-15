import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  MultiAssetVAnchorTree as MultiAssetVAnchorTreeContract,
  MultiAssetVAnchorTree__factory,
  MASPVAnchorEncodeInputs__factory,
  TokenWrapper__factory,
  Registry__factory,
} from '@webb-tools/contracts';
import {
  toHex,
  Keypair,
  toFixedHex,
  MerkleTree,
  median,
  mean,
  max,
  min,
  randomBN,
  CircomProvingManager,
  ProvingManagerSetupInput,
  MerkleProof,
  FIELD_SIZE,
  LeafIdentifier,
  getVAnchorExtDataHash,
  token2CurrencyId,
  Utxo,
} from '@webb-tools/sdk-core';
import {
  IMASPVAnchorPublicInputs,
  IVAnchor,
} from '@webb-tools/interfaces';
import { u8aToHex, getChainIdType, ZkComponents, MASPAllInputs, MaspUtxo } from '@webb-tools/utils';
import { fromAscii } from 'web3-utils';
import { Registry } from '@webb-tools/tokens';
import { EthAbiDecodeParametersResultArray } from 'web3/eth/abi';
const snarkjs = require('snarkjs');
const assert = require('assert');

export type FullProof = {
  proof: Proof;
  publicSignals: RawPublicSignals;
};

export type Proof = {
  pi_a: string[3];
  pi_b: Array<string[2]>;
  pi_c: string[3];
  protocol: string;
  curve: string;
};

export type MASPVAnchorInputs = {
  allInputs: MASPAllInputs;
  publicInputs: IMASPVAnchorPublicInputs;
}

export type ExtData = {
  recipient: string;
  extAmount: string;
  relayer: string;
  fee: string;
  refund: string;
  token: string;
  encryptedOutput1: string;
  encryptedOutput2: string;
};

export type RawPublicSignals = string[11];

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
export class MultiAssetVAnchor implements IVAnchor {
  signer: ethers.Signer;
  contract: MultiAssetVAnchorTreeContract;
  tree: MerkleTree;
  // hex string of the connected root
  maxEdges: number;
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  provingManager: CircomProvingManager;

  constructor(
    contract: MultiAssetVAnchorTreeContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.maxEdges = maxEdges;
    this.depositHistory = {};
    this.smallCircuitZkComponents = smallCircuitZkComponents;
    this.largeCircuitZkComponents = largeCircuitZkComponents;
  }

  getAddress(): string {
    return this.contract.address;
  }

  public static async createMASPVAnchor(
    registry: string,
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const encodeLibraryFactory = new MASPVAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    await encodeLibrary.deployed();

    const factory = new MultiAssetVAnchorTree__factory(
      { ['contracts/libs/MASPVAnchorEncodeInputs.sol:MASPVAnchorEncodeInputs']: encodeLibrary.address },
      signer
    );
    const maspVAnchor = await factory.deploy(registry, verifier, levels, hasher, handler, maxEdges, {});
    await maspVAnchor.deployed();
    const createdMASPVAnchor = new MultiAssetVAnchor(
      maspVAnchor,
      signer,
      BigNumber.from(levels).toNumber(),
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
    createdMASPVAnchor.latestSyncedBlock = maspVAnchor.deployTransaction.blockNumber!;
    const tx = await createdMASPVAnchor.contract.initialize(
      BigNumber.from('1'),
      BigNumber.from(2).pow(256).sub(1)
    );
    await tx.wait();
    return createdMASPVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    const anchor = MultiAssetVAnchorTree__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges();
    const treeHeight = await anchor.levels();
    const createdAnchor = new MultiAssetVAnchor(
      anchor,
      signer,
      treeHeight,
      maxEdges,
      smallCircuitZkComponents,
      largeCircuitZkComponents
    );
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
    return toHex(
      this.contract.address + toHex(getChainIdType(await this.signer.getChainId()), 6).substr(2),
      32
    );
  }

  public async setVerifier(verifierAddress: string) {
    const tx = await this.contract.setVerifier(
      verifierAddress,
      BigNumber.from(await this.contract.getProposalNonce()).add(1)
    );
    await tx.wait();
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
    const functionSig = ethers.utils
      .keccak256(ethers.utils.toUtf8Bytes('updateEdge(bytes32,uint32,bytes32)'))
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

  public async getClassAndContractRoots() {
    return [this.tree.root(), await this.contract.getLastRoot()];
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns
   */
  public getMerkleProof(input: Utxo): MerkleProof {
    const element = BigNumber.from(0);
    const merkleRoot = BigNumber.from(0);
    const pathElements = [ BigNumber.from(0) ];
    const pathIndices = [ 0 ];
    return { element, merkleRoot, pathElements, pathIndices };
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

  public async generateProofCalldata(fullProof: any) {
    // const result = snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
    const calldata = await snarkjs.groth16.exportSolidityCallData(
      fullProof.proof,
      fullProof.publicSignals
    );
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

  public async generateProof(
    proofInputs: MASPAllInputs
  ): Promise<FullProof> {
    let proof = await snarkjs.groth16.fullProve(
      proofInputs,
      this.smallCircuitZkComponents.wasm,
      this.smallCircuitZkComponents.zkey
    );
    return proof;
  }

  public async generateExtData(
    recipient: string,
    extAmount: BigNumber,
    relayer: string,
    fee: BigNumber,
    refund: BigNumber,
    wrapUnwrapToken: string,
    encryptedOutput1: string,
    encryptedOutput2: string
  ): Promise<{ extData: ExtData; extDataHash: BigNumber }> {
    const extData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      refund: toFixedHex(refund.toString()),
      token: toFixedHex(wrapUnwrapToken, 20),
      encryptedOutput1,
      encryptedOutput2,
    };

    const extDataHash = await getVAnchorExtDataHash(
      encryptedOutput1,
      encryptedOutput2,
      extAmount.toString(),
      BigNumber.from(fee).toString(),
      recipient,
      relayer,
      refund.toString(),
      wrapUnwrapToken
    );
    return { extData, extDataHash };
  }

  public async populateVAnchorRootsForProof(): Promise<string[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return rootData.root;
    });
    let thisRoot = await this.contract.getLastRoot();
    return [thisRoot.toString(), ...neighborRootInfos.map((bignum) => bignum.toString())];
  }

  public async generateMASPVAnchorInputs(  
    roots: BigNumber[], 
    chainId: number, 
    assetId: number, 
    tokenId: number, 
    inputs: MaspUtxo[], 
    outputs: MaspUtxo[], 
    extAmount: BigNumber, 
    fee: BigNumber, 
    extDataHash: BigNumber, 
    externalMerkleProofs: MerkleProof[],
    ): Promise<MASPVAnchorInputs> {
    const vanchorMerkleProofs = externalMerkleProofs.map(proof => ({
      pathIndex: MerkleTree.calculateIndexFromPathIndices(proof.pathIndices),
      pathElements: proof.pathElements
    }));

    let publicAssetId = 0;
    let publicTokenId = 0;
    if (extAmount != BigNumber.from(0)) {
      publicAssetId = assetId;
      publicTokenId = tokenId;
    }

    const publicAmount = BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString();

    const allInputs: MASPAllInputs = {
      roots: roots.map(x => x.toString()),
      chainID: chainId.toString(),
      inputNullifier: inputs.map(x => '0x' + x.getNullifier()),
      outputCommitment: outputs.map(x => x.getCommitment().toString()),
      publicAmount: publicAmount,
      assetID: assetId,
      tokenID: tokenId,
      publicAssetID: publicAssetId,
      publicTokenID: publicTokenId,
      extDataHash: extDataHash.toString(),
      // data for 2 transaction inputs
      inAmount: inputs.map(x => x.amount.toString()),
      inPrivateKey: inputs.map(x => '0x' + x.keypair.privkey),
      inBlinding: inputs.map(x => BigNumber.from('0x' + x.blinding).toString()),
      inPathIndices: vanchorMerkleProofs.map(x => x.pathIndex),
      inPathElements: vanchorMerkleProofs.map(x => x.pathElements),
      // data for 2 transaction outputs
      outChainID: outputs.map(x => x.chainID.toString()),
      outAmount: outputs.map(x => x.amount.toString()),
      outPubkey: outputs.map(x => x.keypair.getPubKey().toString()),
      outBlinding: outputs.map(x => BigNumber.from('0x' + x.blinding).toString())
    };

    const publicInputs: IMASPVAnchorPublicInputs = {
      proof: "",
      roots: `0x${roots.map((x) => toFixedHex(x).slice(2)).join('')}`,
      extensionRoots: '0x00',
      inputNullifiers: inputs.map((x) => BigNumber.from(toFixedHex('0x' + x.getNullifier()))),
      outputCommitments: [
        BigNumber.from(toFixedHex(outputs[0].getCommitment())),
        BigNumber.from(toFixedHex(outputs[1].getCommitment())),
      ],
      publicAmount: toFixedHex(publicAmount),
      publicAssetId: toFixedHex(publicAssetId),
      publicTokenId: toFixedHex(publicTokenId),
      extDataHash: extDataHash,
    };

    return { allInputs, publicInputs }
  }

  public async publicInputsWithProof(
    roots: BigNumber[], 
    chainId: number, 
    assetId: number, 
    tokenId: number, 
    inputs: MaspUtxo[], 
    outputs: MaspUtxo[], 
    extAmount: BigNumber, 
    fee: BigNumber, 
    extDataHash: BigNumber, 
    externalMerkleProofs: MerkleProof[],
  ): Promise<IMASPVAnchorPublicInputs> {
    let { allInputs, publicInputs } = await this.generateMASPVAnchorInputs(roots, chainId, assetId, tokenId, inputs, outputs, extAmount, fee, extDataHash, externalMerkleProofs);
    const fullProof = await this.generateProof(allInputs);
    const proof = await this.generateProofCalldata(fullProof);
    publicInputs.proof = proof;
    const vKey = await snarkjs.zKey.exportVerificationKey(this.smallCircuitZkComponents.zkey);

    const is_valid: boolean = await snarkjs.groth16.verify(
      vKey,
      fullProof.publicSignals,
      fullProof.proof
    );
    assert.strictEqual(is_valid, true);

    return publicInputs;
  }

  public async populateRootsForProof(): Promise<BigNumber[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
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
     public getMASPMerkleProof(input: MaspUtxo): MerkleProof {
      let inputMerklePathIndices: number[];
      let inputMerklePathElements: BigNumber[];
  
      if (Number(input.amount) > 0) {
        if (input.index < BigNumber.from(0)) {
          throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`);
        }
        const path = this.tree.path(input.index.toNumber());
        inputMerklePathIndices = path.pathIndices;
        inputMerklePathElements = path.pathElements;
      } else {
        inputMerklePathIndices = new Array(this.tree.levels).fill(0);
        inputMerklePathElements = new Array(this.tree.levels).fill(0);
      }
  
      return {
        element: input.getCommitment(),
        pathElements: inputMerklePathElements,
        pathIndices: inputMerklePathIndices,
        merkleRoot: this.tree.root(),
      };
    }

  public async transact(
    inputs: MaspUtxo[],
    outputs: MaspUtxo[],
    fee: BigNumberish,
    refund: BigNumberish,
    recipient: string,
    relayer: string,
    wrappedToken: string,
    tokenId: BigNumber,
    signer: ethers.Signer,
  ): Promise<ethers.ContractReceipt> {
    // Default UTXO chain ID will match with the configured signer's chain ID
    const evmId = await this.signer.getChainId();
    const chainId = getChainIdType(evmId);

    const registry = await Registry.connect(await this.contract.registry(), signer);
    const assetID = await registry.contract.getAssetIdFromWrappedAddress(wrappedToken);

    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(
        new MaspUtxo(BigNumber.from(chainId), BigNumber.from(0), BigNumber.from(0), BigNumber.from(0))
      );
    }

    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(
          new MaspUtxo(BigNumber.from(chainId), BigNumber.from(0), BigNumber.from(0), BigNumber.from(0))
        );
      }
    }

    const merkleProofs = inputs.map((x) => this.getMASPMerkleProof(x));

    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)));


    const { extData, extDataHash } = await this.generateExtData(recipient, extAmount, relayer, BigNumber.from(fee), BigNumber.from(refund), wrappedToken, outputs[0].encrypt(), outputs[1].encrypt());
    const roots = await this.populateRootsForProof();
    const publicInputs = await this.publicInputsWithProof(roots, chainId, assetID.toNumber(), tokenId.toNumber(), inputs, outputs, extAmount, BigNumber.from(fee), extDataHash, merkleProofs);

    const auxInputs = toFixedHex(publicInputs.publicAssetId) + toFixedHex(publicInputs.publicTokenId).slice(2);

    const tx = await this.contract.transact(
      publicInputs.proof,
      auxInputs,
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
        extensionRoots: '0x',
        inputNullifiers: publicInputs.inputNullifiers,
        outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]],
        publicAmount: publicInputs.publicAmount,
        extDataHash: publicInputs.extDataHash,
      },
      {
        encryptedOutput1: extData.encryptedOutput1,
        encryptedOutput2: extData.encryptedOutput2,
      },
      {}
    );
    const receipt = await tx.wait();

    // Add the leaves to the tree
    outputs.forEach((x) => {
      // Maintain tree state after insertions
      this.tree.insert(x.getCommitment());
      x.setIndex(BigNumber.from(this.tree.indexOf(x.getCommitment())));
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });

    return receipt;
  }

  public async wrapAndDepositErc20(
    destinationChainId: BigNumberish,
    amount: BigNumberish,
    unwrappedToken: string,
    wrappedToken: string,
    signer: ethers.Signer,
  ): Promise<ethers.ContractReceipt> {
    const registry = await Registry.connect(await this.contract.registry(), signer);
    const assetID = await registry.contract.getAssetIdFromWrappedAddress(wrappedToken);
    const utxo = new MaspUtxo(BigNumber.from(destinationChainId), assetID, BigNumber.from(0), BigNumber.from(amount));

    let options = {};
    if (amount > 0 && checkNativeAddress(unwrappedToken)) {
      let tokenWrapper = TokenWrapper__factory.connect(wrappedToken, this.signer);
      let valueToSend = await tokenWrapper.getAmountToWrap(amount);

      options = {
        value: valueToSend.toHexString(),
      };
    }

    const tx = await this.contract.wrapAndDepositErc20(
      unwrappedToken,
      wrappedToken,
      amount,
      utxo.getPartialCommitment(),
      utxo.encrypt(),
      options,
    );
    const receipt = await tx.wait();
    return receipt;
  }

  public async wrapAndDepositErc721(
    destinationChainId: BigNumberish,
    unwrappedToken: string,
    wrappedToken: string,
    tokenID: BigNumber,
    signer: ethers.Signer,
  ): Promise<ethers.ContractReceipt> {
    const registry = await Registry.connect(await this.contract.registry(), signer);
    const assetID = await registry.contract.getAssetIdFromWrappedAddress(wrappedToken);
    const utxo = new MaspUtxo(BigNumber.from(destinationChainId), assetID, tokenID, BigNumber.from(1));

    let options = {};

    const tx = await this.contract.wrapAndDepositErc721(
      unwrappedToken,
      wrappedToken,
      tokenID,
      utxo.getPartialCommitment(),
      utxo.encrypt(),
      options,
    );
    const receipt = await tx.wait();
    return receipt;
  }
}

export default MultiAssetVAnchor;
