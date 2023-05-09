/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../../structs/Edge.sol";
import "../../hashers/IHasher.sol";
import "../../utils/ChainIdWithType.sol";
import "../../utils/ProposalNonceTracker.sol";
import "../../interfaces/ILinkableAnchor.sol";
import "../../interfaces/IMerkleSystem.sol";

/**
    @title The LinkableAnchor contract
    @author Webb Technologies
    @notice The LinkableAnchor contract extends the MerkleTreePoseidon contract
    with a graph-like interface for linking to other LinkableAnchors. Links
    between these trees are represented as directed edges (since updates occur
    on one contract per transaction). The edge data is maintained as a record of the:
    - Chain id that the edge points to
    - Latest merkle root of the MerkleTreePoseidon contract being linked
    - Latest leaf insertion index (used as a nonce) of the linked merkle tree.

    Updating the state of the LinkableAnchor's edges is done through the handler
    architecture defined originally by ChainSafe's ChainBridge system. In our case,
    we employ a handler to propagate updates to a LinkableAnchor contract. For example,
    the handler can be connected to an oracle system, signature system, or any other
    bridge system to provide the state of the neighboring LinkableAnchor's edge data.

    The LinkableAnchor contract is meant to be inherited by child contracts that
    define their own architecture around:
    1. The structure of elements being inserted into the underlying Merkle Tree
    2. The type of zkSNARK necessary for proving membership of a specific element
       in one-of-many LinkableAnchors connected in a bridge.

    An example usage of this system is the:
    - VAnchor.sol - for variable sized private bridging of assets
 */
