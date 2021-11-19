"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AnchorProxy__factory_1 = require("../../typechain/factories/AnchorProxy__factory");
const Anchor_1 = __importDefault(require("./Anchor"));
const utils_1 = require("../utils");
var InstanceState;
(function (InstanceState) {
    InstanceState[InstanceState["ENABLED"] = 0] = "ENABLED";
    InstanceState[InstanceState["DISABLED"] = 1] = "DISABLED";
    InstanceState[InstanceState["MINEABLE"] = 2] = "MINEABLE";
})(InstanceState || (InstanceState = {}));
class AnchorProxy {
    constructor(contract, signer, anchorList) {
        this.contract = contract;
        this.signer = signer;
        this.anchorProxyMap = new Map();
        for (let i = 0; i < anchorList.length; i++) {
            this.insertAnchor(anchorList[i]);
        }
    }
    //need to fix this
    static async createAnchorProxy(_anchorTrees, _governance, _anchorList, deployer) {
        const factory = new AnchorProxy__factory_1.AnchorProxy__factory(deployer);
        const instances = _anchorList.map((a) => {
            return {
                addr: a.contract.address,
                instance: {
                    token: a.token || '',
                    state: InstanceState.DISABLED,
                },
            };
        });
        const contract = await factory.deploy(_anchorTrees, _governance, instances); //edit this
        await contract.deployed();
        const handler = new AnchorProxy(contract, deployer, _anchorList);
        return handler;
    }
    async deposit(anchorAddr, destChainId, encryptedNote) {
        const deposit = Anchor_1.default.generateDeposit(destChainId);
        let _encryptedNote = '0x000000';
        if (encryptedNote) {
            const _encryptedNote = encryptedNote;
        }
        const tx = await this.contract.deposit(anchorAddr, (0, utils_1.toFixedHex)(deposit.commitment), _encryptedNote, { gasLimit: '0x5B8D80' });
        await tx.wait();
        const anchor = this.anchorProxyMap.get(anchorAddr);
        if (!anchor) {
            throw new Error('Anchor not found');
        }
        const index = anchor.tree.insert(deposit.commitment);
        return { deposit, index };
    }
    async withdraw(anchorAddr, deposit, index, recipient, relayer, fee, refreshCommitment) {
        const anchor = this.anchorProxyMap.get(anchorAddr);
        if (!anchor) {
            throw new Error('Anchor not found');
        }
        const { args, input, proofEncoded, publicInputs } = await anchor.setupWithdraw(deposit, index, recipient, relayer, fee, refreshCommitment);
        //@ts-ignore
        let tx = await this.contract.withdraw(anchorAddr, `0x${proofEncoded}`, publicInputs, { gasLimit: '0x5B8D80' });
        const receipt = await tx.wait();
        if (args[2] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
            anchor.tree.insert(input.refreshCommitment);
            const filter = anchor.contract.filters.Refresh(null, null, null);
            const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
            return events[0];
        }
        else {
            const filter = anchor.contract.filters.Withdrawal(null, null, relayer, null);
            const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
            return events[0];
        }
    }
    insertAnchor(anchor) {
        this.anchorProxyMap.set(anchor.contract.address, anchor);
    }
}
exports.default = AnchorProxy;
//# sourceMappingURL=AnchorProxy.js.map