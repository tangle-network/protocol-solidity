"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ERC20__factory_1 = require("../../typechain/factories/ERC20__factory");
class ERC20 {
    constructor(contract) {
        this.contract = contract;
    }
    static async createERC20(name, symbol, deployer) {
        const factory = new ERC20__factory_1.ERC20__factory(deployer);
        const contract = await factory.deploy(name, symbol);
        await contract.deployed();
        const handler = new ERC20(contract);
        return handler;
    }
}
exports.default = ERC20;
//# sourceMappingURL=ERC20.js.map