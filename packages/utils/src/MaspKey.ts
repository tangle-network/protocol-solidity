import { randomBN } from "@webb-tools/sdk-core";
import { BigNumber, BigNumberish } from "ethers";
const { poseidon, babyjub } = require('circomlibjs');

// sk -> ak -> vk -> pk
export class MaspKey {
    private sk;
    ak;
    vk;
    pk;

    constructor(sk?: BigNumberish) {
        if (typeof sk !== undefined) {
            this.sk = babyjub.F.e(randomBN(14).toString());
        } else {
            this.sk = babyjub.F.e(sk.toString());
        }
        
        //get PublicKey object from privateKey object
        this.ak = babyjub.mulPointEscalar(babyjub.Base8, this.sk);
        this.vk = babyjub.F.e(BigNumber.from(poseidon([this.ak[0], this.ak[1]])).toString()); 
        this.pk = babyjub.mulPointEscalar(babyjub.Base8, this.vk);
    }

    public randomize_sk_ak() {
        let alpha = randomBN(14).toString();
        let sk_alpha = babyjub.F.mul(this.sk, babyjub.F.e(alpha));
        let ak_alpha = babyjub.mulPointEscalar(babyjub.Base8, sk_alpha);
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