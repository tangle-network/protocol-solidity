/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../trees/MerkleTreePoseidon.sol";
import "../interfaces/IVerifier.sol";
import "../utils/ChainIdWithType.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
	@title The LinkableTree contract
	@author Webb Technologies
	@notice The LinkableTree contract extends the MerkleTreePoseidon contract
	with a graph-like interface for linking to other LinkableTrees. Links
	between these trees are represented as directed edges (since updates occur
	on one contract per transaction). The edge data is maintained as a record of the:
	- Chain id that the edge points to
	- Latest merkle root of the MerkleTreePoseidon contract being linked
	- Latest leaf insertion index (used as a nonce) of the linked merkle tree.

	Updating the state of the LinkableTree's edges is done through the handler
	architecture defined originally by ChainSafe's ChainBridge system. In our case,
	we employ a handler to propagate updates to a LinkableTree contract. For example,
	the handler can be connected to an oracle system, signature system, or any other
	bridge system to provide the state of the neighboring LinkableTree's edge data.

	The LinkableTree contract is meant to be inherited by child contracts that
	define their own architecture around:
	1. The structure of elements being inserted into the underlying Merkle Tree
	2. The type of zkSNARK necessary for proving membership of a specific element
	   in one-of-many LinkableTrees connected in a bridge.

	An example usage of this system is the:
	- FixedDepositAnchor.sol - for fixed sized private bridging of assets
	- VAnchor.sol - for variable sized private bridging of assets
 */
