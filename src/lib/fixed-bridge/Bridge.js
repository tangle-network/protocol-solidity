"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BridgeSide_1 = __importDefault(require("./BridgeSide"));
const Anchor_1 = __importDefault(require("./Anchor"));
const AnchorHandler_1 = __importDefault(require("./AnchorHandler"));
const MintableToken_1 = __importDefault(require("../tokens/MintableToken"));
const utils_1 = require("../utils");
const Verifier_1 = __importDefault(require("./Verifier"));
const GovernedTokenWrapper_1 = __importDefault(require("../tokens/GovernedTokenWrapper"));
const zeroAddress = "0x0000000000000000000000000000000000000000";
function checkNativeAddress(tokenAddress) {
    if (tokenAddress === zeroAddress || tokenAddress === '0') {
        return true;
    }
    return false;
}
// A bridge is 
class Bridge {
    constructor(
    // Mapping of chainId => bridgeSide
    bridgeSides, 
    // chainID => GovernedTokenWrapper (webbToken) address
    webbTokenAddresses, 
    // Mapping of resourceID => linkedAnchor[]; so we know which
    // anchors need updating when the anchor for resourceID changes state.
    linkedAnchors, 
    // Mapping of anchorIdString => Anchor for easy anchor access
    anchors) {
        this.bridgeSides = bridgeSides;
        this.webbTokenAddresses = webbTokenAddresses;
        this.linkedAnchors = linkedAnchors;
        this.anchors = anchors;
    }
    static createAnchorIdString(anchorIdentifier) {
        return `${anchorIdentifier.chainId.toString()}-${anchorIdentifier.anchorSize.toString()}`;
    }
    static createAnchorIdentifier(anchorString) {
        const identifyingInfo = anchorString.split('-');
        if (identifyingInfo.length != 2) {
            return null;
        }
        return {
            chainId: Number(identifyingInfo[0]),
            anchorSize: identifyingInfo[1],
        };
    }
    // Takes as input a 2D array [[anchors to link together], [...]]
    // And returns a map of resourceID => linkedAnchor[]
    static async createLinkedAnchorMap(createdAnchors) {
        let linkedAnchorMap = new Map();
        for (let groupedAnchors of createdAnchors) {
            for (let i = 0; i < groupedAnchors.length; i++) {
                // create the resourceID of this anchor
                let resourceID = await groupedAnchors[i].createResourceId();
                let linkedAnchors = [];
                for (let j = 0; j < groupedAnchors.length; j++) {
                    if (i != j) {
                        linkedAnchors.push(groupedAnchors[j]);
                    }
                }
                // insert the linked anchors into the linked map
                linkedAnchorMap.set(resourceID, linkedAnchors);
            }
        }
        return linkedAnchorMap;
    }
    static async deployBridge(bridgeInput, deployers, zkComponents) {
        let webbTokenAddresses = new Map();
        let bridgeSides = new Map();
        let anchors = new Map();
        // createdAnchors have the form of [[Anchors created on chainID], [...]]
        // and anchors in the subArrays of thhe same index should be linked together
        let createdAnchors = [];
        for (let chainID of bridgeInput.chainIDs) {
            const adminAddress = await deployers[chainID].getAddress();
            // Create the bridgeSide
            const bridgeInstance = await BridgeSide_1.default.createBridgeSide([adminAddress], 1, 0, 100, deployers[chainID]);
            bridgeSides.set(chainID, bridgeInstance);
            console.log(`bridgeSide address on ${chainID}: ${bridgeInstance.contract.address}`);
            // Create the Hasher and Verifier for the chain
            const hasherFactory = await (0, utils_1.getHasherFactory)(deployers[chainID]);
            let hasherInstance = await hasherFactory.deploy({ gasLimit: '0x5B8D80' });
            await hasherInstance.deployed();
            const verifier = await Verifier_1.default.createVerifier(deployers[chainID]);
            let verifierInstance = verifier.contract;
            // Check the addresses of the asset. If it is zero, deploy a native token wrapper
            let allowedNative = false;
            for (const tokenToBeWrapped of bridgeInput.anchorInputs.asset[chainID]) {
                // If passed '0' or zero address, token to be wrapped should support native.
                if (checkNativeAddress(tokenToBeWrapped)) {
                    allowedNative = true;
                }
            }
            let tokenInstance = await GovernedTokenWrapper_1.default.createGovernedTokenWrapper(`webbETH-test-1`, `webbETH-test-1`, await deployers[chainID].getAddress(), '10000000000000000000000000', allowedNative, deployers[chainID]);
            console.log(`created GovernedTokenWrapper on ${chainID}: ${tokenInstance.contract.address}`);
            // Add all token addresses to the governed token instance.
            for (const tokenToBeWrapped of bridgeInput.anchorInputs.asset[chainID]) {
                // if the address is not '0', then add it
                if (!checkNativeAddress(tokenToBeWrapped)) {
                    const tx = await tokenInstance.contract.add(tokenToBeWrapped);
                    const receipt = await tx.wait();
                }
            }
            // append each token
            webbTokenAddresses.set(chainID, tokenInstance.contract.address);
            let chainGroupedAnchors = [];
            // loop through all the anchor sizes on the token
            for (let anchorSize of bridgeInput.anchorInputs.anchorSizes) {
                const anchorInstance = await Anchor_1.default.createAnchor(verifierInstance.address, hasherInstance.address, anchorSize, 30, tokenInstance.contract.address, adminAddress, adminAddress, adminAddress, bridgeInput.chainIDs.length - 1, zkComponents, deployers[chainID]);
                console.log(`createdAnchor: ${anchorInstance.contract.address}`);
                // grant minting rights to the anchor
                await tokenInstance.grantMinterRole(anchorInstance.contract.address);
                chainGroupedAnchors.push(anchorInstance);
                anchors.set(Bridge.createAnchorIdString({ anchorSize, chainId: chainID }), anchorInstance);
            }
            await Bridge.setPermissions(bridgeInstance, chainGroupedAnchors);
            createdAnchors.push(chainGroupedAnchors);
        }
        // All anchors created, massage data to group anchors which should be linked together
        let groupLinkedAnchors = [];
        // all subarrays will have the same number of elements
        for (let i = 0; i < createdAnchors[0].length; i++) {
            let linkedAnchors = [];
            for (let j = 0; j < createdAnchors.length; j++) {
                linkedAnchors.push(createdAnchors[j][i]);
            }
            groupLinkedAnchors.push(linkedAnchors);
        }
        // finally, link the anchors
        const linkedAnchorMap = await Bridge.createLinkedAnchorMap(groupLinkedAnchors);
        return new Bridge(bridgeSides, webbTokenAddresses, linkedAnchorMap, anchors);
    }
    // The setPermissions method accepts initialized bridgeSide and anchors.
    // it creates the anchor handler and sets the appropriate permissions
    // for the bridgeSide/anchorHandler/anchor
    static async setPermissions(bridgeSide, anchors) {
        let resourceIDs = [];
        let anchorAddresses = [];
        for (let anchor of anchors) {
            resourceIDs.push(await anchor.createResourceId());
            anchorAddresses.push(anchor.contract.address);
        }
        const handler = await AnchorHandler_1.default.createAnchorHandler(bridgeSide.contract.address, resourceIDs, anchorAddresses, bridgeSide.admin);
        await bridgeSide.setAnchorHandler(handler);
        for (let anchor of anchors) {
            await bridgeSide.connectAnchor(anchor);
        }
    }
    /** Update the state of BridgeSides and Anchors, when
    *** state changes for the @param linkedAnchor
    **/
    async updateLinkedAnchors(linkedAnchor) {
        // Find the bridge sides that are connected to this Anchor
        const linkedResourceID = await linkedAnchor.createResourceId();
        const anchorsToUpdate = this.linkedAnchors.get(linkedResourceID);
        if (!anchorsToUpdate) {
            return;
        }
        // update the sides
        for (let anchor of anchorsToUpdate) {
            // get the bridge side which corresponds to this anchor
            const chainId = await anchor.signer.getChainId();
            const bridgeSide = this.bridgeSides.get(chainId);
            await bridgeSide.voteProposal(linkedAnchor, anchor);
            await bridgeSide.executeProposal(linkedAnchor, anchor);
        }
    }
    ;
    async update(chainId, anchorSize) {
        const anchor = this.getAnchor(chainId, anchorSize);
        if (!anchor) {
            return;
        }
        await this.updateLinkedAnchors(anchor);
    }
    getBridgeSide(chainId) {
        return this.bridgeSides.get(chainId);
    }
    getAnchor(chainId, anchorSize) {
        let intendedAnchor = undefined;
        intendedAnchor = this.anchors.get(Bridge.createAnchorIdString({ anchorSize, chainId }));
        return intendedAnchor;
    }
    // Returns the address of the webbToken which wraps the given token name.
    getWebbTokenAddress(chainId) {
        return this.webbTokenAddresses.get(chainId);
    }
    // public queryAnchors(query: AnchorQuery): Anchor[] {
    // }
    exportConfig() {
        return {
            webbTokenAddresses: this.webbTokenAddresses,
            anchors: this.anchors,
            bridgeSides: this.bridgeSides
        };
    }
    async deposit(destinationChainId, anchorSize, signer) {
        const chainId = await signer.getChainId();
        const signerAddress = await signer.getAddress();
        const anchor = this.getAnchor(chainId, anchorSize);
        if (!anchor) {
            throw new Error("Anchor is not supported for the given token and size");
        }
        const tokenAddress = await anchor.contract.token();
        if (!tokenAddress) {
            throw new Error("Token not supported");
        }
        // Check if appropriate balance from user
        const tokenInstance = await MintableToken_1.default.tokenFromAddress(tokenAddress, signer);
        const userTokenBalance = await tokenInstance.getBalance(signerAddress);
        if (userTokenBalance.lt(anchorSize)) {
            throw new Error("Not enough balance in webbTokens");
        }
        // Approve spending if needed
        const userTokenAllowance = await tokenInstance.getAllowance(signerAddress, anchor.contract.address);
        if (userTokenAllowance.lt(anchorSize)) {
            await tokenInstance.approveSpending(anchor.contract.address);
        }
        // return some error code value for deposit note if signer invalid
        if (!(await anchor.setSigner(signer))) {
            throw new Error("Invalid signer for deposit, check the signer's chainID");
        }
        const deposit = await anchor.deposit(destinationChainId);
        await this.updateLinkedAnchors(anchor);
        return deposit;
    }
    async wrapAndDeposit(destinationChainId, tokenAddress, anchorSize, signer) {
        const chainId = await signer.getChainId();
        const signerAddress = await signer.getAddress();
        const anchor = this.getAnchor(chainId, anchorSize);
        if (!anchor) {
            throw new Error("Anchor is not supported for the given token and size");
        }
        // Different wrapAndDeposit flows for native vs erc20 tokens
        if (checkNativeAddress(tokenAddress)) {
            // Check if appropriate balance from user
            const nativeBalance = await signer.getBalance();
            if (nativeBalance < anchorSize) {
                throw new Error("Not enough native token balance");
            }
            if (!(await anchor.setSigner(signer))) {
                throw new Error("Invalid signer for deposit, check the signer's chainID");
            }
            const deposit = await anchor.wrapAndDeposit(zeroAddress, destinationChainId);
            await this.updateLinkedAnchors(anchor);
            return deposit;
        }
        else {
            // Check if appropriate balance from user
            const originTokenInstance = await MintableToken_1.default.tokenFromAddress(tokenAddress, signer);
            const userOriginTokenBalance = await originTokenInstance.getBalance(signerAddress);
            if (userOriginTokenBalance.lt(anchorSize)) {
                throw new Error("Not enough ERC20 balance");
            }
            // Continue with deposit flow for wrapAndDeposit:
            // Approve spending if needed
            let userOriginTokenAllowance = await originTokenInstance.getAllowance(signerAddress, anchor.contract.address);
            if (userOriginTokenAllowance.lt(anchorSize)) {
                const wrapperTokenAddress = await anchor.contract.token();
                const tx = await originTokenInstance.approveSpending(wrapperTokenAddress);
                await tx.wait();
            }
            // return some error code value for deposit note if signer invalid
            if (!(await anchor.setSigner(signer))) {
                throw new Error("Invalid signer for deposit, check the signer's chainID");
            }
            const deposit = await anchor.wrapAndDeposit(originTokenInstance.contract.address, destinationChainId);
            await this.updateLinkedAnchors(anchor);
            return deposit;
        }
    }
    async withdraw(depositInfo, anchorSize, recipient, relayer, signer) {
        // Construct the proof from the origin anchor
        const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
        if (!anchorToProve) {
            throw new Error("Could not find anchor to prove against");
        }
        const merkleProof = anchorToProve.tree.path(depositInfo.index);
        // Submit the proof and arguments on the destination anchor
        const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);
        if (!anchorToWithdraw) {
            throw new Error("Could not find anchor to withdraw from");
        }
        if (!(await anchorToWithdraw.setSigner(signer))) {
            throw new Error("Could not set signer");
        }
        await anchorToWithdraw.bridgedWithdraw(depositInfo, merkleProof, recipient, relayer, '0', '0', '0');
        return true;
    }
    async withdrawAndUnwrap(depositInfo, tokenAddress, anchorSize, recipient, relayer, signer) {
        // Construct the proof from the origin anchor
        const anchorToProve = this.getAnchor(depositInfo.originChainId, anchorSize);
        if (!anchorToProve) {
            throw new Error("Could not find anchor to prove against");
        }
        const merkleProof = anchorToProve.tree.path(depositInfo.index);
        // Submit the proof and arguments on the destination anchor
        const anchorToWithdraw = this.getAnchor(Number(depositInfo.deposit.chainID.toString()), anchorSize);
        if (!anchorToWithdraw) {
            throw new Error("Could not find anchor to withdraw from");
        }
        if (!(await anchorToWithdraw.setSigner(signer))) {
            throw new Error("Could not set signer");
        }
        await anchorToWithdraw.bridgedWithdrawAndUnwrap(depositInfo, merkleProof, recipient, relayer, '0', '0', '0', tokenAddress);
        return true;
    }
}
exports.default = Bridge;
//# sourceMappingURL=Bridge.js.map