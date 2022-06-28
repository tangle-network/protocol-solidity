import { BigNumber, BigNumberish, ContractTransaction, ethers } from "ethers";
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
  ) {
    const factory = new ERC20PresetMinterPauser__factory(creator);
    const deployTx = factory.getDeployTransaction(name, symbol).data;
    const gasEstimate = factory.signer.estimateGas({ data: deployTx });
    const token = await factory.deploy(name, symbol, {
      gasLimit: gasEstimate,
    });
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
    const gasEstimate = await this.contract.estimateGas.approve(spender, '10000000000000000000000000000000000');
    return this.contract.approve(spender, '10000000000000000000000000000000000', {
      gasLimit: gasEstimate,
    });
  }

  public async mintTokens(address: string, amount: BigNumberish) {
    const gasEstimate = await this.contract.estimateGas.mint(address, amount);
    const tx = await this.contract.mint(address, amount, {
      gasLimit: gasEstimate,
    });
    await tx.wait();
    return;
  }

  public async grantMinterRole(address: string) {
    const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
    const gasEstimate = await this.contract.estimateGas.grantRole(MINTER_ROLE, address);
    return this.contract.grantRole(MINTER_ROLE, address, {
      gasLimit: gasEstimate,
    });
  }
}

export { MintableToken };
