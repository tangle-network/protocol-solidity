import { randomBN } from '@webb-tools/sdk-core';
import { BigNumber, BigNumberish } from 'ethers';
const { poseidon, babyjub } = require('circomlibjs');
const { Scalar } = require('ffjavascript');
import createBlakeHash from 'blake-hash';

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

    this.hashed_sk = this.raw2prv(this.sk);

    //get PublicKey object from privateKey object
    this.ak = this.prv2pub(this.hashed_sk);
    const ak_poseidon_hash = poseidon([this.ak[0], this.ak[1]]);
    const ak_poseidon_hash_bit_length = Scalar.bitLength(ak_poseidon_hash);
    let ak_poseidon_hash_shifted = ak_poseidon_hash;
    if (ak_poseidon_hash_bit_length > 253) {
      ak_poseidon_hash_shifted = Scalar.shr(ak_poseidon_hash, ak_poseidon_hash_bit_length - 253);
    }
    this.vk = babyjub.F.e(ak_poseidon_hash_shifted.toString());
    this.pk = babyjub.mulPointEscalar(babyjub.Base8, this.vk.toString());
  }

  public pruneBuffer(buff) {
    buff[0] = buff[0] & 0xf8;
    buff[31] = buff[31] & 0x7f;
    buff[31] = buff[31] | 0x40;
    return buff;
  }

  public raw2prv(raw) {
    const sBuff = this.pruneBuffer(createBlakeHash('blake512').update(Buffer.from(raw)).digest());
    let s = Scalar.fromRprLE(sBuff, 0, 32);
    return babyjub.F.e(Scalar.shr(s, 3));
  }

  public prv2pub(prv) {
    const A = babyjub.mulPointEscalar(babyjub.Base8, prv.toString());
    return A;
  }

  public randomize_sk_ak() {
    let alpha = this.raw2prv(randomBN(32).toString());
    let sk_alpha = BigNumber.from(this.hashed_sk.toString()).mul(alpha.toString()).toString();
    let ak_alpha = babyjub.mulPointEscalar(babyjub.Base8, sk_alpha);
    return { alpha, sk_alpha, ak_alpha };
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
