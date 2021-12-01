pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "./MerkleTreeUpdater.circom";
include "./TreeUpdateArgsHasher.circom";

// Computes hashes of the next tree layer
template TreeLayer(height) {
  var nItems = 1 << height;
  signal input ins[nItems * 2];
  signal output outs[nItems];

  component hash[nItems];
  for(var i = 0; i < nItems; i++) {
    hash[i] = HashLeftRight();
    hash[i].left <== ins[i * 2];
    hash[i].right <== ins[i * 2 + 1];
    hash[i].hash ==> outs[i];
  }
}

// Inserts a leaf batch into a tree
// Checks that tree previously contained zero leaves in the same position
// Hashes leaves with Poseidon hash
// `batchLevels` should be less than `levels`
template BatchTreeUpdate(levels, batchLevels, zeroBatchLeaf) {
  var height = levels - batchLevels;
  var nLeaves = 1 << batchLevels;
  signal input argsHash;
  signal input oldRoot; //private
  signal input newRoot; //private
  signal input pathIndices; //private
  signal input pathElements[height]; //private
  signal input hashes[nLeaves]; //private
  signal input instances[nLeaves]; //private
  signal input blocks[nLeaves]; //private

  // Check that hash of arguments is correct
  // We compress arguments into a single hash to considerably reduce gas usage on chain
  component argsHasher = TreeUpdateArgsHasher(nLeaves);
  argsHasher.oldRoot <== oldRoot;
  argsHasher.newRoot <== newRoot;
  argsHasher.pathIndices <== pathIndices;
  for(var i = 0; i < nLeaves; i++) {
    argsHasher.hashes[i] <== hashes[i];
    argsHasher.instances[i] <== instances[i];
    argsHasher.blocks[i] <== blocks[i];
  }
  argsHash === argsHasher.out;

  // Compute hashes of all leaves
  component leaves[nLeaves];
  for(var i = 0; i < nLeaves; i++) {
    leaves[i] = Poseidon(3);
    leaves[i].inputs[0] <== instances[i];
    leaves[i].inputs[1] <== hashes[i];
    leaves[i].inputs[2] <== blocks[i];
  }

  // Compute batch subtree merkle root
  component layers[batchLevels];
  for(var level = batchLevels - 1; level >= 0; level--) {
    layers[level] = TreeLayer(level);
    for(var i = 0; i < (1 << (level + 1)); i++) {
      layers[level].ins[i] <== level == batchLevels - 1 ? leaves[i].out : layers[level + 1].outs[i];
    }
  }

  // Verify that batch subtree was inserted correctly
  component treeUpdater = MerkleTreeUpdater(height, zeroBatchLeaf);
  treeUpdater.oldRoot <== oldRoot;
  treeUpdater.newRoot <== newRoot;
  treeUpdater.leaf <== layers[0].outs[0];
  treeUpdater.pathIndices <== pathIndices;
  for(var i = 0; i < height; i++) {
    treeUpdater.pathElements[i] <== pathElements[i];
  }
}

// zeroLeaf = keccak256("tornado") % FIELD_SIZE
// zeroBatchLeaf is poseidon(zeroLeaf, zeroLeaf) (batchLevels - 1) times
function nthZero(n) {
    if (n == 0) return 21663839004416932945382355908790599225266501822907911457504978515578255421292;
    if (n == 1) return 11850551329423159860688778991827824730037759162201783566284850822760196767874;
    if (n == 2) return 21572503925325825116380792768937986743990254033176521064707045559165336555197;
    if (n == 3) return 11224495635916644180335675565949106569141882748352237685396337327907709534945;
    if (n == 4) return 2399242030534463392142674970266584742013168677609861039634639961298697064915;
    if (n == 5) return 13182067204896548373877843501261957052850428877096289097123906067079378150834;
    if (n == 6) return 7106632500398372645836762576259242192202230138343760620842346283595225511823;
    if (n == 7) return 17857585024203959071818533000506593455576509792639288560876436361491747801924;
    if (n == 8) return 17278668323652664881420209773995988768195998574629614593395162463145689805534;
    if (n == 9) return 209436188287252095316293336871467217491997565239632454977424802439169726471;
    else return
    0;
}


