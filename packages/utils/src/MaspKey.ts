import { randomBN } from '@webb-tools/sdk-core';
import { BigNumber, BigNumberish } from 'ethers';
const { poseidon, babyjub } = require('circomlibjs');
const { Scalar } = require('ffjavascript');
import { raw2prv, prv2pub } from './babyjubjubUtils';

// sk -> ak -> vk -> pk
export class MaspKey {
  sk;
  hashed_sk;
  ak;
  vk;
  pk;

  constructor(sk?: BigNumberish) {
    if (typeof sk !== undefined) {
      this.sk = randomBN(32).toString();
    } else {
      this.sk = sk.toString();
    }

    this.hashed_sk = raw2prv(this.sk);

    //get PublicKey object from privateKey object
    this.ak = prv2pub(this.hashed_sk);
    const ak_poseidon_hash = poseidon([this.ak[0], this.ak[1]]);
    const ak_poseidon_hash_bit_length = Scalar.bitLength(ak_poseidon_hash);
    let ak_poseidon_hash_shifted = ak_poseidon_hash;
    if (ak_poseidon_hash_bit_length > 253) {
      ak_poseidon_hash_shifted = Scalar.shr(ak_poseidon_hash, ak_poseidon_hash_bit_length - 253);
    }
    this.vk = babyjub.F.e(ak_poseidon_hash_shifted.toString());
    this.pk = babyjub.mulPointEscalar(babyjub.Base8, this.vk.toString());
  }

  public getProofAuthorizingKey() {
    return this.ak;
  }

  public getViewingKey() {
    return this.vk;
  }

  public getPublicKey() {
    return this.pk;
  }
}
