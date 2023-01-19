import { randomBN, toBuffer } from "@webb-tools/sdk-core";
import { BigNumber } from "ethers";
import { poseidon } from 'circomlibjs';
import { Fp, Fr, Point, signEdDSA, verifyEdDSA, EdDSA } from "@zkopru/babyjubjub";
const { PublicKey, PrivateKey } = require('babyjubjub');
import { MaspKey } from "./MaspKey";

export class MaspUtxo {
    // Partial Commitment
    chainID: BigNumber;
    maspKey: MaspKey;
    blinding: BigNumber;
    // Commitment
    assetID: BigNumber;
    tokenID: BigNumber;
    amount: BigNumber;
    index: BigNumber;

    constructor(chainID: BigNumber, maspKey: MaspKey, assetID: BigNumber, tokenID: BigNumber, amount: BigNumber) {
        this.chainID = chainID;
        this.maspKey = maspKey;
        this.blinding = randomBN(31);
        this.assetID = assetID;
        this.tokenID = tokenID;
        this.amount = amount;
        this.index = BigNumber.from(-1);
    };

    public getPartialCommitment(): BigNumber {
        return BigNumber.from(poseidon([ this.chainID, this.maspKey.getPublicKey().x, this.maspKey.getPublicKey().y, this.blinding ]));
    }

    // TODO: Fill in babyjubjub encrypt function 
    public encrypt () {
        return "";
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
       return BigNumber.from(poseidon([this.maspKey.getPublicKey().x, this.maspKey.getPublicKey().y, commitment, merklePath]));

    }

    public setIndex(index: BigNumber) {
        this.index = index;
    }
}