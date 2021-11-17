import { BigNumber, BigNumberish, ContractTransaction, ethers } from "ethers";
import { ERC20PresetMinterPauser__factory } from '../../typechain/factories/ERC20PresetMinterPauser__factory';
import { ERC20PresetMinterPauser } from '../../typechain/ERC20PresetMinterPauser';

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
    creator: ethers.Signer
  ) {
    const factory = new ERC20PresetMinterPauser__factory(creator);
    const token = await factory.deploy(name, symbol);
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

  public async approveSpending(spender: string): Promise<ContractTransaction> {
    return this.contract.approve(spender, '10000000000000000000000000000000000', {
      gasLimit: '0x5B8D80',
    });
  }

  public async mintTokens(address: string, amount: BigNumberish) {
    const tx = await this.contract.mint(address, amount);
    await tx.wait();
    return;
  }

  public grantMinterRole(address: string) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    return this.contract.grantRole(MINTER_ROLE, address);
  }

}

export default MintableToken;
