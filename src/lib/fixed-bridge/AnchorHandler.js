"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AnchorHandler__factory_1 = require("../../typechain/factories/AnchorHandler__factory");
class AnchorHandler {
    constructor(contract) {
        this.contract = contract;
    }
    static async createAnchorHandler(bridgeAddress, initResourceIds, initContractAddresses, deployer) {
        const factory = new AnchorHandler__factory_1.AnchorHandler__factory(deployer);
        const contract = await factory.deploy(bridgeAddress, initResourceIds, initContractAddresses);
        await contract.deployed();
        const handler = new AnchorHandler(contract);
        return handler;
    }
    static async connect(handlerAddress, signer) {
        const handlerContract = AnchorHandler__factory_1.AnchorHandler__factory.connect(handlerAddress, signer);
        const handler = new AnchorHandler(handlerContract);
        return handler;
    }
}
exports.default = AnchorHandler;
//# sourceMappingURL=AnchorHandler.js.map