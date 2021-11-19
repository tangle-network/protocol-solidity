"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Storage = void 0;
class Storage {
    constructor() {
        this.db = {};
    }
    get(key) {
        return this.db[key];
    }
    getOrDefault(key, defaultElement) {
        var _a;
        return (_a = this.db[key]) !== null && _a !== void 0 ? _a : defaultElement;
    }
    put(key, value) {
        this.db[key] = value;
    }
    del(key) {
        delete this.db[key];
    }
    put_batch(key_values) {
        key_values.forEach((element) => {
            // @ts-ignore
            this.db[element.key] = element.value;
        });
    }
}
exports.Storage = Storage;
//# sourceMappingURL=Storage.js.map