"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
const ERC20PresetMinterPauser__factory_1 = require("../../typechain/factories/ERC20PresetMinterPauser__factory");
class MintableToken {
    constructor(contract, name, symbol, signer) {
        this.contract = contract;
        this.signer = signer;
        this.name = name;
        this.symbol = symbol;
    }
    static async createToken(name, symbol, creator) {
        const factory = new ERC20PresetMinterPauser__factory_1.ERC20PresetMinterPauser__factory(creator);
        const token = await factory.deploy(name, symbol);
        await token.deployed();
        return new MintableToken(token, name, symbol, creator);
    }
    static async tokenFromAddress(contract, signer) {
        const token = ERC20PresetMinterPauser__factory_1.ERC20PresetMinterPauser__factory.connect(contract, signer);
        const name = await token.name();
        const symbol = await token.symbol();
        return new MintableToken(token, name, symbol, signer);
    }
    getAllowance(owner, spender) {
        return this.contract.allowance(owner, spender);
    }
    getBalance(address) {
        return this.contract.balanceOf(address);
    }
    async approveSpending(spender) {
        return this.contract.approve(spender, '10000000000000000000000000000000000', {
            gasLimit: '0x5B8D80',
        });
    }
    async mintTokens(address, amount) {
        const tx = await this.contract.mint(address, amount);
        await tx.wait();
        return;
    }
    grantMinterRole(address) {
        const MINTER_ROLE = ethers_1.ethers.utils.keccak256(ethers_1.ethers.utils.toUtf8Bytes('MINTER_ROLE'));
        return this.contract.grantRole(MINTER_ROLE, address);
    }
}
exports.default = MintableToken;
//# sourceMappingURL=MintableToken.js.map