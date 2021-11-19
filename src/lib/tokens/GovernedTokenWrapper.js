"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const GovernedTokenWrapper__factory_1 = require("../../typechain/factories/GovernedTokenWrapper__factory");
class GovernedTokenWrapper {
    constructor(contract) {
        this.contract = contract;
    }
    static async createGovernedTokenWrapper(name, symbol, governor, limit, isNativeAllowed, deployer) {
        const factory = new GovernedTokenWrapper__factory_1.GovernedTokenWrapper__factory(deployer);
        const contract = await factory.deploy(name, symbol, governor, limit, isNativeAllowed);
        await contract.deployed();
        const handler = new GovernedTokenWrapper(contract);
        return handler;
    }
    static connect(address, signer) {
        const contract = GovernedTokenWrapper__factory_1.GovernedTokenWrapper__factory.connect(address, signer);
        const tokenWrapper = new GovernedTokenWrapper(contract);
        return tokenWrapper;
    }
    grantMinterRole(address) {
        const MINTER_ROLE = ethers_1.ethers.utils.keccak256(ethers_1.ethers.utils.toUtf8Bytes('MINTER_ROLE'));
        return this.contract.grantRole(MINTER_ROLE, address);
    }
}
exports.default = GovernedTokenWrapper;
//# sourceMappingURL=GovernedTokenWrapper.js.map