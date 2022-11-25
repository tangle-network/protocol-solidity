// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {PoseidonT3} from "../hashers/Poseidon.sol";

/**
    @dev The Edge struct is used to store the edge data for linkable tree connections.
    @param chainId The chain id where the LinkableTree contract being linked is located.
    @param root The latest merkle root of the LinkableTree contract being linked.
    @param nonce The latest leaf insertion index of the LinkableTree contract being linked.
    @param target The contract address or tree identifier of the LinkableTree being linked.
*/
struct Edge {
    uint256 chainID;
    uint256 root;
    uint256 latestLeafIndex;
    bytes32 srcResourceID;
}

// Each incremental tree has certain properties and data that will
// be used to add new leaves.
struct LinkableIncrementalTreeData {
    uint8 maxEdges;
    uint256 depth; // Depth of the tree (levels - 1).
    uint32 currentRootIndex;
    mapping(uint256 => uint256) roots;
    uint32 numberOfLeaves; // Number of leaves of the tree.
    // The nodes of the subtrees used in the last addition of a leaf (level -> [left node, right node]).
    mapping(uint256 => uint256[2]) lastSubtrees; // Caching these values is essential to efficient appends.
    // Maps sourceChainID to the index in the edge list
    mapping(uint256 => uint256) edgeIndex;
    mapping(uint256 => bool) edgeExistsForChain;
    Edge[] edgeList;
    // Map to store chainID => (rootIndex => root) to track neighbor histories
    mapping(uint256 => mapping(uint32 => uint256)) neighborRoots;
    // Map to store the current historical root index for a chainID
    mapping(uint256 => uint32) currentNeighborRootIndex;
}

