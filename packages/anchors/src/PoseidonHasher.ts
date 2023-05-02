import { ethers } from 'ethers';
import {
  PoseidonHasher as PoseidonHasherContract,
  PoseidonHasher__factory,
  PoseidonT2__factory,
  PoseidonT3__factory,
  PoseidonT4__factory,
  PoseidonT5__factory,
  PoseidonT6__factory,
} from '@webb-tools/contracts';
import { Deployer } from '@webb-tools/create2-utils';
import { poseidon_gencontract as poseidonContract } from 'circomlibjs';

const poseidonABI = (w: number) => poseidonContract.generateABI(w);
const poseidonBytecode = (w: number) => poseidonContract.createCode(w);

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
    const saltHex = ethers.utils.id(salt);
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
    const { contract: poseidonT5Library } = await deployer.deploy(
      PoseidonT5__factory,
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
      ['contracts/hashers/Poseidon.sol:PoseidonT5']: poseidonT5Library.address,
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
    const poseidonT2LibraryFactory = new ethers.ContractFactory(
      poseidonABI(1),
      poseidonBytecode(1),
      signer
    );
    const poseidonT2Library = await poseidonT2LibraryFactory.deploy();
    await poseidonT2Library.deployed();

    const poseidonT3LibraryFactory = new ethers.ContractFactory(
      poseidonABI(2),
      poseidonBytecode(2),
      signer
    );
    const poseidonT3Library = await poseidonT3LibraryFactory.deploy();
    await poseidonT3Library.deployed();

    const poseidonT4LibraryFactory = new ethers.ContractFactory(
      poseidonABI(3),
      poseidonBytecode(3),
      signer
    );
    const poseidonT4Library = await poseidonT4LibraryFactory.deploy();
    await poseidonT4Library.deployed();

    const poseidonT5LibraryFactory = new ethers.ContractFactory(
      poseidonABI(4),
      poseidonBytecode(4),
      signer
    );
    const poseidonT5Library = await poseidonT5LibraryFactory.deploy();
    await poseidonT5Library.deployed();

    const poseidonT6LibraryFactory = new ethers.ContractFactory(
      poseidonABI(5),
      poseidonBytecode(5),
      signer
    );
    const poseidonT6Library = await poseidonT6LibraryFactory.deploy();
    await poseidonT6Library.deployed();

    const libraryAddresses = {
      ['contracts/hashers/Poseidon.sol:PoseidonT2']: poseidonT2Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT3']: poseidonT3Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT4']: poseidonT4Library.address,
      ['contracts/hashers/Poseidon.sol:PoseidonT5']: poseidonT5Library.address,
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
