import { PoseidonHasher, Storage } from '@webb-tools/utils';

export interface Hasher {
  hash(level: any, left: any, right: any): any;
}

interface TraverserHandler {
  handle_index(level: number, element_index: number, sibling_index: number): void;
}

class UpdateTraverser implements TraverserHandler {
  private original_element: any;
  public keyValuesToPut: any = [];

  constructor(
    private prefix: string,
    private storage: Storage,
    private hasher: Hasher,
    public currentElement: any,
    private zeroValues: any
  ) {}

  async handle_index(level: number, element_index: number, sibling_index: number) {
    if (level == 0) {
      this.original_element = this.storage.getOrDefault(
        MerkleTree.keyFormat(this.prefix, level, element_index),
        this.zeroValues[level]
      );
    }
    const sibling = this.storage.getOrDefault(
      MerkleTree.keyFormat(this.prefix, level, sibling_index),
      this.zeroValues[level]
    );
    let left, right;
    if (element_index % 2 == 0) {
      left = this.currentElement;
      right = sibling;
    } else {
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

class PathTraverser implements TraverserHandler {
  public pathElements: any[] = [];
  public pathIndex: number[] = [];

  constructor(private prefix: string, private storage: Storage, private zeroValues: any) {}

  handle_index(level: number, element_index: number, sibling_index: number) {
    const sibling = this.storage.getOrDefault(
      MerkleTree.keyFormat(this.prefix, level, sibling_index),
      this.zeroValues[level]
    ) as any;
    this.pathElements.push(sibling);
    this.pathIndex.push(element_index % 2);
  }
}

export class MerkleTree {
  private zeroValues: string[] = [];
  public totalElements = 0;

  static keyFormat(prefix: string, level: number, index: number) {
    return `${prefix}_tree_${level}_${index}`;
  }

  constructor(
    private prefix: string,
    private nLevel: number,
    defaultElements: any[] = [],
    private hasher: Hasher = new PoseidonHasher(),
    private storage: Storage = new Storage()
  ) {
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

  traverse(index: number, handler: TraverserHandler) {
    let current_index = index;
    for (let i = 0; i < this.nLevel; i++) {
      let sibling_index = current_index;
      if (current_index % 2 == 0) {
        sibling_index += 1;
      } else {
        sibling_index -= 1;
      }
      handler.handle_index(i, current_index, sibling_index);
      current_index = Math.floor(current_index / 2);
    }
  }

  update(index: number, element: any, insert = false) {
    if (!insert && index >= this.totalElements) {
      throw Error('Use insert method for new elements.');
    } else if (insert && index < this.totalElements) {
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
    } catch (e) {
      console.error(e);
    }
  }

  get_root(): string {
    let root = this.storage.getOrDefault(
      MerkleTree.keyFormat(this.prefix, this.nLevel, 0),
      this.zeroValues[this.nLevel]
    ) as string;
    return root;
  }

  // Elements must be ordered
  batch_insert(elements: any[]) {
    elements.forEach((elem) => {
      this.insert(elem);
    });
  }

  insert(element: any) {
    const index = this.totalElements;
    this.update(index, element, true);
    this.totalElements++;
    return index;
  }

  number_of_elements() {
    return this.totalElements;
  }

  path(index: number) {
    const traverser = new PathTraverser(this.prefix, this.storage, this.zeroValues);
    const root = this.storage.getOrDefault(
      MerkleTree.keyFormat(this.prefix, this.nLevel, 0),
      this.zeroValues[this.nLevel]
    );

    const element = this.storage.getOrDefault(MerkleTree.keyFormat(this.prefix, 0, index), this.zeroValues[0]);

    this.traverse(index, traverser);
    return {
      merkleRoot: root as string,
      pathElements: traverser.pathElements,
      pathIndices: traverser.pathIndex,
      element: element as number,
    };
  }

  getIndexByElement(element: any) {
    for (let i = this.totalElements - 1; i >= 0; i--) {
      const elementFromTree = this.storage.get(MerkleTree.keyFormat(this.prefix, 0, i))
      if (elementFromTree === element) {
        return i
      }
    }
    return false
  }
}