abstract contract LinkableTree is MerkleTreePoseidon, ReentrancyGuard, ChainIdWithType {
	address public handler;

	// The maximum number of edges this tree can support.
	uint8 public immutable maxEdges;

	struct Edge {
		uint256 chainID;
		bytes32 root;
		uint256 latestLeafIndex;
	}

	// Maps sourceChainID to the index in the edge list
	mapping(uint256 => uint256) public edgeIndex;
	mapping(uint256 => bool) public edgeExistsForChain;
	Edge[] public edgeList;

	// Map to store chainID => (rootIndex => root) to track neighbor histories
	mapping(uint256 => mapping(uint32 => bytes32)) public neighborRoots;
	// Map to store the current historical root index for a chainID
	mapping(uint256 => uint32) public currentNeighborRootIndex;

	// Edge linking events
	event EdgeAddition(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);
	event EdgeUpdate(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);

	/**
		@notice The LinkableTree constructor
		@param _handler The address of the `AnchorHandler` contract
		@param _hasher The address of hash contract
		@param _merkleTreeHeight The height of deposits' Merkle Tree
		@param _maxEdges The maximum # of edges this linkable tree connects to
	*/
	constructor(
		address _handler,
		IPoseidonT3 _hasher,
		uint32 _merkleTreeHeight,
		uint8 _maxEdges
	) MerkleTreePoseidon(_merkleTreeHeight, _hasher) {
		handler = _handler;
		maxEdges = _maxEdges;
	}

	/**
		@notice Add an edge to the tree or update an existing edge.
		@param _sourceChainID The chainID of the edge's LinkableTree
		@param _root The merkle root of the edge's merkle tree
		@param _leafIndex The latest leaf insertion index of the edge's merkle tree
	 */
	function updateEdge(
		uint256 _sourceChainID,
		bytes32 _root,
		uint256 _leafIndex
	) onlyHandler external payable nonReentrant {
		if (this.hasEdge(_sourceChainID)) {
			//Update Edge
			require(edgeExistsForChain[_sourceChainID], "Chain must be integrated from the bridge before updates");
			require(edgeList[edgeIndex[_sourceChainID]].latestLeafIndex < _leafIndex, "New leaf index must be greater");
			require(_leafIndex < edgeList[edgeIndex[_sourceChainID]].latestLeafIndex + (65_536), "New leaf index must within 2^16 updates");
			uint index = edgeIndex[_sourceChainID];
			// update the edge in the edge list
			edgeList[index] = Edge({
				chainID: _sourceChainID,
				root: _root,
				latestLeafIndex: _leafIndex
			});
				// add to root histories
			uint32 neighborRootIndex = (currentNeighborRootIndex[_sourceChainID] + 1) % ROOT_HISTORY_SIZE;
			currentNeighborRootIndex[_sourceChainID] = neighborRootIndex;
			neighborRoots[_sourceChainID][neighborRootIndex] = _root;
			emit EdgeUpdate(_sourceChainID, _leafIndex, _root);
		} else {
			//Add Edge
			require(edgeList.length < maxEdges, "This Anchor is at capacity");
			edgeExistsForChain[_sourceChainID] = true;
			uint index = edgeList.length;
			Edge memory edge = Edge({
				chainID: _sourceChainID,
				root: _root,
				latestLeafIndex: _leafIndex
			});
			edgeList.push(edge);
			edgeIndex[_sourceChainID] = index;
			// add to root histories
			uint32 neighborRootIndex = 0;
			neighborRoots[_sourceChainID][neighborRootIndex] = _root;
			emit EdgeAddition(_sourceChainID, _leafIndex, _root);
		}
	}

	/**
		@notice Get the latest state of all neighbor edges
		@return Edge[] An array of all neighboring and potentially empty edges
	 */
	function getLatestNeighborEdges() public view returns (Edge[] memory) {
		Edge[] memory edges = new Edge[](maxEdges);
		for (uint256 i = 0; i < maxEdges; i++) {
			if (edgeList.length >= i + 1) {
				edges[i] = edgeList[i];
			} else {
				edges[i] = Edge({
					// merkle tree height for zeros
					root: zeros(levels),
					chainID: 0,
					latestLeafIndex: 0
				});
			}
		}

		return edges;
	}

	/**
		@notice Get the latest merkle roots of all neighbor edges
		@return bytes32[] An array of merkle roots
	 */
	function getLatestNeighborRoots() public view returns (bytes32[] memory) {
		bytes32[] memory roots = new bytes32[](maxEdges);
		for (uint256 i = 0; i < maxEdges; i++) {
			if (edgeList.length >= i + 1) {
				roots[i] = edgeList[i].root;
			} else {
				// merkle tree height for zeros
				roots[i] = zeros(levels);
			}
		}

		return roots;
	}

	/**
		@notice Checks to see whether a `_root` is known for a neighboring `neighborChainID`
		@param _neighborChainID The chainID of the neighbor's edge
		@param _root The root to check
	 */
	function isKnownNeighborRoot(uint256 _neighborChainID, bytes32 _root) public view returns (bool) {
		if (_root == 0) {
			return false;
		}
		uint32 _currentRootIndex = currentNeighborRootIndex[_neighborChainID];
		uint32 i = _currentRootIndex;
		do {
			if (_root == neighborRoots[_neighborChainID][i]) {
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
		@notice Checks validity of an array of merkle roots in the history.
		The first root should always be the root of `this` underlying merkle
		tree and the remaining roots are of the neighboring roots in `edges.
		@param _roots An array of bytes32 merkle roots to be checked against the history.
	 */
	function isValidRoots(bytes32[] memory _roots) public view returns (bool) {
		require(isKnownRoot(_roots[0]), "Cannot find your merkle root");
		require(_roots.length == maxEdges + 1, "Incorrect root array length");
		for (uint i = 0; i < edgeList.length; i++) {
			Edge memory _edge = edgeList[i];
			require(isKnownNeighborRoot(_edge.chainID, _roots[i+1]), "Neighbor root not found");
		}
		return true;
	}

	/**
		@notice Checks the sender is the AnchorHandler configured on this contract
	 */
	modifier onlyHandler()  {
		require(msg.sender == handler, 'sender is not the handler');
		_;
	}

	/**
		@notice Checks the `_chainID` has an edge on this contract
	 */
	function hasEdge(uint256 _chainID) external view returns (bool) {
		return edgeExistsForChain[_chainID];
	}

	/**
		@notice Decodes a byte string of roots into its parts.
		@return bytes32[] An array of bytes32 merkle roots
	 */
	function decodeRoots(bytes calldata roots) internal view returns (bytes32[] memory) {
		bytes32[] memory decodedRoots = new bytes32[](maxEdges + 1);
		for (uint i = 0; i <= maxEdges; i++) {
			decodedRoots[i] = bytes32(roots[32*i : 32*(i+1)]);
		}

		return decodedRoots;
	}
}
