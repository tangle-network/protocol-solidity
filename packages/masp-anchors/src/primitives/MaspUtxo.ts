import { randomBN } from '@webb-tools/sdk-core';
import { BigNumber } from 'ethers';
import { poseidon, babyjub } from 'circomlibjs';
import { MaspKey } from './MaspKey';
import { raw2prv } from './babyjubjubUtils';
import { encrypt, decrypt } from 'chacha20';
import { randomBytes } from 'ethers/lib/utils';
import { hexToU8a } from '@webb-tools/utils';

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

  constructor(
    chainID: BigNumber,
    maspKey: MaspKey,
    assetID: BigNumber,
    tokenID: BigNumber,
    amount: BigNumber
  ) {
    this.chainID = chainID;
    this.maspKey = maspKey;
    this.blinding = randomBN(31);
    this.assetID = assetID;
    this.tokenID = tokenID;
    this.amount = amount;
    this.index = BigNumber.from(-1);
  }

  public getInnerPartialCommitment(): BigNumber {
    return BigNumber.from(poseidon([this.blinding]));
  }

  public getPartialCommitment(): BigNumber {
    return BigNumber.from(
      poseidon([
        this.chainID,
        this.maspKey.getPublicKey()[0].toString(),
        this.maspKey.getPublicKey()[1].toString(),
        this.getInnerPartialCommitment().toString(),
      ])
    );
  }

  public encrypt(maspKey: MaspKey) {
    // Generate random ephemeral secret key
    const esk = raw2prv(randomBytes(32).toString()).toString();
    // Derive shared symmetric key
    const sharedKey = babyjub.packPoint(babyjub.mulPointEscalar(maspKey.getPublicKey(), esk));
    // Make secret to encrypt
    const u8aAssetID = hexToU8a(this.assetID.toHexString(), 256);
    const u8aTokenID = hexToU8a(this.tokenID.toHexString(), 256);
    const u8aAmount = hexToU8a(this.amount.toHexString(), 256);
    const u8aChainID = hexToU8a(this.chainID.toHexString(), 64);
    const u8aBlinding = hexToU8a(this.blinding.toHexString(), 256);
    const secret = [
      Buffer.from(u8aAssetID),
      Buffer.from(u8aTokenID),
      Buffer.from(u8aAmount),
      Buffer.from(u8aChainID),
      babyjub.packPoint(maspKey.getPublicKey()),
      Buffer.from(u8aBlinding),
    ];
    // Create chacha20 ciphertext
    const ciphertext = encrypt(sharedKey, 0, Buffer.concat(secret));
    // Return Concatenation ciphertext with ephemeral public key
    // Total Bytes 32 epk + 32 assetID + 32 tokenID + 32 amount + 8 chainID + 32 pubkey + 32 blinding = 200 bytes
    // TODO: Num of bytes can likely be reduced.
    const encryptedMemo = [
      babyjub.packPoint(babyjub.mulPointEscalar(babyjub.Base8, esk)),
      ciphertext,
    ];
    return Buffer.concat(encryptedMemo);
  }

  public decrypt(maspKey: MaspKey, commitment: BigNumber, memo: Buffer) {
    const epk = babyjub.unpackPoint(memo.subarray(0, 32));
    const sharedKey = babyjub.packPoint(
      babyjub.mulPointEscalar(epk, maspKey.getViewingKey().toString())
    );
    const decrypted = decrypt(sharedKey, 0, memo.subarray(32, 200));
    const assetID = BigNumber.from('0x' + decrypted.subarray(0, 32).toString('hex'));
    const tokenID = BigNumber.from('0x' + decrypted.subarray(32, 64).toString('hex'));
    const amount = BigNumber.from('0x' + decrypted.subarray(64, 96).toString('hex'));
    const chainID = BigNumber.from('0x' + decrypted.subarray(96, 104).toString('hex'));
    const pubKey = babyjub.unpackPoint(decrypted.subarray(104, 136));
    if (pubKey == null) {
      return undefined;
    }
    const blinding = BigNumber.from('0x' + decrypted.subarray(136, 168).toString('hex'));

    const calculatedInnerPartialCommitment = BigNumber.from(poseidon([blinding]));

    const calculatedPartialCommitment = BigNumber.from(
      poseidon([
        chainID,
        pubKey[0].toString(),
        pubKey[1].toString(),
        calculatedInnerPartialCommitment.toString(),
      ])
    );

    const calculatedCommitment = BigNumber.from(
      poseidon([assetID, tokenID, amount, calculatedPartialCommitment.toString()])
    );

    if (calculatedCommitment.eq(commitment)) {
      return {
        assetID: assetID,
        tokenID: tokenID,
        amount: amount,
        publicKey: pubKey,
        chainID: chainID,
        blinding: blinding,
      };
    } else {
      return undefined;
    }
  }

  public getCommitment(): BigNumber {
    const partialCommitment = this.getPartialCommitment();
    return BigNumber.from(poseidon([this.assetID, this.tokenID, this.amount, partialCommitment]));
  }

  public getNullifier(): BigNumber {
    if (this.index < BigNumber.from(0)) {
      throw new Error('Cannot compute nullifier, UTXO has not been inserted into tree');
    }

    // nullifier = Poseidon(commitment, merklePath, Poseidon(privKey, commitment, merklePath))
    const commitment = this.getCommitment();
    const merklePath = this.index;
    return BigNumber.from(poseidon([commitment, merklePath]));
  }

  public forceSetIndex(index: BigNumber) {
    this.index = index;
  }
}