abstract contract LinkableAnchor is
	ILinkableAnchor,
	MerkleSystem,
	ReentrancyGuard,
	ChainIdWithType,
	ProposalNonceTracker
{
	address public handler;

	// The maximum number of edges this tree can support for zero-knowledge linkability.
	uint8 public immutable maxEdges;
	uint32 public immutable outerLevels;

	// Maps sourceChainID to the index in the edge list
	mapping(uint256 => uint256) public edgeIndex;
	mapping(uint256 => bool) public edgeExistsForChain;
	Edge[] public edgeList;

	// Map to store chainID => (rootIndex => root) to track neighbor histories
	mapping(uint256 => mapping(uint32 => uint256)) public neighborRoots;
	// Map to store the current historical root index for a chainID
	mapping(uint256 => uint32) public currentNeighborRootIndex;

	// Edge linking events
	event EdgeAddition(uint256 chainID, uint256 latestLeafIndex, uint256 merkleRoot);
	event EdgeUpdate(uint256 chainID, uint256 latestLeafIndex, uint256 merkleRoot);

	/**
        @notice Checks the sender is the AnchorHandler configured on this contract
     */
	modifier onlyHandler() {
		require(msg.sender == handler, "sender is not the handler");
		_;
	}

	/**
        @notice The LinkableAnchor constructor
        @param _handler The address of the `AnchorHandler` contract
        @param _outerTreeHeight The height of outer-most merkle tree
        @param _maxEdges The maximum # of edges this linkable tree connects to
    */
	constructor(address _handler, uint32 _outerTreeHeight, uint8 _maxEdges) {
		handler = _handler;
		outerLevels = _outerTreeHeight;
		maxEdges = _maxEdges;
	}

	/**
        @notice Add an edge to the tree or update an existing edge.
        @param _root The merkle root of the edge's merkle tree
        @param _leafIndex The latest leaf insertion index of the edge's merkle tree
        @param _srcResourceID The origin resource ID of the originating linked anchor update
     */
	function updateEdge(
		uint256 _root,
		uint32 _leafIndex,
		bytes32 _srcResourceID
	) external payable override onlyHandler onlyInitialized nonReentrant {
		uint64 _srcChainID = parseChainIdFromResourceId(_srcResourceID);
		if (this.hasEdge(_srcChainID)) {
			// Require increasing nonce
			require(
				edgeList[edgeIndex[_srcChainID]].latestLeafIndex < _leafIndex,
				"LinkableAnchor: New leaf index must be greater"
			);
			// Require leaf index increase is bounded by 65,536 updates at once
			require(
				_leafIndex < edgeList[edgeIndex[_srcChainID]].latestLeafIndex + (65_536),
				"LinkableAnchor: New leaf index must be within 2^16 updates"
			);
			require(
				_srcResourceID == edgeList[edgeIndex[_srcChainID]].srcResourceID,
				"LinkableAnchor: srcResourceID must be the same"
			);
			uint index = edgeIndex[_srcChainID];
			// Update the edge in the edge list
			edgeList[index].latestLeafIndex = _leafIndex;
			edgeList[index].root = uint256(_root);
			// Add to root histories
			uint32 neighborRootIndex = (currentNeighborRootIndex[_srcChainID] + 1) %
				ROOT_HISTORY_SIZE;
			currentNeighborRootIndex[_srcChainID] = neighborRootIndex;
			neighborRoots[_srcChainID][neighborRootIndex] = _root;
			emit EdgeUpdate(_srcChainID, _leafIndex, _root);
		} else {
			// Add Edge
			require(edgeList.length < maxEdges, "LinkableAnchor: This Anchor is at capacity");
			edgeExistsForChain[_srcChainID] = true;
			uint index = edgeList.length;
			Edge memory edge = Edge({
				chainID: _srcChainID,
				root: uint256(_root),
				latestLeafIndex: _leafIndex,
				srcResourceID: _srcResourceID
			});
			edgeList.push(edge);
			edgeIndex[_srcChainID] = index;
			// add to root histories
			uint32 neighborRootIndex = 0;
			neighborRoots[_srcChainID][neighborRootIndex] = _root;
			emit EdgeAddition(_srcChainID, _leafIndex, _root);
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
					root: this.getZeroHash(outerLevels - 1),
					chainID: 0,
					latestLeafIndex: 0,
					srcResourceID: 0x0
				});
			}
		}

		return edges;
	}

	/**
        @notice Get the latest merkle roots of all neighbor edges
        @return bytes32[] An array of merkle roots
     */
	function getLatestNeighborRoots() public view returns (uint256[] memory) {
		uint256[] memory roots = new uint256[](maxEdges);
		for (uint256 i = 0; i < maxEdges; i++) {
			if (edgeList.length >= i + 1) {
				roots[i] = edgeList[i].root;
			} else {
				// merkle tree height for zeros
				roots[i] = this.getZeroHash(outerLevels - 1);
			}
		}

		return roots;
	}

	/**
        @notice Checks to see whether a `_root` is known for a neighboring `neighborChainID`
        @param _neighborChainID The chainID of the neighbor's edge
        @param _root The root to check
     */
	function isKnownNeighborRoot(
		uint256 _neighborChainID,
		uint256 _root
	) public view returns (bool) {
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
        @param _roots An array of uint256 merkle roots to be checked against the history.
     */
	function isValidRoots(uint256[] memory _roots) public view returns (bool) {
		require(this.isKnownRoot(_roots[0]), "Cannot find your merkle root");
		require(_roots.length == maxEdges + 1, "Incorrect root array length");
		uint rootIndex = 1;
		for (uint i = 0; i < edgeList.length; i++) {
			Edge memory _edge = edgeList[i];
			require(isKnownNeighborRoot(_edge.chainID, _roots[i + 1]), "Neighbor root not found");
			rootIndex++;
		}
		while (rootIndex != maxEdges + 1) {
			require(
				_roots[rootIndex] == this.getZeroHash(outerLevels - 1),
				"LinkableAnchor: non-existent edge is not set to the default root"
			);
			rootIndex++;
		}
		return true;
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
			decodedRoots[i] = bytes32(roots[32 * i:32 * (i + 1)]);
		}

		return decodedRoots;
	}
}