/// @title Linkable Incremental binary Merkle tree.
/// @dev The linkable incremental tree allows to calculate the root hash each time a leaf is added, ensuring
/// the integrity of the tree.
library LinkableIncrementalBinaryTree {
    // Historical roots
    bytes2 public constant EVM_CHAIN_ID_TYPE = 0x0100;
    uint32 internal constant ROOT_HISTORY_SIZE = 30;
    uint8 internal constant MAX_DEPTH = 32;
    uint256 internal constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Edge linking events
    event EdgeAddition(
        uint256 chainID,
        uint256 latestLeafIndex,
        uint256 merkleRoot
    );
    event EdgeUpdate(
        uint256 chainID,
        uint256 latestLeafIndex,
        uint256 merkleRoot
    );

    /// @dev Initializes a tree.
    /// @param self: Tree data.
    /// @param depth: Depth of the tree.
    function init(
        LinkableIncrementalTreeData storage self,
        uint256 depth
    ) public {
        require(
            depth > 0 && depth <= MAX_DEPTH,
            "LinkableIncrementalBinaryTree: tree depth must be between 1 and 32"
        );

        self.depth = depth;
        self.roots[0] = zeros(depth);
    }

    /// @dev Inserts a leaf in the tree.
    /// @param self: Tree data.
    /// @param leaf: Leaf to be inserted.
    function _insert(
        LinkableIncrementalTreeData storage self,
        uint256 leaf
    ) internal {
        uint256 index = self.numberOfLeaves;
        _update(self, index, 0, leaf);
        self.numberOfLeaves += 1;
    }

    /// @dev Inserts a leaf in the tree.
    /// @param self: Tree data.
    /// @param leaf1: Leaf to be inserted.
    /// @param leaf2: Leaf to be inserted.
    function _insertTwo(
        LinkableIncrementalTreeData storage self,
        uint256 leaf1,
        uint256 leaf2
    ) internal returns (uint32) {
        uint32 index = self.numberOfLeaves;
        uint parent = PoseidonT3.poseidon([leaf1, leaf2]);
        _update(self, index, 1, parent);
        self.numberOfLeaves += 2;
        return self.numberOfLeaves;
    }

    /// @dev updates a leaf directly by index. Use with caution.
    /// @param self: Tree data.
    /// @param index: index to be updated.
    /// @param startLevel: allows for updating batches of transactions.
    /// @param leaf: new leaf.
    function _update(
        LinkableIncrementalTreeData storage self,
        uint256 index,
        uint256 startLevel,
        uint256 leaf
    ) internal {
        require(
            leaf < SNARK_SCALAR_FIELD,
            "LinkableIncrementalBinaryTree: leaf must be < SNARK_SCALAR_FIELD"
        );
        require(
            index < 2 ** self.depth,
            "Cannot update leaf outside of tree"
        );
        uint256 hash = leaf;

        for (uint i = startLevel; i < self.depth; i++) {
            if (index % 2 == 0) {
                self.lastSubtrees[i] = [hash, uint256(zeros(i))];
            } else {
                self.lastSubtrees[i][1] = hash;
            }

            hash = PoseidonT3.poseidon(self.lastSubtrees[i]);
            index /= 2;
        }

        uint32 newRootIndex = (self.currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        self.currentRootIndex = newRootIndex;
        self.roots[newRootIndex] = hash;
    }

    /// @dev Updates a leaf in the tree.
    /// @param self: Tree data.
    /// @param leaf: Leaf to be updated.
    /// @param newLeaf: New leaf.
    /// @param proofSiblings: Array of the sibling nodes of the proof of membership.
    /// @param proofPathIndices: Path of the proof of membership.
    function update(
        LinkableIncrementalTreeData storage self,
        uint256 leaf,
        uint256 newLeaf,
        uint256[] calldata proofSiblings,
        uint8[] calldata proofPathIndices
    ) public {
        require(
            verify(self, leaf, proofSiblings, proofPathIndices),
            "LinkableIncrementalBinaryTree: leaf is not part of the tree"
        );

        uint256 depth = self.depth;
        uint256 hash = newLeaf;

        uint256 updateIndex;
        for (uint8 i = 0; i < depth; ) {
            updateIndex |= uint256(proofPathIndices[i] & 1) << uint256(i);
            if (proofPathIndices[i] == 0) {
                if (proofSiblings[i] == self.lastSubtrees[i][1]) {
                    self.lastSubtrees[i][0] = hash;
                }

                hash = PoseidonT3.poseidon([hash, proofSiblings[i]]);
            } else {
                if (proofSiblings[i] == self.lastSubtrees[i][0]) {
                    self.lastSubtrees[i][1] = hash;
                }

                hash = PoseidonT3.poseidon([proofSiblings[i], hash]);
            }

            unchecked {
                ++i;
            }
        }
        require(
            updateIndex < self.numberOfLeaves,
            "IncrementalBinaryTree: leaf index out of range"
        );

        self.roots[self.currentRootIndex] = hash;
    }

    /// @dev Removes a leaf from the tree.
    /// @param self: Tree data.
    /// @param leaf: Leaf to be removed.
    /// @param proofSiblings: Array of the sibling nodes of the proof of membership.
    /// @param proofPathIndices: Path of the proof of membership.
    function remove(
        LinkableIncrementalTreeData storage self,
        uint256 leaf,
        uint256[] calldata proofSiblings,
        uint8[] calldata proofPathIndices
    ) internal {
        require(
            verify(self, leaf, proofSiblings, proofPathIndices),
            "LinkableIncrementalBinaryTree: leaf is not part of the tree"
        );

        uint256 hash = uint256(zeros(0));

        for (uint8 i = 0; i < self.depth; i++) {
            if (proofPathIndices[i] == 0) {
                if (proofSiblings[i] == self.lastSubtrees[i][1]) {
                    self.lastSubtrees[i][0] = hash;
                }

                hash = PoseidonT3.poseidon([hash, proofSiblings[i]]);
            } else {
                if (proofSiblings[i] == self.lastSubtrees[i][0]) {
                    self.lastSubtrees[i][1] = hash;
                }

                hash = PoseidonT3.poseidon([proofSiblings[i], hash]);
            }
        }

        self.roots[self.currentRootIndex] = hash;
    }

    /// @dev Verify if the path is correct and the leaf is part of the tree.
    /// @param self: Tree data.
    /// @param leaf: Leaf to be removed.
    /// @param proofSiblings: Array of the sibling nodes of the proof of membership.
    /// @param proofPathIndices: Path of the proof of membership.
    /// @return True or false.
    function verify(
        LinkableIncrementalTreeData storage self,
        uint256 leaf,
        uint256[] calldata proofSiblings,
        uint8[] calldata proofPathIndices
    ) private view returns (bool) {
        require(
            leaf < SNARK_SCALAR_FIELD,
            "LinkableIncrementalBinaryTree: leaf must be < SNARK_SCALAR_FIELD"
        );
        require(
            proofPathIndices.length == self.depth &&
                proofSiblings.length == self.depth,
            "LinkableIncrementalBinaryTree: length of path is not correct"
        );

        uint256 hash = leaf;

        for (uint8 i = 0; i < self.depth; i++) {
            require(
                proofSiblings[i] < SNARK_SCALAR_FIELD,
                "LinkableIncrementalBinaryTree: sibling node must be < SNARK_SCALAR_FIELD"
            );

            if (proofPathIndices[i] == 0) {
                hash = PoseidonT3.poseidon([hash, proofSiblings[i]]);
            } else {
                hash = PoseidonT3.poseidon([proofSiblings[i], hash]);
            }
        }

        return hash == uint256(self.roots[self.currentRootIndex]);
    }

    /**
        @dev Whether the root is present in the root history
    */
    function isKnownRoot(
        LinkableIncrementalTreeData storage self,
        uint256 _root
    ) public view returns (bool) {
        if (_root == 0) {
            return false;
        }
        uint32 _currentRootIndex = self.currentRootIndex;
        uint32 i = _currentRootIndex;
        do {
            if (_root == self.roots[i]) {
                return true;
            }
            if (i == 0) {
                i = ROOT_HISTORY_SIZE;
            }
            i--;
        } while (i != _currentRootIndex);

        return false;
    }

    /**
        @dev Returns the last root
    */
    function getLastRoot(
        LinkableIncrementalTreeData storage self
    ) public view returns (uint256) {
        return self.roots[self.currentRootIndex];
    }

    /**
        @notice Decodes a byte string of roots into its parts.
        @return bytes32[] An array of bytes32 merkle roots
     */
    function decodeRoots(
        LinkableIncrementalTreeData storage self,
        bytes calldata roots
    ) internal view returns (bytes32[] memory) {
        bytes32[] memory decodedRoots = new bytes32[](self.maxEdges + 1);
        for (uint256 i = 0; i <= self.maxEdges; i++) {
            decodedRoots[i] = bytes32(roots[(32 * i):(32 * (i + 1))]);
        }

        return decodedRoots;
    }

    /**
        Parses the typed chain ID out from a 32-byte resource ID
     */
    function parseChainIdFromResourceId(
        bytes32 _resourceId
    ) public pure returns (uint64) {
        return uint64(uint48(bytes6(_resourceId << (26 * 8))));
    }

    // solium-disable-next-line security/code-complexity
    function zeros(uint256 i) public pure returns (uint256) {
        if (i == 0)
            return
                0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c;
        else if (i == 1)
            return
                0x13e37f2d6cb86c78ccc1788607c2b199788c6bb0a615a21f2e7a8e88384222f8;
        else if (i == 2)
            return
                0x217126fa352c326896e8c2803eec8fd63ad50cf65edfef27a41a9e32dc622765;
        else if (i == 3)
            return
                0x0e28a61a9b3e91007d5a9e3ada18e1b24d6d230c618388ee5df34cacd7397eee;
        else if (i == 4)
            return
                0x27953447a6979839536badc5425ed15fadb0e292e9bc36f92f0aa5cfa5013587;
        else if (i == 5)
            return
                0x194191edbfb91d10f6a7afd315f33095410c7801c47175c2df6dc2cce0e3affc;
        else if (i == 6)
            return
                0x1733dece17d71190516dbaf1927936fa643dc7079fc0cc731de9d6845a47741f;
        else if (i == 7)
            return
                0x267855a7dc75db39d81d17f95d0a7aa572bf5ae19f4db0e84221d2b2ef999219;
        else if (i == 8)
            return
                0x1184e11836b4c36ad8238a340ecc0985eeba665327e33e9b0e3641027c27620d;
        else if (i == 9)
            return
                0x0702ab83a135d7f55350ab1bfaa90babd8fc1d2b3e6a7215381a7b2213d6c5ce;
        else if (i == 10)
            return
                0x2eecc0de814cfd8c57ce882babb2e30d1da56621aef7a47f3291cffeaec26ad7;
        else if (i == 11)
            return
                0x280bc02145c155d5833585b6c7b08501055157dd30ce005319621dc462d33b47;
        else if (i == 12)
            return
                0x045132221d1fa0a7f4aed8acd2cbec1e2189b7732ccb2ec272b9c60f0d5afc5b;
        else if (i == 13)
            return
                0x27f427ccbf58a44b1270abbe4eda6ba53bd6ac4d88cf1e00a13c4371ce71d366;
        else if (i == 14)
            return
                0x1617eaae5064f26e8f8a6493ae92bfded7fde71b65df1ca6d5dcec0df70b2cef;
        else if (i == 15)
            return
                0x20c6b400d0ea1b15435703c31c31ee63ad7ba5c8da66cec2796feacea575abca;
        else if (i == 16)
            return
                0x09589ddb438723f53a8e57bdada7c5f8ed67e8fece3889a73618732965645eec;
        else if (i == 17)
            return
                0x0064b6a738a5ff537db7b220f3394f0ecbd35bfd355c5425dc1166bf3236079b;
        else if (i == 18)
            return
                0x095de56281b1d5055e897c3574ff790d5ee81dbc5df784ad2d67795e557c9e9f;
        else if (i == 19)
            return
                0x11cf2e2887aa21963a6ec14289183efe4d4c60f14ecd3d6fe0beebdf855a9b63;
        else if (i == 20)
            return
                0x2b0f6fc0179fa65b6f73627c0e1e84c7374d2eaec44c9a48f2571393ea77bcbb;
        else if (i == 21)
            return
                0x16fdb637c2abf9c0f988dbf2fd64258c46fb6a273d537b2cf1603ea460b13279;
        else if (i == 22)
            return
                0x21bbd7e944f6124dad4c376df9cc12e7ca66e47dff703ff7cedb1a454edcf0ff;
        else if (i == 23)
            return
                0x2784f8220b1c963e468f590f137baaa1625b3b92a27ad9b6e84eb0d3454d9962;
        else if (i == 24)
            return
                0x16ace1a65b7534142f8cc1aad810b3d6a7a74ca905d9c275cb98ba57e509fc10;
        else if (i == 25)
            return
                0x2328068c6a8c24265124debd8fe10d3f29f0665ea725a65e3638f6192a96a013;
        else if (i == 26)
            return
                0x2ddb991be1f028022411b4c4d2c22043e5e751c120736f00adf54acab1c9ac14;
        else if (i == 27)
            return
                0x0113798410eaeb95056a464f70521eb58377c0155f2fe518a5594d38cc209cc0;
        else if (i == 28)
            return
                0x202d1ae61526f0d0d01ef80fb5d4055a7af45721024c2c24cffd6a3798f54d50;
        else if (i == 29)
            return
                0x23ab323453748129f2765f79615022f5bebd6f4096a796300aab049a60b0f187;
        else if (i == 30)
            return
                0x1f15585f8947e378bcf8bd918716799da909acdb944c57150b1eb4565fda8aa0;
        else if (i == 31)
            return
                0x1eb064b21055ac6a350cf41eb30e4ce2cb19680217df3a243617c2838185ad06;
        else revert("Index out of bounds");
    }

}
