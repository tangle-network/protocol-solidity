/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./LinkableIncrementalBinaryTree.sol";
import "../hashers/IHasher.sol";

contract MerkleForest {
    using LinkableIncrementalBinaryTree for LinkableIncrementalTreeData;
    IHasher public hasher;
    uint256 public currSubtreeIndex;
    uint256 public numSubtreeElements;
    uint256 public maxSubtreeElements;

    /// @dev Gets a group id and returns the group/tree data.
    mapping(uint256 => LinkableIncrementalTreeData) public subtrees;
    LinkableIncrementalTreeData public merkleForest;

    // bytes32[] public leaves;
    constructor(uint32 _forestLevels, uint32 _subtreeLevels, IHasher _hasher) {
        require(_forestLevels > 0, "_forestLevels should be greater than zero");
        require(_subtreeLevels > 0, "_subtreeLevels should be greater than zero");
        require(_forestLevels < 32, "_forestLevels should be less than 32");
        require(_subtreeLevels < 32, "_subtreeLevels should be less than 32");

        for (uint32 i = 0; i <  _forestLevels; i++) {
            subtrees[i].init(_subtreeLevels);
        }
        merkleForest.init(_forestLevels);

        hasher = _hasher;
        maxSubtreeElements = 2 ** _subtreeLevels;
        currSubtreeIndex = 0;
        numSubtreeElements = 0;
    }
    function _insert(bytes32 _leaf) internal returns (uint32) {
        if (numSubtreeElements >= maxSubtreeElements) {
            numSubtreeElements = 0;
            currSubtreeIndex += 1;
        }
        subtrees[currSubtreeIndex]._insert(uint(_leaf));
        uint newLeaf = subtrees[currSubtreeIndex].getLastRoot();
        merkleForest._update(currSubtreeIndex, 0, newLeaf);
        numSubtreeElements += 1;
        // return merkleForest.getLastRoot();
    }

    function _insertTwo(bytes32 _leaf1, bytes32 _leaf2) internal returns (uint32) {
        if (numSubtreeElements + 1 >= maxSubtreeElements) {
            numSubtreeElements = 0;
            currSubtreeIndex += 1;
        }
        uint32 index = subtrees[currSubtreeIndex]._insertTwo(uint(_leaf1), uint(_leaf2));
        uint newLeaf = subtrees[currSubtreeIndex].getLastRoot();
        merkleForest._update(currSubtreeIndex, 0,  newLeaf);
        numSubtreeElements += 2;
        return index;
    }
    // TODO: Should remove, included for testing
    function insertTwoTest(bytes32 _leaf1, bytes32 _leaf2) public returns (uint32) {
        _insertTwo(_leaf1, _leaf2);
    }

    // TODO: Remove this. Created for testing
    function insertTest(bytes32 _leaf) public returns (uint32) {
        _insert(_leaf);
    }

    // TODO: Make it internal
    function insertSubtree(uint32 _subtreeId, bytes32 _leaf) public returns (uint) {
        if (numSubtreeElements >= maxSubtreeElements) {
            numSubtreeElements = 0;
            currSubtreeIndex += 1;
        }
        subtrees[_subtreeId]._insert(uint(_leaf));
        uint newLeaf = subtrees[_subtreeId].getLastRoot();
        merkleForest._update(_subtreeId, 0, newLeaf);
        return merkleForest.getLastRoot();
    }
    /**
        @dev Whether the root is present in any of the subtree's history
    */
    function isKnownSubtreeRoot(uint _subtreeId, bytes32 _root) public view returns (bool) {
        return subtrees[_subtreeId].isKnownRoot(uint(_root));
    }

    /**
        @dev Returns the last root of the forest
    */
    function getLastRoot() public view returns (uint256) {
        return merkleForest.getLastRoot();
    }

    /**
        @dev Whether the root is present in the root history of the forest
    */
    function isKnownRoot(uint256 _root) public view returns (bool) {
        return merkleForest.isKnownRoot(_root);
    }

    /**
        @dev Whether the root is present in any of the subtree's history
    */
    function getLastSubtreeRoot(uint256 _subtreeId) public view returns (uint) {
        return subtrees[_subtreeId].getLastRoot();
    }
}
