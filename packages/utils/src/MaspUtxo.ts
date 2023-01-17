import { Keypair, randomBN, toBuffer } from "@webb-tools/sdk-core";
import { BigNumber } from "ethers";
import { poseidon } from 'circomlibjs';

export class MaspUtxo {
    // Partial Commitment
    chainID: BigNumber;
    keypair: Keypair;
    blinding: BigNumber;
    // Commitment
    assetID: BigNumber;
    tokenID: BigNumber;
    amount: BigNumber;
    index: BigNumber;

    constructor(chainID: BigNumber, assetID: BigNumber, tokenID: BigNumber, amount: BigNumber) {
        this.chainID = chainID;
        this.blinding = randomBN(31);
        this.assetID = assetID;
        this.tokenID = tokenID;
        this.amount = amount;
        this.keypair = new Keypair();
        this.index = BigNumber.from(-1);
    };

    public getPartialCommitment(): BigNumber {
        return BigNumber.from(poseidon([ this.chainID, this.keypair.getPubKey(), this.blinding ]));
    }

    public encrypt () {
        if (!this.keypair) {
          throw new Error('Must set a keypair to encrypt the MASP utxo');
        }
    
        const bytes = Buffer.concat([
          toBuffer(`0x${this.chainID}`, 8),
          toBuffer(`0x${this.amount}`, 31),
          toBuffer(`0x${this.blinding}`, 31),
          toBuffer(`0x${this.assetID}`, 8),
          toBuffer(`0x${this.tokenID}`, 8)
        ]);
    
        return this.keypair.encrypt(bytes);
    }

    public getCommitment(): BigNumber {
        const partialCommitment = this.getPartialCommitment();
        return BigNumber.from(poseidon([this.assetID, this.tokenID, this.amount, partialCommitment]));
    }

    public getNullifier(): BigNumber {
       if (this.index < BigNumber.from(0)) {
        throw new Error("Cannot compute nullifier, UTXO has not been inserted into tree");
       }

       // nullifier = Poseidon(commitment, merklePath, Poseidon(privKey, commitment, merklePath))
       const commitment = this.getCommitment();
       const merklePath = this.index;
       const signature = BigNumber.from(poseidon([this.keypair.privkey, commitment, merklePath]));
       return BigNumber.from(poseidon([commitment, merklePath, signature]));

    }

    public setIndex(index: BigNumber) {
        this.index = index;
    }
}