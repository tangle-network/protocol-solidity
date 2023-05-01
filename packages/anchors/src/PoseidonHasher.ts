import { ethers } from 'ethers';
import {
  PoseidonHasher as PoseidonHasherContract,
  PoseidonHasher__factory,
  PoseidonT2__factory,
  PoseidonT3__factory,
  PoseidonT4__factory,
  PoseidonT6__factory,
} from '@webb-tools/contracts';
import { Deployer } from './Deployer';
import { id } from 'ethers/lib/utils';
import poseidonContract from 'circomlibjs/src/poseidon_gencontract.js';

export class PoseidonHasher {
  contract: PoseidonHasherContract;

  constructor(contract: PoseidonHasherContract) {
    this.contract = contract;
  }

  public static async create2PoseidonHasher(
    deployer: Deployer,
    salt: string,
    signer: ethers.Signer
  ) {
    const saltHex = id(salt);
    const { contract: poseidonT2Library } = await deployer.deploy(
      PoseidonT2__factory,
      saltHex,
      signer
    );
    const { contract: poseidonT3Library } = await deployer.deploy(
      PoseidonT3__factory,
      saltHex,
      signer
    );
    const { contract: poseidonT4Library } = await deployer.deploy(
      PoseidonT4__factory,
      saltHex,
      signer
    );
    const { contract: poseidonT6Library } = await deployer.deploy(
      PoseidonT6__factory,
      saltHex,
      signer
    );

    const libraryAddresses = {
      ['contracts/hashers/Poseidon.sol:PoseidonT2']: poseidonT2Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonT3Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT4']: poseidonT4Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT6']: poseidonT6Library.address,
    };
    const { contract } = await deployer.deploy(
      PoseidonHasher__factory,
      saltHex,
      signer,
      libraryAddresses
    );

    const hasher = new PoseidonHasher(contract);
    return hasher;
  }

  public static async createPoseidonHasher(signer: ethers.Signer) {
    const poseidonABI = (width: number) => poseidonContract.generateABI(width)
    const poseidonBytecode = (width: number) => poseidonContract.createCode(width)

    const poseidonT2LibraryFactory = new ethers.ContractFactory(poseidonABI(2), poseidonBytecode(2), signer);
    const poseidonT2Library = await poseidonT2LibraryFactory.deploy();
    await poseidonT2Library.deployed();

    const poseidonT3LibraryFactory = new ethers.ContractFactory(poseidonABI(3), poseidonBytecode(3), signer);
    const poseidonT3Library = await poseidonT3LibraryFactory.deploy();
    await poseidonT3Library.deployed();

    const poseidonT4LibraryFactory = new ethers.ContractFactory(poseidonABI(4), poseidonBytecode(4), signer);
    const poseidonT4Library = await poseidonT4LibraryFactory.deploy();
    await poseidonT4Library.deployed();

    const poseidonT6LibraryFactory = new ethers.ContractFactory(poseidonABI(6), poseidonBytecode(6), signer);
    const poseidonT6Library = await poseidonT6LibraryFactory.deploy();
    await poseidonT6Library.deployed();

    const libraryAddresses = {
      ['contracts/hashers/Poseidon.sol:PoseidonT2']: poseidonT2Library.address,
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
