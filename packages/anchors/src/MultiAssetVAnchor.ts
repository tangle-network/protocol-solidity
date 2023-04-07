import { BigNumber, BigNumberish, ContractTransaction, ethers } from 'ethers';
import {
  MultiAssetVAnchor as MultiAssetVAnchorContract,
  MultiAssetVAnchor__factory,
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
  IMASPAllInputs,
  IMASPSwapAllInputs,
  IMASPSwapPublicInputs,
} from '@webb-tools/interfaces';
const { babyjub } = require('circomlibjs');
import { u8aToHex, getChainIdType, ZkComponents, MaspUtxo, MaspKey } from '@webb-tools/utils';
import { fromAscii } from 'web3-utils';
import { Registry } from '@webb-tools/tokens';
import { EthAbiDecodeParametersResultArray } from 'web3/eth/abi';
import { convertPublicSignals } from '@webb-tools/semaphore-proof/dist/types/generateProof';
const snarkjs = require('snarkjs');
const assert = require('assert');
const { poseidon, eddsa } = require('circomlibjs');

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
  allInputs: IMASPAllInputs;
  publicInputs: IMASPVAnchorPublicInputs;
};

export type MASPSwapInputs = {
  swapAllInputs: IMASPSwapAllInputs;
  swapPublicInputs: IMASPSwapPublicInputs;
};

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
export abstract class MultiAssetVAnchor implements IVAnchor {
  contract: MultiAssetVAnchorContract;
  signer: ethers.Signer;
  tree: MerkleTree;
  // hex string of the connected root
  maxEdges: number;
  latestSyncedBlock: number;
  smallCircuitZkComponents: ZkComponents;
  largeCircuitZkComponents: ZkComponents;
  swapCircuitZkComponents: ZkComponents;

  constructor(
    contract: MultiAssetVAnchorContract,
    treeHeight: number,
    maxEdges: number,
    smallCircuitZkComponents: ZkComponents,
    largeCircuitZkComponents: ZkComponents,
    swapCircuitZkComponents: ZkComponents,
    signer: ethers.Signer
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.maxEdges = maxEdges;
    this.depositHistory = {};
    this.smallCircuitZkComponents = smallCircuitZkComponents;
    this.largeCircuitZkComponents = largeCircuitZkComponents;
    this.swapCircuitZkComponents = swapCircuitZkComponents;
  }

  getAddress(): string {
    return this.contract.address;
  }

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  provingManager: CircomProvingManager;

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
    const pathElements = [BigNumber.from(0)];
    const pathIndices = [0];
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

