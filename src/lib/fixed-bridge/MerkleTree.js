"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTree = void 0;
const Poseidon_1 = __importDefault(require("../Poseidon"));
const Storage_1 = require("../Storage");
class UpdateTraverser {
    constructor(prefix, storage, hasher, currentElement, zeroValues) {
        this.prefix = prefix;
        this.storage = storage;
        this.hasher = hasher;
        this.currentElement = currentElement;
        this.zeroValues = zeroValues;
        this.keyValuesToPut = [];
    }
    async handle_index(level, element_index, sibling_index) {
        if (level == 0) {
            this.original_element = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, level, element_index), this.zeroValues[level]);
        }
        const sibling = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, level, sibling_index), this.zeroValues[level]);
        let left, right;
        if (element_index % 2 == 0) {
            left = this.currentElement;
            right = sibling;
        }
        else {
            left = sibling;
            right = this.currentElement;
        }
        this.keyValuesToPut.push({
            key: MerkleTree.keyFormat(this.prefix, level, element_index),
            value: this.currentElement,
        });
        this.currentElement = this.hasher.hash(level, left, right);
    }
}
class PathTraverser {
    constructor(prefix, storage, zeroValues) {
        this.prefix = prefix;
        this.storage = storage;
        this.zeroValues = zeroValues;
        this.pathElements = [];
        this.pathIndex = [];
    }
    handle_index(level, element_index, sibling_index) {
        const sibling = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, level, sibling_index), this.zeroValues[level]);
        this.pathElements.push(sibling);
        this.pathIndex.push(element_index % 2);
    }
}
class MerkleTree {
    constructor(prefix, nLevel, defaultElements = [], hasher = new Poseidon_1.default(), storage = new Storage_1.Storage()) {
        this.prefix = prefix;
        this.nLevel = nLevel;
        this.hasher = hasher;
        this.storage = storage;
        this.zeroValues = [];
        this.totalElements = 0;
        let current_zero_value = '21663839004416932945382355908790599225266501822907911457504978515578255421292';
        this.zeroValues.push(current_zero_value);
        for (let i = 0; i < this.nLevel; i++) {
            current_zero_value = this.hasher.hash(i, current_zero_value, current_zero_value);
            this.zeroValues.push(current_zero_value.toString());
        }
        if (defaultElements) {
            let level = 0;
            this.totalElements = defaultElements.length;
            defaultElements.forEach((element, i) => {
                this.storage.put(MerkleTree.keyFormat(prefix, level, i), element);
            });
            level++;
            let numberOfElementsInLevel = Math.ceil(defaultElements.length / 2);
            for (level; level <= this.nLevel; level++) {
                for (let i = 0; i < numberOfElementsInLevel; i++) {
                    const leftKey = MerkleTree.keyFormat(prefix, level - 1, 2 * i);
                    const rightKey = MerkleTree.keyFormat(prefix, level - 1, 2 * i + 1);
                    const left = this.storage.get(leftKey);
                    const right = this.storage.getOrDefault(rightKey, this.zeroValues[level - 1]);
                    const subRoot = this.hasher.hash(null, left, right);
                    this.storage.put(MerkleTree.keyFormat(prefix, level, i), subRoot);
                }
                numberOfElementsInLevel = Math.ceil(numberOfElementsInLevel / 2);
            }
        }
    }
    static keyFormat(prefix, level, index) {
        return `${prefix}_tree_${level}_${index}`;
    }
    traverse(index, handler) {
        let current_index = index;
        for (let i = 0; i < this.nLevel; i++) {
            let sibling_index = current_index;
            if (current_index % 2 == 0) {
                sibling_index += 1;
            }
            else {
                sibling_index -= 1;
            }
            handler.handle_index(i, current_index, sibling_index);
            current_index = Math.floor(current_index / 2);
        }
    }
    update(index, element, insert = false) {
        if (!insert && index >= this.totalElements) {
            throw Error('Use insert method for new elements.');
        }
        else if (insert && index < this.totalElements) {
            throw Error('Use update method for existing elements.');
        }
        try {
            let traverser = new UpdateTraverser(this.prefix, this.storage, this.hasher, element, this.zeroValues);
            this.traverse(index, traverser);
            traverser.keyValuesToPut.push({
                key: MerkleTree.keyFormat(this.prefix, this.nLevel, 0),
                value: traverser.currentElement,
            });
            this.storage.put_batch(traverser.keyValuesToPut);
        }
        catch (e) {
            console.error(e);
        }
    }
    get_root() {
        let root = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, this.nLevel, 0), this.zeroValues[this.nLevel]);
        return root;
    }
    // Elements must be ordered
    batch_insert(elements) {
        elements.forEach((elem) => {
            this.insert(elem);
        });
    }
    insert(element) {
        const index = this.totalElements;
        this.update(index, element, true);
        this.totalElements++;
        return index;
    }
    number_of_elements() {
        return this.totalElements;
    }
    path(index) {
        const traverser = new PathTraverser(this.prefix, this.storage, this.zeroValues);
        const root = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, this.nLevel, 0), this.zeroValues[this.nLevel]);
        const element = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, 0, index), this.zeroValues[0]);
        this.traverse(index, traverser);
        return {
            merkleRoot: root,
            pathElements: traverser.pathElements,
            pathIndices: traverser.pathIndex,
            element,
        };
    }
}
exports.MerkleTree = MerkleTree;
//# sourceMappingURL=MerkleTree.js.map