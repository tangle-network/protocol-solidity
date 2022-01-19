import { BigNumber, BigNumberish, ethers } from 'ethers';
import { VAnchor as VAnchorContract, VAnchor__factory, VAnchorEncodeInputs__factory } from '@webb-tools/contracts';
import { p256, toHex, RootInfo, Keypair, FIELD_SIZE, getExtDataHash, toFixedHex, Utxo } from '@webb-tools/utils';
import { IAnchorDeposit, IAnchor, IExtData, IMerkleProofData, IUTXOInput, IVariableAnchorPublicInputs, IWitnessInput } from '@webb-tools/interfaces';
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
export class VAnchor implements IAnchor {
  signer: ethers.Signer;
  contract: VAnchorContract;
  tree: MerkleTree;
  // hex string of the connected root
  latestSyncedBlock: number;
  smallCircuitZkeyPath: string;
  smallCircuitWASMPath: string;
  smallWitnessCalculator: any;

  largeCircuitZkeyPath: string;
  largeCircuitWASMPath: string;
  largeWitnessCalculator: any;

  // The depositHistory stores leafIndex => information to create proposals (new root)
  depositHistory: Record<number, string>;
  token?: string;
  denomination?: string;
  

  private constructor(
    contract: VAnchorContract,
    signer: ethers.Signer,
    treeHeight: number,
    maxEdges: number,
  ) {
    this.signer = signer;
    this.contract = contract;
    this.tree = new MerkleTree(treeHeight);
    this.latestSyncedBlock = 0;
    this.depositHistory = {};
    this.smallWitnessCalculator = {};
    this.largeWitnessCalculator = {};

    // set the circuit zkey and wasm depending upon max edges
    switch (maxEdges) {
      case 1:
        this.smallCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm';
        this.smallCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey';
        this.smallWitnessCalculator = require("../../../../../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js");
        this.largeCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm';
        this.largeCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/circuit_final.zkey';
        this.largeWitnessCalculator = require("../../../../../../protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js");
        break;
      case 7:
        this.smallCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/8/poseidon_vanchor_8_2.wasm';
        this.smallCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/8/circuit_final.zkey';
        this.smallWitnessCalculator = require("../../../../../../protocol-solidity-fixtures/fixtures/vanchor_2/8/witness_calculator.js");
        this.largeCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm';
        this.largeCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/8/circuit_final.zkey';
        this.largeWitnessCalculator = require("../../../../../../protocol-solidity-fixtures/fixtures/vanchor_16/8/witness_calculator.js");
        break;
      default:
        this.smallCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm';
        this.smallCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey';
        this.smallWitnessCalculator = require("../../../../../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js");
        this.largeCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm';
        this.largeCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/circuit_final.zkey';
        this.largeWitnessCalculator = require("../../../../../../protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js");
        break;
    }

  }
  deposit(destinationChainId: number) {
    throw new Error("Method not implemented.");
  }
  wrapAndDeposit(tokenAddress: string, destinationChainId?: number): Promise<IAnchorDeposit> {
    throw new Error("Method not implemented.");
  }
  bridgedWithdrawAndUnwrap(deposit: IAnchorDeposit, merkleProof: any, recipient: string, relayer: string, fee: string, refund: string, refreshCommitment: string, tokenAddress: string): Promise<ethers.Event> {
    throw new Error("Method not implemented.");
  }
  bridgedWithdraw(deposit: IAnchorDeposit, merkleProof: any, recipient: string, relayer: string, fee: string, refund: string, refreshCommitment: string): Promise<ethers.Event> {
    throw new Error("Method not implemented.");
  }
  getAddress(): string {
    return this.contract.address;
  }

