import { randomBN } from "@webb-tools/sdk-core";
import { BigNumber, BigNumberish } from "ethers";
import { Fp, Fr, Point, signEdDSA, verifyEdDSA, EdDSA } from "@zkopru/babyjubjub";
const { poseidon } = require('circomlibjs');

// sk -> ak -> vk -> pk
export class MaspKey {
    private sk: Fp;
    ak: Point;
    vk: Fp;
    pk: Point;

    constructor(sk?: BigNumberish) {
        if (typeof sk !== undefined) {
            this.sk = Fp.from(randomBN(31).toString());
        } else {
            this.sk = Fp.from(sk.toString());
        }
        
        //get PublicKey object from privateKey object
        this.ak = Point.fromPrivKey(this.sk.toString());
        this.vk = Fp.from(BigNumber.from(poseidon([this.ak.x, this.ak.y])).toString()); 
        this.pk = Point.fromPrivKey(this.vk.toString());
    }

    public randomize_sk_ak() {
        let alpha = randomBN(31).toString();
        let sk_alpha = this.sk.mul(alpha);
        let ak_alpha = Point.fromPrivKey(sk_alpha.toString());
        return { alpha, sk_alpha, ak_alpha } ;
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