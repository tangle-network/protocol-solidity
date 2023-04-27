import { BytesLike, Signer, ethers } from 'ethers';
import { DeterministicDeployFactory as DeterministicDeployFactoryContract } from '@webb-tools/contracts';
import { ParamType, AbiCoder, getCreate2Address, keccak256 } from 'ethers/lib/utils';

export class Deployer {
  signer: ethers.Signer;
  contract: DeterministicDeployFactoryContract;

  constructor(contract: DeterministicDeployFactoryContract) {
    this.contract = contract;
  }

  get address(): string {
    return this.contract.address;
  }

  public static encode(types: ReadonlyArray<string | ParamType>, values: ReadonlyArray<any>) {
    const abiCoder = new AbiCoder();
    const encodedParams = abiCoder.encode(types, values);
    return encodedParams.slice(2);
  }

  public static create2Address(factoryAddress: string, saltHex: string, initCode: BytesLike) {
    const create2Addr = getCreate2Address(factoryAddress, saltHex, keccak256(initCode));
    return create2Addr;
  }

  public async deploy(
    factory: any,
    saltHex: string,
    signer: Signer,
    libraryAddresses?: any,
    argTypes?: string[],
    args?: any[]
  ) {
    let verifierFactory;
    if (libraryAddresses === undefined) {
      verifierFactory = new factory(signer);
    } else {
      verifierFactory = new factory(libraryAddresses, signer);
    }
    const verifierBytecode = verifierFactory['bytecode'];
    let initCode: string;
    if (argTypes && args) {
      const encodedParams = Deployer.encode(argTypes, args);
      initCode = verifierBytecode + encodedParams;
    } else {
      initCode = verifierBytecode + Deployer.encode([], []);
    }
    const verifierCreate2Addr = Deployer.create2Address(this.contract.address, saltHex, initCode);
    const tx = await this.contract.deploy(initCode, saltHex);
    const receipt = await tx.wait();
    if (!receipt.events) {
      throw new Error('no events in receipt');
    }

    const deployEventIdx = receipt.events.length - 1;
    const deployEvent = receipt.events[deployEventIdx];
    if (deployEvent.args?.[0] !== verifierCreate2Addr) {
      throw new Error('create2 address mismatch');
    }

    const contract = await verifierFactory.attach(deployEvent.args[0]);
    return { contract, receipt };
  }

  public async deployInitCode(saltHex: string, signer: Signer, initCode: any) {
    const verifierCreate2Addr = Deployer.create2Address(this.contract.address, saltHex, initCode);
    const tx = await this.contract.deploy(initCode, saltHex);
    const receipt = await tx.wait();

    if (!receipt.events) {
      throw new Error('no events in receipt');
    }

    const deployEventIdx = receipt.events.length - 1;
    const deployEvent = receipt.events[deployEventIdx];
    if (deployEvent.args?.[0] !== verifierCreate2Addr) {
      throw new Error('create2 address mismatch');
    }
    let address = deployEvent.args[0];
    return { address };
  }
}
export default Deployer;
