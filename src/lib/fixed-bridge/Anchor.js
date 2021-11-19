"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Anchor__factory_1 = require("../../typechain/factories/Anchor__factory");
const utils_1 = require("../utils");
const Poseidon_1 = __importDefault(require("../Poseidon"));
const MerkleTree_1 = require("./MerkleTree");
const path = require('path');
const snarkjs = require('snarkjs');
const F = require('circomlibjs').babyjub.F;
const Scalar = require('ffjavascript').Scalar;
const zeroAddress = "0x0000000000000000000000000000000000000000";
function checkNativeAddress(tokenAddress) {
    if (tokenAddress === zeroAddress || tokenAddress === '0') {
        return true;
    }
    return false;
}
;
;
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains merkle tree state)
// Functionality relevant to anchors in general (proving, verifying) is implemented in static methods
// Functionality relevant to a particular anchor deployment (deposit, withdraw) is implemented in instance methods 
class Anchor {
    constructor(contract, signer, treeHeight, maxEdges, zkComponents) {
        this.signer = signer;
        this.contract = contract;
        this.tree = new MerkleTree_1.MerkleTree('', treeHeight);
        this.latestSyncedBlock = 0;
        this.depositHistory = {};
        this.zkComponents = zkComponents;
    }
    // public static anchorFromAddress(
    //   contract: string,
    //   signer: ethers.Signer,
    // ) {
    //   const anchor = Anchor__factory.connect(contract, signer);
    //   return new Anchor(anchor, signer);
    // }
    // Deploys an Anchor contract and sets the signer for deposit and withdraws on this contract.
    static async createAnchor(verifier, hasher, denomination, merkleTreeHeight, token, bridge, admin, handler, maxEdges, zkComponents, signer) {
        const factory = new Anchor__factory_1.Anchor__factory(signer);
        const anchor = await factory.deploy(verifier, hasher, denomination, merkleTreeHeight, token, bridge, admin, handler, maxEdges, {});
        await anchor.deployed();
        const createdAnchor = new Anchor(anchor, signer, merkleTreeHeight, maxEdges, zkComponents);
        createdAnchor.latestSyncedBlock = anchor.deployTransaction.blockNumber;
        createdAnchor.denomination = denomination.toString();
        createdAnchor.token = token;
        return createdAnchor;
    }
    static async connect(
    // connect via factory method
    // build up tree by querying provider for logs
    address, zkFiles, signer) {
        const anchor = Anchor__factory_1.Anchor__factory.connect(address, signer);
        const maxEdges = await anchor.maxEdges();
        const treeHeight = await anchor.levels();
        const createdAnchor = new Anchor(anchor, signer, treeHeight, maxEdges, zkFiles);
        createdAnchor.token = await anchor.token();
        createdAnchor.denomination = (await anchor.denomination()).toString();
        return createdAnchor;
    }
    static generateDeposit(destinationChainId, secretBytesLen = 31, nullifierBytesLen = 31) {
        const chainID = BigInt(destinationChainId);
        const secret = (0, utils_1.rbigint)(secretBytesLen);
        const nullifier = (0, utils_1.rbigint)(nullifierBytesLen);
        const hasher = new Poseidon_1.default();
        const commitment = hasher.hash3([chainID, nullifier, secret]).toString();
        const nullifierHash = hasher.hash(null, nullifier, nullifier);
        const deposit = {
            chainID,
            secret,
            nullifier,
            commitment,
            nullifierHash
        };
        return deposit;
    }
    static createRootsBytes(rootArray) {
        let rootsBytes = "0x";
        for (let i = 0; i < rootArray.length; i++) {
            rootsBytes += (0, utils_1.toFixedHex)(rootArray[i]).substr(2);
        }
        return rootsBytes; // root byte string (32 * array.length bytes) 
    }
    ;
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
    static async generateWithdrawProofCallData(proof, publicSignals) {
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
    // Makes a deposit into the contract and return the parameters and index of deposit
    async deposit(destinationChainId) {
        const originChainId = await this.signer.getChainId();
        const destChainId = (destinationChainId) ? destinationChainId : originChainId;
        const deposit = Anchor.generateDeposit(destChainId);
        const tx = await this.contract.deposit((0, utils_1.toFixedHex)(deposit.commitment), { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        const index = this.tree.insert(deposit.commitment);
        this.depositHistory[index] = await this.contract.getLastRoot();
        const root = await this.contract.getLastRoot();
        return { deposit, index, originChainId };
    }
    async wrapAndDeposit(tokenAddress, destinationChainId) {
        const originChainId = await this.signer.getChainId();
        const chainId = (destinationChainId) ? destinationChainId : originChainId;
        const deposit = Anchor.generateDeposit(chainId);
        let tx;
        if (checkNativeAddress(tokenAddress)) {
            tx = await this.contract.wrapAndDeposit(tokenAddress, (0, utils_1.toFixedHex)(deposit.commitment), {
                value: this.denomination,
                gasLimit: '0x5B8D80'
            });
        }
        else {
            tx = await this.contract.wrapAndDeposit(tokenAddress, (0, utils_1.toFixedHex)(deposit.commitment), {
                gasLimit: '0x5B8D80'
            });
        }
        await tx.wait();
        const index = await this.tree.insert(deposit.commitment);
        const root = await this.contract.getLastRoot();
        this.depositHistory[index] = root;
        return { deposit, index, originChainId };
    }
    // sync the local tree with the tree on chain.
    // Start syncing from the given block number, otherwise zero.
    async update(blockNumber) {
        const filter = this.contract.filters.Deposit();
        const currentBlockNumber = await this.signer.provider.getBlockNumber();
        const events = await this.contract.queryFilter(filter, blockNumber || 0);
        const commitments = events.map((event) => event.args.commitment);
        let index = 0;
        for (const commitment of commitments) {
            this.tree.insert(commitment);
            this.depositHistory[index] = (0, utils_1.toFixedHex)(this.tree.get_root());
            index++;
        }
        this.latestSyncedBlock = currentBlockNumber;
    }
    async populateRootsForProof() {
        const neighborRoots = await this.contract.getLatestNeighborRoots();
        return [await this.contract.getLastRoot(), ...neighborRoots];
    }
    async generateWitnessInput(deposit, originChain, refreshCommitment, recipient, relayer, fee, refund, roots, pathElements, pathIndices) {
        const { chainID, nullifierHash, nullifier, secret } = deposit;
        let rootDiffIndex;
        // read the origin chain's index into the roots array
        if (chainID == BigInt(originChain)) {
            rootDiffIndex = 0;
        }
        else {
            const edgeIndex = await this.contract.edgeIndex(originChain);
            rootDiffIndex = edgeIndex.toNumber() + 1;
        }
        return {
            // public
            nullifierHash, refreshCommitment, recipient, relayer, fee, refund, chainID, roots,
            // private
            nullifier, secret, pathElements, pathIndices, diffs: roots.map(r => {
                return F.sub(Scalar.fromString(`${r}`), Scalar.fromString(`${roots[rootDiffIndex]}`)).toString();
            }),
        };
    }
    async checkKnownRoot() {
        const isKnownRoot = await this.contract.isKnownRoot((0, utils_1.toFixedHex)(await this.tree.get_root()));
        if (!isKnownRoot) {
            await this.update(this.latestSyncedBlock);
        }
    }
    async createWitness(data) {
        const buff = await this.zkComponents.witnessCalculator.calculateWTNSBin(data, 0);
        return buff;
    }
    async proveAndVerify(wtns) {
        let res = await snarkjs.groth16.prove(this.zkComponents.zkey, wtns);
        let proof = res.proof;
        let publicSignals = res.publicSignals;
        const vKey = await snarkjs.zKey.exportVerificationKey(this.zkComponents.zkey);
        res = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        let proofEncoded = await Anchor.generateWithdrawProofCallData(proof, publicSignals);
        return proofEncoded;
    }
    async setupWithdraw(deposit, index, recipient, relayer, fee, refreshCommitment) {
        // first, check if the merkle root is known on chain - if not, then update
        await this.checkKnownRoot();
        const { merkleRoot, pathElements, pathIndices } = await this.tree.path(index);
        const chainId = await this.signer.getChainId();
        const roots = await this.populateRootsForProof();
        const input = await this.generateWitnessInput(deposit, chainId, refreshCommitment, BigInt(recipient), BigInt(relayer), BigInt(fee), BigInt(0), roots, pathElements, pathIndices);
        const wtns = await this.createWitness(input);
        let proofEncoded = await this.proveAndVerify(wtns);
        const args = [
            Anchor.createRootsBytes(input.roots),
            (0, utils_1.toFixedHex)(input.nullifierHash),
            (0, utils_1.toFixedHex)(input.refreshCommitment, 32),
            (0, utils_1.toFixedHex)(input.recipient, 20),
            (0, utils_1.toFixedHex)(input.relayer, 20),
            (0, utils_1.toFixedHex)(input.fee),
            (0, utils_1.toFixedHex)(input.refund),
        ];
        const publicInputs = Anchor.convertArgsArrayToStruct(args);
        return {
            input,
            args,
            proofEncoded,
            publicInputs,
        };
    }
    async withdraw(deposit, index, recipient, relayer, fee, refreshCommitment) {
        const { args, input, proofEncoded, publicInputs } = await this.setupWithdraw(deposit, index, recipient, relayer, fee, refreshCommitment);
        //@ts-ignore
        let tx = await this.contract.withdraw(`0x${proofEncoded}`, publicInputs, { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        if (args[2] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            this.tree.insert(input.refreshCommitment);
            const filter = this.contract.filters.Refresh(null, null, null);
            const events = await this.contract.queryFilter(filter, receipt.blockHash);
            return events[0];
        }
        else {
            const filter = this.contract.filters.Withdrawal(null, null, relayer, null);
            const events = await this.contract.queryFilter(filter, receipt.blockHash);
            return events[0];
        }
    }
    async withdrawAndUnwrap(deposit, originChainId, index, recipient, relayer, fee, refreshCommitment, tokenAddress) {
        // first, check if the merkle root is known on chain - if not, then update
        await this.checkKnownRoot();
        const { merkleRoot, pathElements, pathIndices } = await this.tree.path(index);
        const roots = await this.populateRootsForProof();
        const input = await this.generateWitnessInput(deposit, originChainId, refreshCommitment, BigInt(recipient), BigInt(relayer), BigInt(fee), BigInt(0), roots, pathElements, pathIndices);
        const wtns = await this.createWitness(input);
        let proofEncoded = await this.proveAndVerify(wtns);
        const args = [
            Anchor.createRootsBytes(input.roots),
            (0, utils_1.toFixedHex)(input.nullifierHash),
            (0, utils_1.toFixedHex)(input.refreshCommitment, 32),
            (0, utils_1.toFixedHex)(input.recipient, 20),
            (0, utils_1.toFixedHex)(input.relayer, 20),
            (0, utils_1.toFixedHex)(input.fee),
            (0, utils_1.toFixedHex)(input.refund),
        ];
        const publicInputs = Anchor.convertArgsArrayToStruct(args);
        //@ts-ignore
        let tx = await this.contract.withdrawAndUnwrap(`0x${proofEncoded}`, publicInputs, tokenAddress, { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        const filter = this.contract.filters.Withdrawal(null, null, null, null);
        const events = await this.contract.queryFilter(filter, receipt.blockHash);
        return events[0];
    }
    // A bridgedWithdraw needs the merkle proof to be generated from an anchor other than this one,
    async bridgedWithdrawAndUnwrap(deposit, merkleProof, recipient, relayer, fee, refund, refreshCommitment, tokenAddress) {
        const { pathElements, pathIndices, merkleRoot } = merkleProof;
        const isKnownNeighborRoot = await this.contract.isKnownNeighborRoot(deposit.originChainId, (0, utils_1.toFixedHex)(merkleRoot));
        if (!isKnownNeighborRoot) {
            throw new Error("Neighbor root not found");
        }
        refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';
        const roots = await this.populateRootsForProof();
        const input = await this.generateWitnessInput(deposit.deposit, deposit.originChainId, refreshCommitment, BigInt(recipient), BigInt(relayer), BigInt(fee), BigInt(refund), roots, pathElements, pathIndices);
        const wtns = await this.createWitness(input);
        let proofEncoded = await this.proveAndVerify(wtns);
        const args = [
            Anchor.createRootsBytes(input.roots),
            (0, utils_1.toFixedHex)(input.nullifierHash),
            (0, utils_1.toFixedHex)(input.refreshCommitment, 32),
            (0, utils_1.toFixedHex)(input.recipient, 20),
            (0, utils_1.toFixedHex)(input.relayer, 20),
            (0, utils_1.toFixedHex)(input.fee),
            (0, utils_1.toFixedHex)(input.refund),
        ];
        const publicInputs = Anchor.convertArgsArrayToStruct(args);
        //@ts-ignore
        let tx = await this.contract.withdrawAndUnwrap(`0x${proofEncoded}`, publicInputs, tokenAddress, {
            gasLimit: '0x5B8D80'
        });
        const receipt = await tx.wait();
        const filter = this.contract.filters.Withdrawal(null, null, relayer, null);
        const events = await this.contract.queryFilter(filter, receipt.blockHash);
        return events[0];
    }
    static convertArgsArrayToStruct(args) {
        return {
            _roots: args[0],
            _nullifierHash: args[1],
            _refreshCommitment: args[2],
            _recipient: args[3],
            _relayer: args[4],
            _fee: args[5],
            _refund: args[6],
        };
    }
    async bridgedWithdraw(deposit, merkleProof, recipient, relayer, fee, refund, refreshCommitment) {
        const { pathElements, pathIndices, merkleRoot } = merkleProof;
        const isKnownNeighborRoot = await this.contract.isKnownNeighborRoot(deposit.originChainId, (0, utils_1.toFixedHex)(merkleRoot));
        if (!isKnownNeighborRoot) {
            throw new Error("Neighbor root not found");
        }
        refreshCommitment = (refreshCommitment) ? refreshCommitment : '0';
        const lastRoot = await this.tree.get_root();
        const roots = await this.populateRootsForProof();
        const input = await this.generateWitnessInput(deposit.deposit, deposit.originChainId, refreshCommitment, BigInt(recipient), BigInt(relayer), BigInt(fee), BigInt(refund), roots, pathElements, pathIndices);
        const wtns = await this.createWitness(input);
        let proofEncoded = await this.proveAndVerify(wtns);
        const args = [
            Anchor.createRootsBytes(input.roots),
            (0, utils_1.toFixedHex)(input.nullifierHash),
            (0, utils_1.toFixedHex)(input.refreshCommitment, 32),
            (0, utils_1.toFixedHex)(input.recipient, 20),
            (0, utils_1.toFixedHex)(input.relayer, 20),
            (0, utils_1.toFixedHex)(input.fee),
            (0, utils_1.toFixedHex)(input.refund),
        ];
        const publicInputs = Anchor.convertArgsArrayToStruct(args);
        //@ts-ignore
        let tx = await this.contract.withdraw(`0x${proofEncoded}`, publicInputs, {
            gasLimit: '0x5B8D80'
        });
        const receipt = await tx.wait();
        const filter = this.contract.filters.Withdrawal(null, null, relayer, null);
        const events = await this.contract.queryFilter(filter, receipt.blockHash);
        return events[0];
    }
}
exports.default = Anchor;
//# sourceMappingURL=Anchor.js.map