  public static async createVAnchor(
    verifier: string,
    levels: BigNumberish,
    hasher: string,
    handler: string,
    token: string,
    maxEdges: number,
    signer: ethers.Signer,
  ) {
    const encodeLibraryFactory = new VAnchorEncodeInputs__factory(signer);
    const encodeLibrary = await encodeLibraryFactory.deploy();
    const factory = new VAnchor__factory({["contracts/libs/VAnchorEncodeInputs.sol:VAnchorEncodeInputs"]: encodeLibrary.address}, signer);
    const vAnchor = await factory.deploy(verifier, levels, hasher, handler, token, maxEdges, {});
    await vAnchor.deployed();
    const createdVAnchor = new VAnchor(vAnchor, signer, BigNumber.from(levels).toNumber(), maxEdges);
    createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber!;
    createdVAnchor.token = token;
    return createdVAnchor;
  }

  public static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address: string,
    signer: ethers.Signer,
  ) {
    const anchor = VAnchor__factory.connect(address, signer);
    const maxEdges = await anchor.maxEdges()
    const treeHeight = await anchor.levels();
    const createdAnchor = new VAnchor(anchor, signer, treeHeight, maxEdges);
    createdAnchor.token = await anchor.token();
    return createdAnchor;
  }

  public static generateUTXO(utxoInputs: IUTXOInput): Utxo {
    return new Utxo({
      chainId: utxoInputs.chainId,
      amount: utxoInputs.amount,
      blinding: utxoInputs.blinding,
      keypair: utxoInputs.keypair,
      index: undefined,
    });
  }

  public static createRootsBytes(rootArray: string[]) {
    let rootsBytes = "0x";
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes) 
  };

    // Convert a hex string to a byte array
  public static hexStringToByte(str: string) {
    if (!str) {
      return new Uint8Array();
    }
    
    var a = [];
    for (var i = 0, len = str.length; i < len; i+=2) {
      // @ts-ignore
      a.push(parseInt(str.substr(i,2),16));
    }
    
    return new Uint8Array(a);
  }

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

  public static convertToPublicInputsStruct(args: any[]): IVariableAnchorPublicInputs {
    return {
      proof: args[0],
      roots: args[1],
      inputNullifiers: args[2],
      outputCommitments: args[3],
      publicAmount: args[4],
      extDataHash: args[5]
    };
  }

  public static convertToExtDataStruct(args: any[]): IExtData {
    return {
      recipient: args[0],
      extAmount: args[1],
      relayer: args[2],
      fee: args[3],
      encryptedOutput1: args[4],
      encryptedOutput2: args[5]
    };
  }
  
  public static async generateWithdrawProofCallData(proof: any, publicSignals: any) {
    const result = await VAnchor.groth16ExportSolidityCallData(proof, publicSignals);
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
    return toHex(this.contract.address + toHex((await this.signer.getChainId()), 4).substr(2), 32);
  }

  public async setVerifier(verifierAddress: string) {
    const tx = await this.contract.setVerifier(verifierAddress, BigNumber.from((await this.contract.getProposalNonce())).add(1));
    await tx.wait();
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

  // Proposal data is used to update linkedAnchors via bridge proposals 
  // on other chains with this anchor's state
  public async getProposalData(resourceID: string, leafIndex?: number): Promise<string> {
    // console.log("get proposal data");
    // console.log(`leafIndex is ${leafIndex}`);
    // If no leaf index passed in, set it to the most recent one.
    if (!leafIndex) {
      leafIndex = this.tree.number_of_elements() - 1;
    }

    const chainID = await this.signer.getChainId();
    const merkleRoot = this.depositHistory[leafIndex]; //bridgedTransact should update deposithistory
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("updateEdge(uint256,bytes32,uint256)")).slice(0, 10).padEnd(10, '0');
    const dummyNonce = 1;

    return '0x' +
      toHex(resourceID, 32).substr(2)+ 
      functionSig.slice(2) + 
      toHex(dummyNonce,4).substr(2) +
      toHex(chainID, 4).substr(2) + 
      toHex(leafIndex, 4).substr(2) + 
      toHex(merkleRoot, 32).substr(2);
  }

  public async getHandlerProposalData(newHandler: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("setHandler(address,uint32)")).slice(0, 10).padEnd(10, '0');
    const nonce = (await this.contract.getProposalNonce()) + 1;

    return '0x' +
      toHex(resourceID, 32).substr(2)+ 
      functionSig.slice(2) + 
      toHex(nonce,4).substr(2) +
      toHex(newHandler, 20).substr(2) 
  }

  public async getConfigLimitsProposalData(_minimalWithdrawalAmount: string, _maximumDepositAmount: string): Promise<string> {
    const resourceID = await this.createResourceId();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("configureLimits(uint256,uint256)")).slice(0, 10).padEnd(10, '0');
    const nonce = (await this.contract.getProposalNonce()) + 1;;
    return '0x' +
      toHex(resourceID, 32).substr(2)+ 
      functionSig.slice(2) + 
      toHex(nonce, 4).substr(2) +
      toFixedHex(_minimalWithdrawalAmount).substr(2) +
      toFixedHex(_maximumDepositAmount).substr(2) 
  }

  public async populateRootInfosForProof(): Promise<RootInfo[]> {
    const neighborEdges = await this.contract.getLatestNeighborEdges();
    const neighborRootInfos = neighborEdges.map((rootData) => {
      return {
        merkleRoot: rootData.root,
        chainId: rootData.chainID,
      }
    });
    let thisRoot = await this.contract.getLastRoot();
    const thisChainId = await this.signer.getChainId();
    return [{
      merkleRoot: thisRoot,
      chainId: thisChainId,
    }, ...neighborRootInfos];
  }

  public async getClassAndContractRoots() {
    return [this.tree.root(), await this.contract.getLastRoot()];
  }

  /**
   * 
   * @param input A UTXO object that is inside the tree
   * @returns 
   */
  public getMerkleProof(input: Utxo): IMerkleProofData {
    let inputMerklePathIndex;
    let inputMerklePathElements;

    if (input.amount > 0) {
      input.index = this.tree.indexOf(toFixedHex(input.getCommitment()))
      if (input.index < 0) {
        throw new Error(`Input commitment ${toFixedHex(input.getCommitment())} was not found`)
      }
      inputMerklePathIndex = input.index;
      inputMerklePathElements = this.tree.path(input.index).pathElements
    } else {
      inputMerklePathIndex = 0;
      inputMerklePathElements = new Array(this.tree.levels).fill(0);
    }

    return {
      pathElements: inputMerklePathElements,
      pathIndex: inputMerklePathIndex,
      merkleRoot: this.tree.root(),
    }
  }

  public async generateWitnessInput(
    roots: RootInfo[], 
    chainId: BigNumberish, 
    inputs: Utxo[], 
    outputs: Utxo[], 
    extAmount: BigNumberish, 
    fee: BigNumberish,
    recipient: string, 
    relayer: string,
    externalMerkleProofs: any[],
  ): Promise<IWitnessInput> {
    const extData = {
      recipient: toFixedHex(recipient, 20),
      extAmount: toFixedHex(extAmount),
      relayer: toFixedHex(relayer, 20),
      fee: toFixedHex(fee),
      encryptedOutput1: outputs[0].encrypt(),
      encryptedOutput2: outputs[1].encrypt()
    }
  
    const extDataHash = getExtDataHash(extData)
    //console.log(roots);
    let input = {
      roots: roots.map((x) => BigNumber.from(x.merkleRoot).toString()),
      diffs: inputs.map((x) => x.getDiffs(roots)),
      chainID: chainId.toString(),
      inputNullifier: inputs.map((x) => x.getNullifier().toString()),
      outputCommitment: outputs.map((x) => x.getCommitment().toString()),
      publicAmount: BigNumber.from(extAmount).sub(fee).add(FIELD_SIZE).mod(FIELD_SIZE).toString(),
      extDataHash: extDataHash.toString(),
  
      // data for 2 transaction inputs
      inAmount: inputs.map((x) => x.amount.toString()),
      inPrivateKey: inputs.map((x) => x.keypair.privkey.toString()),
      inBlinding: inputs.map((x) => x.blinding.toString()),
      inPathIndices: externalMerkleProofs.map((x) => x.pathIndex),
      inPathElements: externalMerkleProofs.map((x) => x.pathElements),
  
      // data for 2 transaction outputs
      outChainID: outputs.map((x) => x.chainId.toString()),
      outAmount: outputs.map((x) => x.amount.toString()),
      outPubkey: outputs.map((x) => toFixedHex(x.keypair.pubkey).toString()),
      outBlinding: outputs.map((x) => x.blinding.toString())
    }
    //console.log(input.outPubkey.map((x) => toFixedHex(x)));
    //console.log(input.inputNullifier);
    // console.log(`public amount is ${input.publicAmount}`);
    // console.log("printing input");
    // console.log(input);
    // console.log("printing input commitment");
    // const inputCommitment =inputs.map((x) => [x.getCommitment(), x.amount]);
    // console.log(inputCommitment);
    // console.log("printing tree root")
    // console.log(this.tree.root().toString());

    if (input.diffs.length === 0) {
      input.diffs = [...roots.map((_r) => {
        return new Array(roots.length).fill('0x0000000000000000000000000000000000000000000000000000000000000000');
      })];
    }

    if (input.inputNullifier.length === 0) {
      input.inputNullifier = [...[0,1].map((_r) => {
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
      })];
    }

    return {
      input,
      extData,
    };
  }

  public generatePublicInputs(
    proof: any,
    roots: RootInfo[],
    inputs: Utxo[],
    outputs: Utxo[],
    publicAmount: BigNumberish,
    extDataHash: string,
  ): IVariableAnchorPublicInputs {
    // public inputs to the contract
    const args: IVariableAnchorPublicInputs = {
      proof: `0x${proof}`,
      roots: `0x${roots.map((x) => toFixedHex(x.merkleRoot).slice(2)).join('')}`,
      inputNullifiers: inputs.map((x) => toFixedHex(x.getNullifier())),
      outputCommitments: [toFixedHex(outputs[0].getCommitment()), toFixedHex(outputs[1].getCommitment())],
      publicAmount: toFixedHex(publicAmount),
      extDataHash: toFixedHex(extDataHash),
    };

    if (args.inputNullifiers.length === 0) {
      args.inputNullifiers = [...[0,1].map((_r) => {
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
      })];
    }

    return args;
  }

  public async checkKnownRoot() {
    const isKnownRoot = await this.contract.isKnownRoot(toFixedHex(this.tree.root()));
    if (!isKnownRoot) {
      await this.update(this.latestSyncedBlock);
    }
  }

  public async createWitness(data: any, small: boolean) {
    const fileBuf = require('fs').readFileSync(small ? this.smallCircuitWASMPath : this.largeCircuitWASMPath);
    const witnessCalculator = small
      ? await this.smallWitnessCalculator(fileBuf)
      : await this.largeWitnessCalculator(fileBuf)
    const buff = await witnessCalculator.calculateWTNSBin(data,0);
    return buff;
  }

  public async proveAndVerify(wtns: any, small: boolean) {
    let res = await snarkjs.groth16.prove(small
      ? this.smallCircuitZkeyPath
      : this.largeCircuitZkeyPath, wtns
    );
    let proof = res.proof;
    let publicSignals = res.publicSignals;

    const vKey = await snarkjs.zKey.exportVerificationKey(small
      ? this.smallCircuitZkeyPath
      : this.largeCircuitZkeyPath
    );
    res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    let proofEncoded = await VAnchor.generateWithdrawProofCallData(proof, publicSignals);
    return proofEncoded;
  }

  public async setupTransaction(
    inputs: Utxo[], 
    outputs: Utxo[], 
    extAmount: BigNumberish, 
    fee: BigNumberish,
    recipient: string, 
    relayer: string,
    merkleProofsForInputs: any[],
  ) {
    // first, check if the merkle root is known on chain - if not, then update
    await this.checkKnownRoot();
    const chainId = await this.signer.getChainId();
    const roots = await this.populateRootInfosForProof();
    const { input, extData } = await this.generateWitnessInput(
      roots,
      chainId,
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      merkleProofsForInputs
    );
    // console.log("hi1");
    // console.log(`input length is ${inputs.length}`);
    // console.log(`Witness Input is`);
    // console.log(input);
    const wtns = await this.createWitness(input, inputs.length == 2);
    let proofEncoded = await this.proveAndVerify(wtns, inputs.length == 2);
    //console.log(proofEncoded);
    const publicInputs: IVariableAnchorPublicInputs = this.generatePublicInputs(
      proofEncoded,
      roots,
      inputs,
      outputs,
      input.publicAmount,
      input.extDataHash.toString()
    );
    //console.log(`current root (class) is ${toFixedHex(this.tree.root())}`);
    outputs.forEach((x) => {
      this.tree.insert(toFixedHex(x.getCommitment()));
      let numOfElements = this.tree.number_of_elements();
      this.depositHistory[numOfElements - 1] = toFixedHex(this.tree.root().toString());
    });
    
    //console.log(`updated root (class) is ${toFixedHex(this.tree.root())}`);

    return {
      extData,
      publicInputs,
    };
  }

  public async transact(
    inputs: Utxo[], 
    outputs: Utxo[], 
    fee: BigNumberish = 0,
    recipient: string = '0', 
    relayer: string = '0'
  ) {
    //console.log(`current root (transact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
    
    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo({chainId: BigNumber.from(31337)}));
    }
    
    const merkleProofsForInputs = inputs.map((x) => this.getMerkleProof(x));
    
    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(new Utxo({chainId: BigNumber.from(31337)}));
      }
    }
    
    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
    
    //console.log(`extAmount is ${extAmount}`);
    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      merkleProofsForInputs,
    );

    let tx = await this.contract.transact(
      {
        ...publicInputs,
        outputCommitments: [
          publicInputs.outputCommitments[0],
          publicInputs.outputCommitments[1],
        ]
      },
      extData,
      { gasLimit: '0xBB8D80' }
    );
    const receipt = await tx.wait();
    //console.log(`updated root (transact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
    return receipt;
  }
  
  public async transactWrap(
    tokenAddress: string,
    inputs: Utxo[], 
    outputs: Utxo[], 
    fee: BigNumberish = 0,
    recipient: string = '0', 
    relayer: string = '0'
  ): Promise<ethers.ContractReceipt> {
    //console.log(`current root (transact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
    
    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo({chainId: BigNumber.from(31337)}));
    }
    
    const merkleProofsForInputs = inputs.map((x) => this.getMerkleProof(x));
    
    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(new Utxo({chainId: BigNumber.from(31337)}));
      }
    }
    
    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
    
    //console.log(`extAmount is ${extAmount}`);
    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      merkleProofsForInputs,
    );
    let tx;
    if (extAmount.gt(0) && checkNativeAddress(tokenAddress)) {
      tx = await this.contract.transactWrap(
        {
          ...publicInputs,
          outputCommitments: [
            publicInputs.outputCommitments[0],
            publicInputs.outputCommitments[1],
          ]
        },
        extData,
        tokenAddress,
        { 
          value: extAmount,
          gasLimit: '0x5B8D80' 
        }
      );
    } else {
      tx = await this.contract.transactWrap(
        {
          ...publicInputs,
          outputCommitments: [
            publicInputs.outputCommitments[0],
            publicInputs.outputCommitments[1],
          ]
        },
        extData,
        tokenAddress,
        { gasLimit: '0x5B8D80' }
      );
    }

    const receipt = await tx.wait();
    //console.log(`updated root (transact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
    return receipt;
  }

  public async bridgedTransact(
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    recipient: string,
    relayer: string,
    merkleProofsForInputs: any[]
  ): Promise<ethers.ContractReceipt> {
    // const { pathElements, pathIndices, merkleRoot } = merkleProofsForInputs;
    if (merkleProofsForInputs.length !== inputs.length) {
      throw new Error('Merkle proofs has different length than inputs');
    }

    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(new Utxo({originChainId: BigNumber.from(await this.signer.getChainId())}));
      }
    }

    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))

    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      merkleProofsForInputs,
    );


    let tx = await this.contract.transact(
      {
        ...publicInputs,
        outputCommitments: [
          publicInputs.outputCommitments[0],
          publicInputs.outputCommitments[1],
        ]
      },
      extData,
      { gasLimit: '0x5B8D80' }
    );
    const receipt = await tx.wait();
    return receipt;
  }

  //token address is address of underlying unwrapped ERC20
  public async bridgedTransactWrap(
    tokenAddress: string,
    inputs: Utxo[],
    outputs: Utxo[],
    fee: BigNumberish,
    recipient: string,
    relayer: string,
    merkleProofsForInputs: any[]
  ) {
    // const { pathElements, pathIndices, merkleRoot } = merkleProofsForInputs;
    if (merkleProofsForInputs.length !== inputs.length) {
      throw new Error('Merkle proofs has different length than inputs');
    }

    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(new Utxo({originChainId: BigNumber.from(await this.signer.getChainId())}));
      }
    }

    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))

    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      merkleProofsForInputs,
    );
    
    let tx;
    if (extAmount.gt(0) && checkNativeAddress(tokenAddress)) {
      tx = await this.contract.transactWrap(
        {
          ...publicInputs,
          outputCommitments: [
            publicInputs.outputCommitments[0],
            publicInputs.outputCommitments[1],
          ]
        },
        extData,
        tokenAddress,
        { 
          value: extAmount,
          gasLimit: '0x5B8D80' 
        }
      );
    } else {
      tx = await this.contract.transactWrap(
        {
          ...publicInputs,
          outputCommitments: [
            publicInputs.outputCommitments[0],
            publicInputs.outputCommitments[1],
          ]
        },
        extData,
        tokenAddress,
        { gasLimit: '0x5B8D80' }
      );
    }
    const receipt = await tx.wait();
    return receipt;
  }

  public async registerAndTransact(
    owner: string,
    publicKey: string,
    inputs: Utxo[] = [],
    outputs: Utxo[] = [],
    fee: BigNumberish = 0,
    recipient: string = '0',
    relayer: string = '0',
    merkleProofsForInputs: any[] = []
  ) {
    //console.log(`current root (registertransact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
    // const { pathElements, pathIndices, merkleRoot } = merkleProofsForInputs;

    while (inputs.length !== 2 && inputs.length < 16) {
      inputs.push(new Utxo({chainId: BigNumber.from(31337)}));
    }

    merkleProofsForInputs = inputs.map((x) => this.getMerkleProof(x));
    
    if (merkleProofsForInputs.length !== inputs.length) {
      throw new Error('Merkle proofs has different length than inputs');
    }
    
    if (outputs.length < 2) {
      while (outputs.length < 2) {
        outputs.push(new Utxo({chainId: BigNumber.from(31337)}));
      }
    }

    let extAmount = BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
    //console.log(`extAmount is ${extAmount}`);
    //console.log("hi");
    //console.log(outputs);
    const { extData, publicInputs } = await this.setupTransaction(
      inputs,
      outputs,
      extAmount,
      fee,
      recipient,
      relayer,
      merkleProofsForInputs,
    );

    const args = [
      { owner, publicKey },
      { ...publicInputs, outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]] },
      extData,
    ];
    //console.log(args);
    let tx = await this.contract.registerAndTransact(
      { owner, publicKey },
      { ...publicInputs, outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]] },
      extData,
      { gasLimit: '0x5B8D80' }
    );
    const receipt = await tx.wait();
    //console.log(`updated root (registertransact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
    return receipt;
  }
}

export default VAnchor;
