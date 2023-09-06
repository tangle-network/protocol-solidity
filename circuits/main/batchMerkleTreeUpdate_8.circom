pragma circom 2.0.0;  

include "../merkle-tree/batchMerkleTreeUpdate.circom";

/* var CHUNK_TREE_HEIGHT = 4 */
/* component main {public [argsHash]} = BatchTreeUpdate(20, 4, nthZero(4)); */
/* component main {public [argsHash]} = BatchTreeUpdate(20, 4, 17903822129909817717122288064678017104411031693253675943446999432073303897479); */
component main {public [argsHash]} = BatchTreeUpdate(20, 3, nthZero(3));
