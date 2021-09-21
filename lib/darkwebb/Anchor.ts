import { ethers } from "ethers";
import { AddressType, UnsignedIntegerType } from "typechain";
import PoseidonHasher from "../Poseidon";
import { rbigint } from "./utils";

interface AnchorDepositInfo {
  chainID: BigInt,
  secret: BigInt,
  nullifier: BigInt,
  commitment?: string,
  nullifierHash?: string,
}

class Anchor {
  contract: ethers.Contract;
  poseidon: PoseidonHasher;

  constructor(
    public provider: ethers.providers.Provider,
    public signer: ethers.Signer,
  ) {
    this.provider = provider;
    this.signer = signer;
    this.poseidon = new PoseidonHasher();
  }

  public deploy(
    verifier: AddressType,
    hasher: AddressType,
    denomination: UnsignedIntegerType,
    merkleTreeHeight: UnsignedIntegerType,
    chainId: UnsignedIntegerType,
    token: AddressType,
    bridge: AddressType,
    admin: AddressType,
    handler: AddressType,
  ) {
    unimplemented();
  }

  public connect(address: AddressType) {
    unimplemented();
  }

  public generateDeposit(destinationChainId: number, secretBytesLen: number, nullifierBytesLen: number): AnchorDepositInfo {
    let deposit: AnchorDepositInfo = {
      chainID: BigInt(destinationChainId),
      secret: rbigint(secretBytesLen),
      nullifier: rbigint(nullifierBytesLen),
    };
  
    deposit.commitment = this.poseidon.hash3([deposit.chainID, deposit.nullifier, deposit.secret]);
    deposit.nullifierHash =   this.poseidon.hash(null, deposit.nullifier, deposit.nullifier);
    return deposit
  }
}

export default Anchor;
function unimplemented() {
  throw new Error("Function not implemented.");
}

