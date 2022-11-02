/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../hashers/IHasher.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

abstract contract MerkleTreeWithHistory is Initializable {
    uint32 public currentRootIndex = 0;
    uint32 public nextIndex = 0;
    uint32 public levels;
    uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ZERO_VALUE = 21663839004416932945382355908790599225266501822907911457504978515578255421292; // = keccak256("tornado") % FIELD_SIZE
    // the `Root` struct is used to store the root and the index of the leaf triggering this root update
    struct Root {
        bytes32 root;
        uint256 latestLeafindex;
    }
    // the mapping of root indices to roots for storing a history of ROOT_HISTORY_SIZE updates
    mapping(uint256 => Root) public roots;
    IHasher public hasher;

    // the following variables are made public for easier testing and debugging and
    // are not supposed to be accessed in regular code

    // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
    // it removes index range check on every interaction
    mapping(uint256 => bytes32) public filledSubtrees;
    uint32 public constant ROOT_HISTORY_SIZE = 30;

    /** @dev this function is defined in a child contract */
    function hashLeftRight(IHasher _hasher, bytes32 _left, bytes32 _right) public virtual returns (bytes32);

    function _insert(bytes32 _leaf) internal returns (uint32 index) {
        uint32 _nextIndex = nextIndex;
        require(_nextIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
        uint32 currentIndex = _nextIndex;
        bytes32 currentLevelHash = _leaf;
        bytes32 left;
        bytes32 right;

        for (uint32 i = 0; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = hasher.zeros(i);
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(hasher, left, right);
            currentIndex /= 2;
        }

        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        nextIndex = _nextIndex + 1;
        roots[newRootIndex] = Root(currentLevelHash, nextIndex);
        return _nextIndex;
    }

    // Modified to insert pairs of leaves for better efficiency
    // Disclaimer: using this function assumes both leaves are siblings.
    function _insertTwo(bytes32 _leaf1, bytes32 _leaf2) internal returns (uint32 index) {
        uint32 _nextIndex = nextIndex;
        require(_nextIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
        uint32 currentIndex = _nextIndex / 2;
        bytes32 currentLevelHash = hashLeftRight(hasher, _leaf1, _leaf2);
        bytes32 left;
        bytes32 right;
        for (uint32 i = 1; i < levels; i++) {
            if (currentIndex % 2 == 0) {
                left = currentLevelHash;
                right = hasher.zeros(i);
                filledSubtrees[i] = currentLevelHash;
            } else {
                left = filledSubtrees[i];
                right = currentLevelHash;
            }
            currentLevelHash = hashLeftRight(hasher, left, right);
            currentIndex /= 2;
        }
        
        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        nextIndex = _nextIndex + 2;
        roots[newRootIndex] = Root(currentLevelHash, nextIndex);
        return _nextIndex;
    }

    /**
        @dev Whether the root is present in the root history
    */
    function isKnownRoot(bytes32 _root) public view returns (bool) {
        if (_root == 0) {
            return false;
        }
        uint32 _currentRootIndex = currentRootIndex;
        uint32 i = _currentRootIndex;
        do {
            if (_root == roots[i].root) {
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
    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex].root;
    }

    function _initialize() internal {}
}