  public async generateProof(proofInputs: IMASPAllInputs): Promise<FullProof> {
    const wtns = await this.smallCircuitZkComponents.witnessCalculator.calculateWTNSBin(proofInputs, 0);
    let proof = await snarkjs.groth16.prove(
      this.smallCircuitZkComponents.zkey,
      wtns,
    );
    const vKey = await snarkjs.zKey.exportVerificationKey(
      this.smallCircuitZkComponents.zkey,
    );
    const res = await snarkjs.groth16.verify(vKey, proof.publicSignals, proof.proof);
    console.log('resres', res);
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
    console.log('reached here 1')
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

    console.log(extData);

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

  public static async generateMASPVAnchorInputs(
    roots: BigNumber[],
    chainId: number,
    assetId: number,
    tokenId: number,
    inputs: MaspUtxo[],
    outputs: MaspUtxo[],
    alphas: string[],
    feeAssetId: number,
    feeTokenId: number,
    whitelistedAssetIds: number[],
    feeInputs: MaspUtxo[],
    feeOutputs: MaspUtxo[],
    fee_alphas: string[],
    extAmount: BigNumber,
    fee: BigNumber,
    extDataHash: BigNumber,
    externalMerkleProofs: MerkleProof[],
    externalFeeMerkleProofs: MerkleProof[]
  ): Promise<MASPVAnchorInputs> {
    const vanchorMerkleProofs = externalMerkleProofs.map((proof) => ({
      pathIndex: MerkleTree.calculateIndexFromPathIndices(proof.pathIndices),
      pathElements: proof.pathElements,
    }));

    const feeMerkleProofs = externalFeeMerkleProofs.map((proof) => ({
      pathIndex: MerkleTree.calculateIndexFromPathIndices(proof.pathIndices),
      pathElements: proof.pathElements,
    }));

    let publicAssetId = 0;
    let publicTokenId = 0;
    if (extAmount != BigNumber.from(0)) {
      publicAssetId = assetId;
      publicTokenId = tokenId;
    }

    const publicAmount = BigNumber.from(extAmount)
      .sub(fee)
      .add(FIELD_SIZE)
      .mod(FIELD_SIZE)
      .toString();

    const allInputs: IMASPAllInputs = {
      publicAmount: publicAmount,
      extDataHash: extDataHash.toString(),
      assetID: assetId,
      tokenID: tokenId,
      publicAssetID: publicAssetId,
      publicTokenID: publicTokenId,

      // data for transaction inputs
      inputNullifier: inputs.map((x) => x.getNullifier().toString()),
      inAmount: inputs.map((x) => x.amount.toString()),
      inBlinding: inputs.map((x) => x.blinding.toString()),
      inPathIndices: vanchorMerkleProofs.map((x) => x.pathIndex),
      inPathElements: vanchorMerkleProofs.map((x) => x.pathElements),

      // data for transaction outputs
      outputCommitment: outputs.map((x) => x.getCommitment().toString()),
      outAmount: outputs.map((x) => x.amount.toString()),
      outChainID: outputs.map((x) => x.chainID.toString()),
      outPk_X: outputs.map((x) => x.maspKey.getPublicKey()[0].toString()),
      outPk_Y: outputs.map((x) => x.maspKey.getPublicKey()[1].toString()),
      outBlinding: outputs.map((x) => x.blinding.toString()),

      chainID: chainId.toString(),
      roots: roots.map((x) => x.toString()),

      ak_X: inputs.map((x) => x.maspKey.getProofAuthorizingKey()[0].toString()),
      ak_Y: inputs.map((x) => x.maspKey.getProofAuthorizingKey()[1].toString()),
      alpha: alphas,
      ak_alpha_X: alphas.map(
        (x, i) =>
          babyjub.mulPointEscalar(inputs[i].maspKey.getProofAuthorizingKey(), babyjub.F.e(x))[0]
      ),
      ak_alpha_Y: alphas.map(
        (x, i) =>
          babyjub.mulPointEscalar(inputs[i].maspKey.getProofAuthorizingKey(), babyjub.F.e(x))[1]
      ),

      feeAssetID: feeAssetId,
      whitelistedAssetIDs: whitelistedAssetIds,
      feeTokenID: feeTokenId,

      // data for transaction inputs
      feeInputNullifier: feeInputs.map((x) => x.getNullifier().toString()),
      feeInAmount: feeInputs.map((x) => x.amount.toString()),
      feeInBlinding: feeInputs.map((x) => x.blinding.toString()),
      feeInPathIndices: feeMerkleProofs.map((x) => x.pathIndex),
      feeInPathElements: feeMerkleProofs.map((x) => x.pathElements),

      // data for transaction outputs
      feeOutputCommitment: feeOutputs.map((x) => x.getCommitment().toString()),
      feeOutAmount: feeOutputs.map((x) => x.amount.toString()),
      feeOutChainID: feeOutputs.map((x) => x.chainID.toString()),
      feeOutPk_X: feeOutputs.map((x) => x.maspKey.getPublicKey()[0].toString()),
      feeOutPk_Y: feeOutputs.map((x) => x.maspKey.getPublicKey()[1].toString()),
      feeOutBlinding: feeOutputs.map((x) => x.blinding.toString()),

      fee_ak_X: feeInputs.map((x) => x.maspKey.getProofAuthorizingKey()[0].toString()),
      fee_ak_Y: feeInputs.map((x) => x.maspKey.getProofAuthorizingKey()[1].toString()),
      fee_alpha: fee_alphas,
      fee_ak_alpha_X: fee_alphas.map(
        (x, i) =>
          babyjub.mulPointEscalar(feeInputs[i].maspKey.getProofAuthorizingKey(), babyjub.F.e(x))[0]
      ),
      fee_ak_alpha_Y: fee_alphas.map(
        (x, i) =>
          babyjub.mulPointEscalar(feeInputs[i].maspKey.getProofAuthorizingKey(), babyjub.F.e(x))[1]
      ),
    };

    const publicInputs: IMASPVAnchorPublicInputs = {
      proof: '',
      extensionRoots: '0x',
      publicAmount: allInputs.publicAmount,
      publicAssetID: allInputs.publicAssetID,
      publicTokenID: allInputs.publicTokenID,
      extDataHash: allInputs.extDataHash,

      // data for transaction inputs
      inputNullifier: allInputs.inputNullifier,

      // data for transaction outputs
      outputCommitment: allInputs.outputCommitment,

      chainID: allInputs.chainID,
      roots: allInputs.roots,

      ak_alpha_X: allInputs.ak_alpha_X,
      ak_alpha_Y: allInputs.ak_alpha_Y,

      whitelistedAssetIDs: allInputs.whitelistedAssetIDs,

      // data for transaction inputs
      feeInputNullifier: allInputs.feeInputNullifier,

      // data for transaction outputs
      feeOutputCommitment: allInputs.feeOutputCommitment,

      fee_ak_alpha_X: allInputs.fee_ak_alpha_X,
      fee_ak_alpha_Y: allInputs.fee_ak_alpha_Y,
    };

    return { allInputs, publicInputs };
  }

  public async publicInputsWithProof(
    roots: BigNumber[],
    chainId: number,
    assetId: number,
    tokenId: number,
    inputs: MaspUtxo[],
    outputs: MaspUtxo[],
    alphas: string[],
    feeAssetId: number,
    feeTokenId: number,
    whitelistedAssetIds: number[],
    feeInputs: MaspUtxo[],
    feeOutputs: MaspUtxo[],
    fee_alphas: string[],
    extAmount: BigNumber,
    fee: BigNumber,
    extDataHash: BigNumber,
    externalMerkleProofs: MerkleProof[],
    externalFeeMerkleProofs: MerkleProof[]
  ): Promise<IMASPVAnchorPublicInputs> {
    let { allInputs, publicInputs } = await MultiAssetVAnchor.generateMASPVAnchorInputs(
      roots,
      chainId,
      assetId,
      tokenId,
      inputs,
      outputs,
      alphas,
      feeAssetId,
      feeTokenId,
      whitelistedAssetIds,
      feeInputs,
      feeOutputs,
      fee_alphas,
      extAmount,
      fee,
      extDataHash,
      externalMerkleProofs,
      externalFeeMerkleProofs
    );
    console.log('allInputs', allInputs)
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

  public static auxInputsToBytes(publicInputs: IMASPVAnchorPublicInputs): string {
    // publicAssetID, publicTokenID, ak_alpha_X, ak_alpha_Y, whitelistedAssetIDs, feeInputNullifiers, feeOutputCommitments, fee_ak_alpha_X, fee_ak_alpha_Y
    let ak_alpha_X_bytes = '';
    for (let i = 0; i < publicInputs.ak_alpha_X.length; i++) {
      ak_alpha_X_bytes += toFixedHex(publicInputs.ak_alpha_X[i]).slice(2);
    }

    let ak_alpha_Y_bytes = '';
    for (let i = 0; i < publicInputs.ak_alpha_Y.length; i++) {
      ak_alpha_Y_bytes += toFixedHex(publicInputs.ak_alpha_Y[i]).slice(2);
    }

    let whitelistedAssetIDs_bytes = '';
    for (let i = 0; i < publicInputs.whitelistedAssetIDs.length; i++) {
      whitelistedAssetIDs_bytes += toFixedHex(publicInputs.whitelistedAssetIDs[i]).slice(2);
    }

    let feeInputNullifier_bytes = '';
    for (let i = 0; i < publicInputs.feeInputNullifier.length; i++) {
      feeInputNullifier_bytes += toFixedHex(publicInputs.feeInputNullifier[i]).slice(2);
    }

    let feeOutputCommitment_bytes = '';
    for (let i = 0; i < publicInputs.feeOutputCommitment.length; i++) {
      feeOutputCommitment_bytes += toFixedHex(publicInputs.feeOutputCommitment[i]).slice(2);
    }

    let fee_ak_alpha_X_bytes = '';
    for (let i = 0; i < publicInputs.fee_ak_alpha_X.length; i++) {
      fee_ak_alpha_X_bytes += toFixedHex(publicInputs.fee_ak_alpha_X[i]).slice(2);
    }

    let fee_ak_alpha_Y_bytes = '';
    for (let i = 0; i < publicInputs.fee_ak_alpha_Y.length; i++) {
      fee_ak_alpha_Y_bytes += toFixedHex(publicInputs.fee_ak_alpha_Y[i]).slice(2);
    }

    return (
      toFixedHex(publicInputs.publicAssetID) +
      toFixedHex(publicInputs.publicTokenID).slice(2) +
      ak_alpha_X_bytes +
      ak_alpha_Y_bytes +
      whitelistedAssetIDs_bytes +
      feeInputNullifier_bytes +
      feeOutputCommitment_bytes +
      fee_ak_alpha_X_bytes +
      fee_ak_alpha_Y_bytes
    );
  }

  /**
   *
   * @param input A UTXO object that is inside the tree
   * @returns
   */
  public static getMASPMerkleProof(input: MaspUtxo, tree: MerkleTree): MerkleProof {
    let inputMerklePathIndices: number[];
    let inputMerklePathElements: BigNumber[];

    if (Number(input.amount) > 0) {
      if (input.index < BigNumber.from(0)) {
        throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`);
      }
      const path = tree.path(input.index.toNumber());
      inputMerklePathIndices = path.pathIndices;
      inputMerklePathElements = path.pathElements;
    } else {
      inputMerklePathIndices = new Array(tree.levels).fill(0);
      inputMerklePathElements = new Array(tree.levels).fill(0);
    }

    return {
      element: input.getCommitment(),
      pathElements: inputMerklePathElements,
      pathIndices: inputMerklePathIndices,
      merkleRoot: tree.root(),
    };
  }

  public async depositERC20(
    maspKey: MaspKey,
    destinationChainId: BigNumberish,
    amount: BigNumberish,
    unwrappedToken: string,
    wrappedToken: string,
    signer: ethers.Signer
  ): Promise<ethers.ContractReceipt> {
    const registry = await Registry.connect(await this.contract.registry(), signer);
    const assetID = await registry.contract.getAssetIdFromWrappedAddress(wrappedToken);
    const utxo = new MaspUtxo(
      BigNumber.from(destinationChainId),
      maspKey,
      assetID,
      BigNumber.from(0),
      BigNumber.from(amount)
    );

    let options = {};
    if (amount > 0 && checkNativeAddress(unwrappedToken)) {
      let tokenWrapper = TokenWrapper__factory.connect(wrappedToken, this.signer);
      let valueToSend = await tokenWrapper.getAmountToWrap(amount);

      options = {
        value: valueToSend.toHexString(),
      };
    }

    const tx = await this.contract.depositERC20(
      unwrappedToken,
      wrappedToken,
      amount,
      toFixedHex(utxo.getPartialCommitment()),
      utxo.encrypt(maspKey),
      options
    );
    const receipt = await tx.wait();
    return receipt;
  }

  public async depositERC721(
    maspKey: MaspKey,
    destinationChainId: BigNumberish,
    unwrappedToken: string,
    wrappedToken: string,
    tokenID: BigNumber,
    signer: ethers.Signer
  ): Promise<ethers.ContractReceipt> {
    const registry = await Registry.connect(await this.contract.registry(), signer);
    const assetID = await registry.contract.getAssetIdFromWrappedAddress(wrappedToken);
    const utxo = new MaspUtxo(
      BigNumber.from(destinationChainId),
      maspKey,
      assetID,
      tokenID,
      BigNumber.from(1)
    );

    let options = {};

    const tx = await this.contract.depositERC721(
      unwrappedToken,
      wrappedToken,
      tokenID,
      toFixedHex(utxo.getPartialCommitment()),
      utxo.encrypt(maspKey),
      options
    );
    const receipt = await tx.wait();
    return receipt;
  }

  /** Swap Functions */
  public async generateSwapProof(swapAllInputs: IMASPSwapAllInputs): Promise<FullProof> {
    let proof = await snarkjs.groth16.fullProve(
      swapAllInputs,
      this.swapCircuitZkComponents.wasm,
      this.swapCircuitZkComponents.zkey
    );
    return proof;
  }

  public async generateSwapInputsWithProof(
    aliceSpendRecord: MaspUtxo,
    aliceChangeRecord: MaspUtxo,
    aliceReceiveRecord: MaspUtxo,
    bobSpendRecord: MaspUtxo,
    bobChangeRecord: MaspUtxo,
    bobReceiveRecord: MaspUtxo,
    aliceSpendMerkleProof: MerkleProof,
    bobSpendMerkleProof: MerkleProof,
    t: BigNumber,
    tPrime: BigNumber,
    currentTimestamp: BigNumber,
    swapChainID: BigNumber
  ): Promise<MASPSwapInputs> {
    const roots = await this.populateRootsForProof();
    const aliceMerkleProofData = {
      pathIndex: MerkleTree.calculateIndexFromPathIndices(aliceSpendMerkleProof.pathIndices),
      pathElements: aliceSpendMerkleProof.pathElements,
    };
    const bobMerkleProofData = {
      pathIndex: MerkleTree.calculateIndexFromPathIndices(bobSpendMerkleProof.pathIndices),
      pathElements: bobSpendMerkleProof.pathElements,
    };

    const swapMessageHash = poseidon([
      aliceChangeRecord.getCommitment(),
      aliceReceiveRecord.getCommitment(),
      bobChangeRecord.getCommitment(),
      bobReceiveRecord.getCommitment(),
      t,
      tPrime,
    ]);

    const aliceSig = eddsa.signPoseidon(aliceSpendRecord.maspKey.sk, swapMessageHash);
    const bobSig = eddsa.signPoseidon(bobSpendRecord.maspKey.sk, swapMessageHash);

    const swapAllInputs = {
      aliceSpendAssetID: aliceSpendRecord.assetID.toString(),
      aliceSpendTokenID: aliceSpendRecord.tokenID.toString(),
      aliceSpendAmount: aliceSpendRecord.amount.toString(),
      aliceSpendInnerPartialRecord: aliceSpendRecord.getInnerPartialCommitment().toString(),
      bobSpendAssetID: bobSpendRecord.assetID.toString(),
      bobSpendTokenID: bobSpendRecord.tokenID.toString(),
      bobSpendAmount: bobSpendRecord.amount.toString(),
      bobSpendInnerPartialRecord: bobSpendRecord.getInnerPartialCommitment().toString(),
      t: t.toString(),
      tPrime: tPrime.toString(),
      alice_ak_X: aliceSpendRecord.maspKey.getProofAuthorizingKey()[0].toString(),
      alice_ak_Y: aliceSpendRecord.maspKey.getProofAuthorizingKey()[1].toString(),
      bob_ak_X: bobSpendRecord.maspKey.getProofAuthorizingKey()[0].toString(),
      bob_ak_Y: bobSpendRecord.maspKey.getProofAuthorizingKey()[1].toString(),
      alice_R8x: aliceSig.R8[0].toString(),
      alice_R8y: aliceSig.R8[1].toString(),
      aliceSig: aliceSig.S.toString(),
      bob_R8x: bobSig.R8[0].toString(),
      bob_R8y: bobSig.R8[1].toString(),
      bobSig: bobSig.S.toString(),
      aliceSpendPathElements: aliceMerkleProofData.pathElements,
      aliceSpendPathIndices: aliceMerkleProofData.pathIndex.toString(),
      aliceSpendNullifier: aliceSpendRecord.getNullifier().toString(),
      bobSpendPathElements: bobMerkleProofData.pathElements,
      bobSpendPathIndices: bobMerkleProofData.pathIndex.toString(),
      bobSpendNullifier: bobSpendRecord.getNullifier().toString(),
      swapChainID: swapChainID.toString(),
      roots: roots.map((root) => root.toString()),
      currentTimestamp: currentTimestamp.toString(),
      aliceChangeChainID: aliceChangeRecord.chainID.toString(),
      aliceChangeAssetID: aliceChangeRecord.assetID.toString(),
      aliceChangeTokenID: aliceChangeRecord.tokenID.toString(),
      aliceChangeAmount: aliceChangeRecord.amount.toString(),
      aliceChangeInnerPartialRecord: aliceChangeRecord.getInnerPartialCommitment().toString(),
      aliceChangeRecord: aliceChangeRecord.getCommitment().toString(),
      bobChangeChainID: bobChangeRecord.chainID.toString(),
      bobChangeAssetID: bobChangeRecord.assetID.toString(),
      bobChangeTokenID: bobChangeRecord.tokenID.toString(),
      bobChangeAmount: bobChangeRecord.amount.toString(),
      bobChangeInnerPartialRecord: bobChangeRecord.getInnerPartialCommitment().toString(),
      bobChangeRecord: bobChangeRecord.getCommitment().toString(),
      aliceReceiveChainID: aliceReceiveRecord.chainID.toString(),
      aliceReceiveAssetID: aliceReceiveRecord.assetID.toString(),
      aliceReceiveTokenID: aliceReceiveRecord.tokenID.toString(),
      aliceReceiveAmount: aliceReceiveRecord.amount.toString(),
      aliceReceiveInnerPartialRecord: aliceReceiveRecord.getInnerPartialCommitment().toString(),
      aliceReceiveRecord: aliceReceiveRecord.getCommitment().toString(),
      bobReceiveChainID: bobReceiveRecord.chainID.toString(),
      bobReceiveAssetID: bobReceiveRecord.assetID.toString(),
      bobReceiveTokenID: bobReceiveRecord.tokenID.toString(),
      bobReceiveAmount: bobReceiveRecord.amount.toString(),
      bobReceiveInnerPartialRecord: bobReceiveRecord.getInnerPartialCommitment().toString(),
      bobReceiveRecord: bobReceiveRecord.getCommitment().toString(),
    };

    const swapPublicInputs = {
      proof: '',
      aliceSpendNullifier: swapAllInputs.aliceSpendNullifier,
      bobSpendNullifier: swapAllInputs.bobSpendNullifier,
      swapChainID: swapAllInputs.swapChainID,
      roots: swapAllInputs.roots,
      currentTimestamp: swapAllInputs.currentTimestamp,
      aliceChangeRecord: swapAllInputs.aliceChangeRecord,
      bobChangeRecord: swapAllInputs.bobChangeRecord,
      aliceReceiveRecord: swapAllInputs.aliceReceiveRecord,
      bobReceiveRecord: swapAllInputs.bobReceiveRecord,
    };

    const fullProof = await this.generateSwapProof(swapAllInputs);
    const proof = await this.generateProofCalldata(fullProof);
    swapPublicInputs.proof = proof;
    const vKey = await snarkjs.zKey.exportVerificationKey(this.swapCircuitZkComponents.zkey);

    const is_valid: boolean = await snarkjs.groth16.verify(
      vKey,
      fullProof.publicSignals,
      fullProof.proof
    );
    assert.strictEqual(is_valid, true);
    return { swapAllInputs, swapPublicInputs };
  }

  // Smart contract interaction for swap
  public async swap(
    aliceSpendRecord: MaspUtxo,
    aliceChangeRecord: MaspUtxo,
    aliceReceiveRecord: MaspUtxo,
    bobSpendRecord: MaspUtxo,
    bobChangeRecord: MaspUtxo,
    bobReceiveRecord: MaspUtxo,
    aliceSpendMerkleProof: MerkleProof,
    bobSpendMerkleProof: MerkleProof,
    t: BigNumber,
    tPrime: BigNumber,
    currentTimestamp: BigNumber,
    signer: ethers.Signer
  ) {
    const evmId = await signer.getChainId();
    const swapChainID = getChainIdType(evmId);
    const { swapAllInputs, swapPublicInputs } = await this.generateSwapInputsWithProof(
      aliceSpendRecord,
      aliceChangeRecord,
      aliceReceiveRecord,
      bobSpendRecord,
      bobChangeRecord,
      bobReceiveRecord,
      aliceSpendMerkleProof,
      bobSpendMerkleProof,
      t,
      tPrime,
      currentTimestamp,
      BigNumber.from(swapChainID)
    );
    await this.contract.swap(
      swapPublicInputs.proof,
      {
        aliceSpendNullifier: swapPublicInputs.aliceSpendNullifier,
        bobSpendNullifier: swapPublicInputs.bobSpendNullifier,
        swapChainID: swapPublicInputs.swapChainID,
        roots: MultiAssetVAnchor.createRootsBytes(swapPublicInputs.roots),
        currentTimestamp: swapPublicInputs.currentTimestamp,
        aliceChangeRecord: swapPublicInputs.aliceChangeRecord,
        bobChangeRecord: swapPublicInputs.bobChangeRecord,
        aliceReceiveRecord: swapPublicInputs.aliceReceiveRecord,
        bobReceiveRecord: swapPublicInputs.bobReceiveRecord,
      },
      {
        encryptedOutput1: aliceChangeRecord.encrypt(aliceChangeRecord.maspKey),
        encryptedOutput2: aliceReceiveRecord.encrypt(aliceReceiveRecord.maspKey),
      },
      {
        encryptedOutput1: bobChangeRecord.encrypt(bobChangeRecord.maspKey),
        encryptedOutput2: bobReceiveRecord.encrypt(bobReceiveRecord.maspKey),
      }
    );
  }
}

export default MultiAssetVAnchor;
