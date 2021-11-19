"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const VAnchor__factory_1 = require("../../typechain/factories/VAnchor__factory");
const utils_1 = require("../utils");
const MerkleTree_1 = require("./MerkleTree");
const utils_2 = require("./utils");
const utxo_1 = require("./utxo");
const path = require('path');
const snarkjs = require('snarkjs');
const F = require('circomlibjs').babyjub.F;
const Scalar = require('ffjavascript').Scalar;
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods 
class VAnchor {
    constructor(contract, signer, treeHeight, maxEdges) {
        this.signer = signer;
        this.contract = contract;
        this.tree = new MerkleTree_1.MerkleTree(treeHeight);
        this.latestSyncedBlock = 0;
        this.depositHistory = {};
        this.smallWitnessCalculator = {};
        this.largeWitnessCalculator = {};
        // set the circuit zkey and wasm depending upon max edges
        switch (maxEdges) {
            case 1:
                this.smallCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm';
                this.smallCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey';
                this.smallWitnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js");
                this.largeCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm';
                this.largeCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/circuit_final.zkey';
                this.largeWitnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js");
                break;
            case 7:
                this.smallCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/8/poseidon_vanchor_8_2.wasm';
                this.smallCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/8/circuit_final.zkey';
                this.smallWitnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_2/8/witness_calculator.js");
                this.largeCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm';
                this.largeCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/8/circuit_final.zkey';
                this.largeWitnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_16/8/witness_calculator.js");
                break;
            default:
                this.smallCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/poseidon_vanchor_2_2.wasm';
                this.smallCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_2/2/circuit_final.zkey';
                this.smallWitnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_2/2/witness_calculator.js");
                this.largeCircuitWASMPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/poseidon_vanchor_16_2.wasm';
                this.largeCircuitZkeyPath = 'protocol-solidity-fixtures/fixtures/vanchor_16/2/circuit_final.zkey';
                this.largeWitnessCalculator = require("../../protocol-solidity-fixtures/fixtures/vanchor_16/2/witness_calculator.js");
                break;
        }
    }
    static async createVAnchor(verifier, levels, hasher, token, permissions, maxEdges, signer) {
        const factory = new VAnchor__factory_1.VAnchor__factory(signer);
        const vAnchor = await factory.deploy(verifier, levels, hasher, token, permissions, maxEdges, {});
        await vAnchor.deployed();
        const createdVAnchor = new VAnchor(vAnchor, signer, ethers_1.BigNumber.from(levels).toNumber(), maxEdges);
        createdVAnchor.latestSyncedBlock = vAnchor.deployTransaction.blockNumber;
        createdVAnchor.token = token;
        return createdVAnchor;
    }
    static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address, signer) {
        const anchor = VAnchor__factory_1.VAnchor__factory.connect(address, signer);
        const maxEdges = await anchor.maxEdges();
        const treeHeight = await anchor.levels();
        const createdAnchor = new VAnchor(anchor, signer, treeHeight, maxEdges);
        createdAnchor.token = await anchor.token();
        return createdAnchor;
    }
    static generateUTXO(utxoInputs) {
        return new utxo_1.Utxo({
            chainId: utxoInputs.chainId,
            amount: utxoInputs.amount,
            blinding: utxoInputs.blinding,
            keypair: utxoInputs.keypair,
            index: undefined,
        });
    }
    static createRootsBytes(rootArray) {
        let rootsBytes = "0x";
        for (let i = 0; i < rootArray.length; i++) {
            rootsBytes += (0, utils_2.toFixedHex)(rootArray[i]).substr(2);
        }
        return rootsBytes; // root byte string (32 * array.length bytes) 
    }
    ;
    // Convert a hex string to a byte array
    static hexStringToByte(str) {
        if (!str) {
            return new Uint8Array();
        }
        var a = [];
        for (var i = 0, len = str.length; i < len; i += 2) {
            // @ts-ignore
            a.push(parseInt(str.substr(i, 2), 16));
        }
        return new Uint8Array(a);
    }
    static async groth16ExportSolidityCallData(proof, pub) {
        let inputs = "";
        for (let i = 0; i < pub.length; i++) {
            if (inputs != "")
                inputs = inputs + ",";
            inputs = inputs + (0, utils_1.p256)(pub[i]);
        }
        let S;
        S = `[${(0, utils_1.p256)(proof.pi_a[0])}, ${(0, utils_1.p256)(proof.pi_a[1])}],` +
            `[[${(0, utils_1.p256)(proof.pi_b[0][1])}, ${(0, utils_1.p256)(proof.pi_b[0][0])}],[${(0, utils_1.p256)(proof.pi_b[1][1])}, ${(0, utils_1.p256)(proof.pi_b[1][0])}]],` +
            `[${(0, utils_1.p256)(proof.pi_c[0])}, ${(0, utils_1.p256)(proof.pi_c[1])}],` +
            `[${inputs}]`;
        return S;
    }
    static convertToPublicInputsStruct(args) {
        return {
            proof: args[0],
            roots: args[1],
            inputNullifiers: args[2],
            outputCommitments: args[3],
            publicAmount: args[4],
            extDataHash: args[5]
        };
    }
    static convertToExtDataStruct(args) {
        return {
            recipient: args[0],
            extAmount: args[1],
            relayer: args[2],
            fee: args[3],
            encryptedOutput1: args[4],
            encryptedOutput2: args[5]
        };
    }
    static async generateWithdrawProofCallData(proof, publicSignals) {
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
    // sync the local tree with the tree on chain.
    // Start syncing from the given block number, otherwise zero.
    async update(blockNumber) {
        // const filter = this.contract.filters.Deposit();
        // const currentBlockNumber = await this.signer.provider!.getBlockNumber();
        // const events = await this.contract.queryFilter(filter, blockNumber || 0);
        // const commitments = events.map((event) => event.args.commitment);
        // this.tree.batch_insert(commitments);
        // this.latestSyncedBlock = currentBlockNumber;
    }
    async createResourceId() {
        return (0, utils_1.toHex)(this.contract.address + (0, utils_1.toHex)((await this.signer.getChainId()), 4).substr(2), 32);
    }
    async setHandler(handlerAddress) {
        const tx = await this.contract.setHandler(handlerAddress);
        await tx.wait();
    }
    async setBridge(bridgeAddress) {
        const tx = await this.contract.setBridge(bridgeAddress);
        await tx.wait();
    }
    async setSigner(newSigner) {
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
    async getProposalData(leafIndex) {
        // If no leaf index passed in, set it to the most recent one.
        if (!leafIndex) {
            leafIndex = this.tree.number_of_elements() - 1;
        }
        const chainID = await this.signer.getChainId();
        const merkleRoot = this.depositHistory[leafIndex];
        return '0x' +
            (0, utils_1.toHex)(chainID, 32).substr(2) +
            (0, utils_1.toHex)(leafIndex, 32).substr(2) +
            (0, utils_1.toHex)(merkleRoot, 32).substr(2);
    }
    async populateRootInfosForProof() {
        const neighborEdges = await this.contract.getLatestNeighborEdges();
        const neighborRootInfos = neighborEdges.map((rootData) => {
            return {
                merkleRoot: rootData.root,
                chainId: rootData.chainID,
            };
        });
        let thisRoot = await this.contract.getLastRoot();
        const thisChainId = await this.signer.getChainId();
        return [{
                merkleRoot: thisRoot,
                chainId: thisChainId,
            }, ...neighborRootInfos];
    }
    async getClassAndContractRoots() {
        return [this.tree.root(), await this.contract.getLastRoot()];
    }
    /**
     *
     * @param input A UTXO object that is inside the tree
     * @returns
     */
    getMerkleProof(input) {
        let inputMerklePathIndex;
        let inputMerklePathElements;
        if (input.amount > 0) {
            input.index = this.tree.indexOf((0, utils_2.toFixedHex)(input.getCommitment()));
            if (input.index < 0) {
                throw new Error(`Input commitment ${(0, utils_2.toFixedHex)(input.getCommitment())} was not found`);
            }
            inputMerklePathIndex = input.index;
            inputMerklePathElements = this.tree.path(input.index).pathElements;
        }
        else {
            inputMerklePathIndex = 0;
            inputMerklePathElements = new Array(this.tree.levels).fill(0);
        }
        return {
            pathElements: inputMerklePathElements,
            pathIndex: inputMerklePathIndex,
            merkleRoot: this.tree.root(),
        };
    }
    async generateWitnessInput(roots, chainId, inputs, outputs, extAmount, fee, recipient, relayer, externalMerkleProofs) {
        const extData = {
            recipient: (0, utils_2.toFixedHex)(recipient, 20),
            extAmount: (0, utils_2.toFixedHex)(extAmount),
            relayer: (0, utils_2.toFixedHex)(relayer, 20),
            fee: (0, utils_2.toFixedHex)(fee),
            encryptedOutput1: outputs[0].encrypt(),
            encryptedOutput2: outputs[1].encrypt()
        };
        const extDataHash = (0, utils_2.getExtDataHash)(extData);
        //console.log(roots);
        let input = {
            roots: roots.map((x) => ethers_1.BigNumber.from(x.merkleRoot).toString()),
            diffs: inputs.map((x) => x.getDiffs(roots)),
            chainID: chainId.toString(),
            inputNullifier: inputs.map((x) => x.getNullifier().toString()),
            outputCommitment: outputs.map((x) => x.getCommitment().toString()),
            publicAmount: ethers_1.BigNumber.from(extAmount).sub(fee).add(utils_2.FIELD_SIZE).mod(utils_2.FIELD_SIZE).toString(),
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
            outPubkey: outputs.map((x) => (0, utils_2.toFixedHex)(x.keypair.pubkey).toString()),
            outBlinding: outputs.map((x) => x.blinding.toString())
        };
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
            input.inputNullifier = [...[0, 1].map((_r) => {
                    return '0x0000000000000000000000000000000000000000000000000000000000000000';
                })];
        }
        return {
            input,
            extData,
        };
    }
    generatePublicInputs(proof, roots, inputs, outputs, publicAmount, extDataHash) {
        // public inputs to the contract
        const args = {
            proof: `0x${proof}`,
            roots: `0x${roots.map((x) => (0, utils_2.toFixedHex)(x.merkleRoot).slice(2)).join('')}`,
            inputNullifiers: inputs.map((x) => (0, utils_2.toFixedHex)(x.getNullifier())),
            outputCommitments: [(0, utils_2.toFixedHex)(outputs[0].getCommitment()), (0, utils_2.toFixedHex)(outputs[1].getCommitment())],
            publicAmount: (0, utils_2.toFixedHex)(publicAmount),
            extDataHash: (0, utils_2.toFixedHex)(extDataHash),
        };
        if (args.inputNullifiers.length === 0) {
            args.inputNullifiers = [...[0, 1].map((_r) => {
                    return '0x0000000000000000000000000000000000000000000000000000000000000000';
                })];
        }
        return args;
    }
    async checkKnownRoot() {
        const isKnownRoot = await this.contract.isKnownRoot((0, utils_2.toFixedHex)(this.tree.root()));
        if (!isKnownRoot) {
            await this.update(this.latestSyncedBlock);
        }
    }
    async createWitness(data, small) {
        const fileBuf = require('fs').readFileSync(small ? this.smallCircuitWASMPath : this.largeCircuitWASMPath);
        const witnessCalculator = small
            ? await this.smallWitnessCalculator(fileBuf)
            : await this.largeWitnessCalculator(fileBuf);
        const buff = await witnessCalculator.calculateWTNSBin(data, 0);
        return buff;
    }
    async proveAndVerify(wtns, small) {
        let res = await snarkjs.groth16.prove(small
            ? this.smallCircuitZkeyPath
            : this.largeCircuitZkeyPath, wtns);
        let proof = res.proof;
        let publicSignals = res.publicSignals;
        const vKey = await snarkjs.zKey.exportVerificationKey(small
            ? this.smallCircuitZkeyPath
            : this.largeCircuitZkeyPath);
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        let proofEncoded = await VAnchor.generateWithdrawProofCallData(proof, publicSignals);
        return proofEncoded;
    }
    async setupTransaction(inputs, outputs, extAmount, fee, recipient, relayer, merkleProofsForInputs) {
        // first, check if the merkle root is known on chain - if not, then update
        await this.checkKnownRoot();
        const chainId = await this.signer.getChainId();
        //console.log(`chain id is ${chainId}`);
        const roots = await this.populateRootInfosForProof();
        const { input, extData } = await this.generateWitnessInput(roots, chainId, inputs, outputs, extAmount, fee, recipient, relayer, merkleProofsForInputs);
        // console.log("hi1");
        // console.log(`input length is ${inputs.length}`);
        // console.log(`Witness Input is`);
        // console.log(input);
        const wtns = await this.createWitness(input, inputs.length == 2);
        let proofEncoded = await this.proveAndVerify(wtns, inputs.length == 2);
        //console.log(proofEncoded);
        const publicInputs = this.generatePublicInputs(proofEncoded, roots, inputs, outputs, input.publicAmount, input.extDataHash.toString());
        //console.log(`current root (class) is ${toFixedHex(this.tree.root())}`);
        outputs.forEach((x) => {
            this.tree.insert((0, utils_2.toFixedHex)(x.getCommitment()));
        });
        //console.log(`updated root (class) is ${toFixedHex(this.tree.root())}`);
        return {
            extData,
            publicInputs,
        };
    }
    async transact(inputs, outputs, fee = 0, recipient = '0', relayer = '0') {
        //console.log(`current root (transact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
        while (inputs.length !== 2 && inputs.length < 16) {
            inputs.push(new utxo_1.Utxo({ chainId: ethers_1.BigNumber.from(31337) }));
        }
        const merkleProofsForInputs = inputs.map((x) => this.getMerkleProof(x));
        if (outputs.length < 2) {
            while (outputs.length < 2) {
                outputs.push(new utxo_1.Utxo({ chainId: ethers_1.BigNumber.from(31337) }));
            }
        }
        let extAmount = ethers_1.BigNumber.from(fee)
            .add(outputs.reduce((sum, x) => sum.add(x.amount), ethers_1.BigNumber.from(0)))
            .sub(inputs.reduce((sum, x) => sum.add(x.amount), ethers_1.BigNumber.from(0)));
        //console.log(`extAmount is ${extAmount}`);
        const { extData, publicInputs } = await this.setupTransaction(inputs, outputs, extAmount, fee, recipient, relayer, merkleProofsForInputs);
        let tx = await this.contract.transact({
            ...publicInputs,
            outputCommitments: [
                publicInputs.outputCommitments[0],
                publicInputs.outputCommitments[1],
            ]
        }, extData, { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        //console.log(`updated root (transact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
        return receipt;
    }
    async bridgedTransact(inputs, outputs, fee, recipient, relayer, merkleProofsForInputs) {
        // const { pathElements, pathIndices, merkleRoot } = merkleProofsForInputs;
        if (merkleProofsForInputs.length !== inputs.length) {
            throw new Error('Merkle proofs has different length than inputs');
        }
        if (outputs.length < 2) {
            while (outputs.length < 2) {
                outputs.push(new utxo_1.Utxo());
            }
        }
        let extAmount = ethers_1.BigNumber.from(fee)
            .add(outputs.reduce((sum, x) => sum.add(x.amount), ethers_1.BigNumber.from(0)))
            .sub(inputs.reduce((sum, x) => sum.add(x.amount), ethers_1.BigNumber.from(0)));
        const { extData, publicInputs } = await this.setupTransaction(inputs, outputs, extAmount, fee, recipient, relayer, merkleProofsForInputs);
        let tx = await this.contract.transact({
            ...publicInputs,
            outputCommitments: [
                publicInputs.outputCommitments[0],
                publicInputs.outputCommitments[1],
            ]
        }, extData, { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        return receipt;
    }
    async registerAndTransact(owner, publicKey, inputs = [], outputs = [], fee = 0, recipient = '0', relayer = '0', merkleProofsForInputs = []) {
        //console.log(`current root (registertransact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
        // const { pathElements, pathIndices, merkleRoot } = merkleProofsForInputs;
        while (inputs.length !== 2 && inputs.length < 16) {
            inputs.push(new utxo_1.Utxo({ chainId: ethers_1.BigNumber.from(31337) }));
        }
        merkleProofsForInputs = inputs.map((x) => this.getMerkleProof(x));
        if (merkleProofsForInputs.length !== inputs.length) {
            throw new Error('Merkle proofs has different length than inputs');
        }
        if (outputs.length < 2) {
            while (outputs.length < 2) {
                outputs.push(new utxo_1.Utxo({ chainId: ethers_1.BigNumber.from(31337) }));
            }
        }
        let extAmount = ethers_1.BigNumber.from(fee)
            .add(outputs.reduce((sum, x) => sum.add(x.amount), ethers_1.BigNumber.from(0)))
            .sub(inputs.reduce((sum, x) => sum.add(x.amount), ethers_1.BigNumber.from(0)));
        //console.log(`extAmount is ${extAmount}`);
        //console.log("hi");
        //console.log(outputs);
        const { extData, publicInputs } = await this.setupTransaction(inputs, outputs, extAmount, fee, recipient, relayer, merkleProofsForInputs);
        const args = [
            { owner, publicKey },
            { ...publicInputs, outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]] },
            extData,
        ];
        //console.log(args);
        let tx = await this.contract.registerAndTransact({ owner, publicKey }, { ...publicInputs, outputCommitments: [publicInputs.outputCommitments[0], publicInputs.outputCommitments[1]] }, extData, { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        //console.log(`updated root (registertransact, contract) is ${toFixedHex(await this.contract.getLastRoot())}`);
        return receipt;
    }
}
exports.default = VAnchor;
//# sourceMappingURL=VAnchor.js.map