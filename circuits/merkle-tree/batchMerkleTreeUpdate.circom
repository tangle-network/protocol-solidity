pragma circom 2.0.0;

include "../../node_modules/circomlib/circuits/poseidon.circom";
include "../../node_modules/circomlib/circuits/bitify.circom";
include "./merkleTreeUpdater.circom";
include "./treeUpdateArgsHasher.circom";
include "./merkleTree.circom";

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
  signal input oldRoot;
  signal input newRoot;
  signal input pathIndices;
  signal input pathElements[height];
  signal input leaves[nLeaves];
  /* signal input blocks[nLeaves]; */
  // Check that hash of arguments is correct
  // We compress arguments into a single hash to considerably reduce gas usage on chain
  component argsHasher = TreeUpdateArgsHasher(nLeaves);
  argsHasher.oldRoot <== oldRoot;
  argsHasher.newRoot <== newRoot;
  argsHasher.pathIndices <== pathIndices;
  for(var i = 0; i < nLeaves; i++) {
    argsHasher.leaves[i] <== leaves[i];
  }
  argsHash === argsHasher.out;
  // Compute batch subtree merkle root
  component layers[batchLevels];
  for(var level = batchLevels - 1; level >= 0; level--) {
    layers[level] = TreeLayer(level);
    for(var i = 0; i < (1 << (level + 1)); i++) {
      layers[level].ins[i] <== level == batchLevels - 1 ? leaves[i] : layers[level + 1].outs[i];
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
    if (n == 1) return 8995896153219992062710898675021891003404871425075198597897889079729967997688;
    if (n == 2) return 15126246733515326086631621937388047923581111613947275249184377560170833782629;
    if (n == 3) return 6404200169958188928270149728908101781856690902670925316782889389790091378414;
    if (n == 4) return 17903822129909817717122288064678017104411031693253675943446999432073303897479;
    if (n == 5) return 11423673436710698439362231088473903829893023095386581732682931796661338615804;
    if (n == 6) return 10494842461667482273766668782207799332467432901404302674544629280016211342367;
    if (n == 7) return 17400501067905286947724900644309270241576392716005448085614420258732805558809;
    if (n == 8) return 7924095784194248701091699324325620647610183513781643345297447650838438175245;
    if (n == 9) return 3170907381568164996048434627595073437765146540390351066869729445199396390350;
    if (n == 10) return 21224698076141654110749227566074000819685780865045032659353546489395159395031;
    if (n == 11) return 18113275293366123216771546175954550524914431153457717566389477633419482708807;
    if (n == 12) return 1952712013602708178570747052202251655221844679392349715649271315658568301659;
    if (n == 13) return 18071586466641072671725723167170872238457150900980957071031663421538421560166;
    if (n == 14) return 9993139859464142980356243228522899168680191731482953959604385644693217291503;
    if (n == 15) return 14825089209834329031146290681677780462512538924857394026404638992248153156554;
    else return 0;
}
