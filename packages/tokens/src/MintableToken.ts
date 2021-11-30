import { BigNumber, BigNumberish, ContractTransaction, ethers } from "ethers";
import { Overrides } from "@webb-tools/utils";
import { ERC20PresetMinterPauser, ERC20PresetMinterPauser__factory } from '@webb-tools/contracts';

class MintableToken {
  contract: ERC20PresetMinterPauser;
  signer: ethers.Signer;
  name: string;
  symbol: string;

  constructor(
    contract: ERC20PresetMinterPauser,
    name: string,
    symbol: string,
    signer: ethers.Signer,
  ) {
    this.contract = contract;
    this.signer = signer;
    this.name = name;
    this.symbol = symbol;
  }

  public static async createToken(
    name: string,
    symbol: string,
    creator: ethers.Signer,
    overrides?: Overrides,
  ) {
    const factory = new ERC20PresetMinterPauser__factory(creator);
    const token = await factory.deploy(name, symbol, overrides);
    await token.deployed();
    return new MintableToken(token, name, symbol, creator);
  }

  public static async tokenFromAddress(
    contract: string,
    signer: ethers.Signer,
  ): Promise<MintableToken> {
    const token = ERC20PresetMinterPauser__factory.connect(contract, signer);
    const name = await token.name();
    const symbol = await token.symbol();
    return new MintableToken(token, name, symbol, signer);
  }

  public getAllowance(owner: string, spender: string): Promise<BigNumber> {
    return this.contract.allowance(owner, spender);
  }

  public getBalance(address: string): Promise<BigNumber> {
    return this.contract.balanceOf(address);
  }

  public async approveSpending(spender: string, overrides?: Overrides): Promise<ContractTransaction> {
    return this.contract.approve(spender, '10000000000000000000000000000000000', overrides);
  }

  public async mintTokens(address: string, amount: BigNumberish, overrides?: Overrides) {
    const tx = await this.contract.mint(address, amount, overrides);
    await tx.wait();
    return;
  }

  public grantMinterRole(address: string, overrides?: Overrides) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    return this.contract.grantRole(MINTER_ROLE, address, overrides);
  }
}

export { MintableToken };
