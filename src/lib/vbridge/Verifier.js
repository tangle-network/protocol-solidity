"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VAnchorVerifier__factory_1 = require("../../typechain/factories/VAnchorVerifier__factory");
const Verifier22__factory_1 = require("../../typechain/factories/Verifier22__factory");
// This convenience wrapper class is used in tests -
// It represents a deployed contract throughout its life (e.g. maintains all verifiers)
class Verifier {
    constructor(contract, signer) {
        this.signer = signer;
        this.contract = contract;
    }
    // Deploys a Verifier contract and all auxiliary verifiers used by this verifier
    static async createVerifier(signer) {
        const v22Factory = new Verifier22__factory_1.Verifier22__factory(signer);
        const v22 = await v22Factory.deploy();
        await v22.deployed();
        const v82Factory = new Verifier22__factory_1.Verifier22__factory(signer);
        const v82 = await v82Factory.deploy();
        await v82.deployed();
        const v216Factory = new Verifier22__factory_1.Verifier22__factory(signer);
        const v216 = await v216Factory.deploy();
        await v216.deployed();
        const v816Factory = new Verifier22__factory_1.Verifier22__factory(signer);
        const v816 = await v816Factory.deploy();
        await v816.deployed();
        const factory = new VAnchorVerifier__factory_1.VAnchorVerifier__factory(signer);
        const verifier = await factory.deploy(v22.address, v216.address, v82.address, v816.address);
        await verifier.deployed();
        const createdVerifier = new Verifier(verifier, signer);
        return createdVerifier;
    }
}
exports.default = Verifier;
//# sourceMappingURL=Verifier.js.map