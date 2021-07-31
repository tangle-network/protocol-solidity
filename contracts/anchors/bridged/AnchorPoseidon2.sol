/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "../../trees/MerkleTreePoseidon.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IVerifier {
  function verifyProof(
      bytes memory _proof,
      uint[8] memory input
  ) external view returns (bool r);
}

abstract contract AnchorPoseidon2 is MerkleTreePoseidon, ReentrancyGuard {
  address public bridge;
  address public admin;
  address public handler;

  IVerifier public immutable verifier;
  uint256 public immutable denomination;

  uint256 public immutable chainID;
  struct Edge {
    uint8 chainID;
    bytes32 resourceID;
    bytes32 root;
    uint256 height;
  }

  // maps anchor resource IDs to the index in the edge list
  mapping(bytes32 => uint256) public edgeIndex;
  mapping(uint8 => bool) public edgeExistsForChain;
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
  event EdgeAddition(uint8 chainID, bytes32 destResourceID, uint256 height, bytes32 merkleRoot);
  event EdgeUpdate(uint8 chainID, bytes32 destResourceID, uint256 height, bytes32 merkleRoot);
  event RootHistoryRecorded(uint timestamp, bytes32[1] roots);
  event RootHistoryUpdate(uint timestamp, bytes32[1] roots);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of hash contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint256 _chainID
  ) MerkleTreePoseidon(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    denomination = _denomination;
    chainID = _chainID;
    // TODO: Handle pruning length in function signature
    pruningLength = 100;
    latestHistoryIndex = 0;
    // TODO: Parameterize max roots (length of array should be max roots)
    rootHistory[latestHistoryIndex] = new bytes32[](1);
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
    bytes32[1] memory neighbors = getLatestNeighborRoots();
    // console.log(uint256(_nullifierHash));
    // console.log(uint256(uint160(rec)));
    // console.log(uint256(uint160(rel)));
    // console.log(_fee);
    // console.log(_refund);
    // console.log(uint256(chainID));
    // console.log(uint256(_root));
    // console.log(uint256(neighbors[0]));
    // console.logBytes(_proof);
    require(
      verifier.verifyProof(
        _proof,
        [
          uint256(_nullifierHash),
          uint256(uint160(rec)),
          uint256(uint160(rel)),
          _fee,
          _refund,
          uint256(chainID),
          uint256(_root),
          uint256(neighbors[0])
        ]
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
  function getLatestNeighborRoots() public view returns (bytes32[1] memory roots) {
    for (uint256 i = 0; i < 1; i++) {
      if (edgeList.length >= i + 1) {
        roots[i] = edgeList[i].root;
      } else {
        roots[i] = bytes32(0x0);
      }
    }
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
