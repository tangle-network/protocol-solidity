import { randomBN } from "@webb-tools/sdk-core";
import { BigNumber } from "ethers";
const { PublicKey, PrivateKey } = require('babyjubjub');
const { poseidon } = require('circomlibjs');

// sk -> ak -> vk -> pk
export class MaspKey {
    sk;
    ak;
    vk;
    pk;

    constructor() {
        this.sk = new PrivateKey(PrivateKey.getRandObj().field);
        //get PublicKey object from privateKey object
        this.ak = PublicKey.fromPrivate(this.sk);
        this.vk = new PrivateKey(BigNumber.from(poseidon([this.ak.p.x.n, this.ak.p.y.n]))); 
        this.pk = PublicKey.fromPrivate(this.vk);
    }

    public randomize_sk_ak() {
        let alpha = randomBN(31);
        let sk_alpha = new PrivateKey(alpha.mul(this.sk));
        let ak_alpha = PublicKey.fromPrivate(sk_alpha);
        return { alpha, sk_alpha, ak_alpha } ;
    }

    public getSecretKey() {
        return this.sk;
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