"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const circomlibjs = require('circomlibjs');
const maci = require('maci-crypto');
class PoseidonHasher {
    hash(level, left, right) {
        return maci.hashLeftRight(BigInt(left), BigInt(right)).toString();
    }
    hash3(inputs) {
        if (inputs.length !== 3)
            throw new Error('panic');
        return circomlibjs.poseidon(inputs);
    }
}
exports.default = PoseidonHasher;
//# sourceMappingURL=Poseidon.js.map