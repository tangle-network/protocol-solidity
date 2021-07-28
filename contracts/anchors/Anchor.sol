/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: LGPL-3.0-only
 */

pragma solidity ^0.8.0;

import "../trees/MerkleTreeMiMC.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IVerifier {
  function verifyProof(bytes memory _proof, uint256[6] memory _input) external returns (bool);
}

abstract contract Anchor is MerkleTreeMiMC, ReentrancyGuard {
  address public bridge;
  address public admin;
  address public handler;

  IVerifier public immutable verifier;
  uint256 public immutable denomination;
  uint256 public immutable maxRoots;
  struct Edge {
    uint256 chainID;
    bytes32 root;
    uint256 height;
  }

  // maps anchor sourceChainIDs to the index in the edge list
  mapping(uint256 => uint256) public edgeIndex;
  mapping(uint256 => bool) public edgeExistsForChain;
  Edge[] public edgeList;

  // map to store used nullifier hashes
  mapping(bytes32 => bool) public nullifierHashes;
  // map to store all commitments to prevent accidental deposits with the same commitment
  mapping(bytes32 => bool) public commitments;

  // map to store the history of root updates
  mapping(uint => bytes32[]) public rootHistory;
  // pruning length for root history (i.e. the # of history items to persist)
  uint pruningLength;
  // the latest history index that represents the next index to store history at % pruningLength
  uint latestHistoryIndex;

  // currency events
  event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
  event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee);
  // bridge events
  event EdgeAddition(uint256 chainID, uint256 height, bytes32 merkleRoot);
  event EdgeUpdate(uint256 chainID, uint256 height, bytes32 merkleRoot);
  event RootHistoryRecorded(uint timestamp, bytes32[] roots);
  event RootHistoryUpdate(uint timestamp, bytes32[] roots);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of hash contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _maxRoots
  ) MerkleTreeMiMC(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    denomination = _denomination;
    maxRoots = _maxRoots;
    // TODO: Handle pruning length in function signature
    pruningLength = 100;
    latestHistoryIndex = 0;
    // TODO: Parameterize max rooots (length of array should be max roots)
    rootHistory[latestHistoryIndex] = new bytes32[](_maxRoots);
  }

  /**
    @dev Deposit funds into the contract. The caller must send (for ETH) or approve (for ERC20) value equal to or `denomination` of this instance.
    @param _commitment the note commitment, which is PedersenHash(nullifier + secret)
  */
  function deposit(bytes32 _commitment) external payable nonReentrant {
    require(!commitments[_commitment], "The commitment has been submitted");

    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    _processDeposit();

    emit Deposit(_commitment, insertedIndex, block.timestamp);
  }

  /** @dev this function is defined in a child contract */
  function _processDeposit() internal virtual;

  /**
    @dev Withdraw a deposit from the contract. `proof` is a zkSNARK proof data, and input is an array of circuit public inputs
    `input` array consists of:
      - merkle root of all deposits in the contract
      - hash of unique deposit nullifier to prevent double spends
      - the recipient of funds
      - optional fee that goes to the transaction sender (usually a relay)
  */
  function withdraw(
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) external payable nonReentrant {
    require(_fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_nullifierHash], "The note has been already spent");
    require(isKnownRoot(_root), "Cannot find your merkle root"); // Make sure to use a recent one
    address rec = address(_recipient);
    address rel = address(_relayer);
    require(
      verifier.verifyProof(
        _proof,
        [uint256(_root), uint256(_nullifierHash), uint256(uint160(rec)), uint256(uint160(rel)), _fee, _refund]
      ),
      "Invalid withdraw proof"
    );

    nullifierHashes[_nullifierHash] = true;
    _processWithdraw(_recipient, _relayer, _fee, _refund);
    emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);
  }

  /** @dev this function is defined in a child contract */
  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal virtual;

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  /** @dev whether an array of notes is already spent */
  function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory spent) {
    spent = new bool[](_nullifierHashes.length);
    for (uint256 i = 0; i < _nullifierHashes.length; i++) {
      if (isSpent(_nullifierHashes[i])) {
        spent[i] = true;
      }
    }
  }
  /** @dev */
  function getLatestNeighborRoots() public view returns (bytes32[] memory roots) {
    roots = new bytes32[](maxRoots);
    for (uint256 i = 0; i < edgeList.length; i++) {
      roots[i] = edgeList[i].root;
    }
  }

  function hasEdge(uint256 chainID) public view returns (bool) {
    return edgeExistsForChain[chainID];
  }

  modifier onlyAdmin()  {
    require(msg.sender == admin, 'sender is not the admin');
    _;
  }

  modifier onlyBridge()  {
    require(msg.sender == bridge, 'sender is not the bridge');
    _;
  }

  modifier onlyHandler()  {
    require(msg.sender == handler, 'sender is not the handler');
    _;
  }
}
