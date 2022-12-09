import { ethers } from 'ethers';
import {
  PoseidonHasher as PoseidonHasherContract,
  DeterministicDeployFactory as DeterministicDeployFactoryContract,
  PoseidonHasher__factory,
  PoseidonT3__factory,
  PoseidonT4__factory,
  PoseidonT6__factory,
} from '@webb-tools/contracts';

const encoder = (types, values) => {
    const abiCoder = ethers.utils.defaultAbiCoder;
    const encodedParams = abiCoder.encode(types, values);
    return encodedParams.slice(2);
};

const create2Address = (factoryAddress, saltHex, initCode) => {
    const create2Addr = ethers.utils.getCreate2Address(factoryAddress, saltHex, ethers.utils.keccak256(initCode));
    return create2Addr;

}

export class PoseidonHasher {
  contract: PoseidonHasherContract;

  constructor(contract: PoseidonHasherContract) {
    this.contract = contract;
  }
  public static async create2PoseidonHasher(deployer: DeterministicDeployFactoryContract, salt: string, signer: ethers.Signer) {
    console.log('init')
    const saltHex = ethers.utils.id(salt)
    const poseidonT3LibraryFactory = new PoseidonT3__factory(signer);
    const PoseidonT3Bytecode = poseidonT3LibraryFactory['bytecode']
    const PoseidonT3InitCode = PoseidonT3Bytecode + encoder([], [])
    const poseidonT3create2Addr = create2Address(deployer.address, saltHex, PoseidonT3InitCode)
    const poseidonT3tx = await deployer.deploy(PoseidonT3InitCode, saltHex);
    const poseidonT3receipt = await poseidonT3tx.wait()
    const poseidonT3Library = await poseidonT3LibraryFactory.attach(poseidonT3receipt.events[0].args[0]);
    // console.log('poseidonT3 deployed to ', poseidonT3Library.address)

    const poseidonT4LibraryFactory = new PoseidonT4__factory(signer);
    const PoseidonT4Bytecode = poseidonT4LibraryFactory['bytecode']
    const PoseidonT4InitCode = PoseidonT4Bytecode + encoder([], [])
    const poseidonT4create2Addr = create2Address(deployer.address, saltHex, PoseidonT4InitCode)
    const poseidonT4tx = await deployer.deploy(PoseidonT4InitCode, saltHex);
    const poseidonT4receipt = await poseidonT4tx.wait()
    const poseidonT4Library = await poseidonT4LibraryFactory.attach(poseidonT4receipt.events[0].args[0]);
    // console.log('poseidonT4 deployed to ', poseidonT4Library.address)

    const poseidonT6LibraryFactory = new PoseidonT6__factory(signer);
    const PoseidonT6Bytecode = poseidonT6LibraryFactory['bytecode']
    const PoseidonT6InitCode = PoseidonT6Bytecode + encoder([], [])
    const poseidonT6create2Addr = create2Address(deployer.address, saltHex, PoseidonT6InitCode)
    const poseidonT6tx = await deployer.deploy(PoseidonT6InitCode, saltHex);
    const poseidonT6receipt = await poseidonT6tx.wait()
    const poseidonT6Library = await poseidonT6LibraryFactory.attach(poseidonT6receipt.events[0].args[0]);
    // console.log('poseidonT6 deployed to ', poseidonT6Library.address)

    const libraryAddresses = {
      ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonT3Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT4']: poseidonT4Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT6']: poseidonT6Library.address,
    };
    // const contract = await factory.deploy();
    // await contract.deployed();
    const factory = new PoseidonHasher__factory(libraryAddresses, signer);
    const factoryBytecode = factory['bytecode']
    const factoryInitCode = factoryBytecode + encoder([], [])
    const factoryCreate2Addr = create2Address(deployer.address, saltHex, PoseidonT6InitCode)
    const factoryTx = await deployer.deploy(factoryInitCode, saltHex);
    const factoryReceipt = await factoryTx.wait()
    const contract = await factory.attach(factoryReceipt.events[0].args[0]);
    // console.log('poseidonT6 deployed to ', poseidonT6Library.address)
    //
    // console.log('contract deployed to ', contract.address)

    const hasher = new PoseidonHasher(contract);
    return hasher;
  }

  public static async createPoseidonHasher(signer: ethers.Signer) {
    const poseidonT3LibraryFactory = new PoseidonT3__factory(signer);
    const poseidonT3Library = await poseidonT3LibraryFactory.deploy();
    await poseidonT3Library.deployed();

    const poseidonT4LibraryFactory = new PoseidonT4__factory(signer);
    const poseidonT4Library = await poseidonT4LibraryFactory.deploy();
    await poseidonT4Library.deployed();

    const poseidonT6LibraryFactory = new PoseidonT6__factory(signer);
    const poseidonT6Library = await poseidonT6LibraryFactory.deploy();
    await poseidonT6Library.deployed();

    const libraryAddresses = {
      ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonT3Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT4']: poseidonT4Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT6']: poseidonT6Library.address,
    };
    const factory = new PoseidonHasher__factory(libraryAddresses, signer);

    const contract = await factory.deploy();
    await contract.deployed();

    const hasher = new PoseidonHasher(contract);
    return hasher;
  }

  public static async connect(hasherAddress: string, signer: ethers.Signer) {
    const hasherContract = PoseidonHasher__factory.connect(hasherAddress, signer);
    const hasher = new PoseidonHasher(hasherContract);
    return hasher;
  }
}
