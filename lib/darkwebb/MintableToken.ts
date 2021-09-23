import { BigNumber, BigNumberish, ContractTransaction, ethers } from "ethers";
import { ERC20PresetMinterPauser__factory } from '../../typechain/factories/ERC20PresetMinterPauser__factory';
import { ERC20PresetMinterPauser } from '../../typechain/ERC20PresetMinterPauser';

class MintableToken {
  contract: ERC20PresetMinterPauser;
  signer: ethers.Signer;

  constructor(
    contract: ERC20PresetMinterPauser,
    signer: ethers.Signer,
  ) {
    this.contract = contract;
    this.signer = signer;
  }

  public static tokenFromAddress(
    contract: string,
    signer: ethers.Signer,
  ): MintableToken {
    const token = ERC20PresetMinterPauser__factory.connect(contract, signer);
    return new MintableToken(token, signer);
  }

  public getAllowance(owner: string, spender: string): Promise<BigNumber> {
    return this.contract.allowance(owner, spender);
  }

  public getBalance(address: string): Promise<BigNumber> {
    return this.contract.balanceOf(address);
  }

  public approveSpending(spender: string): Promise<ContractTransaction> {
    return this.contract.approve(spender, '10000000000000000000000000000000000', {
      from: this.signer.getAddress(),
      gasLimit: '0x5B8D80',
    });
  }

  public mintTokens(address: string, amount: BigNumberish) {
    return this.contract.mint(address, amount);
  }

  public grantMinterRole(address: string) {
    return this.contract.grantRole('MINTER', address);
  }

}

export default MintableToken;
