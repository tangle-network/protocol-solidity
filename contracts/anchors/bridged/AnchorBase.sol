/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../trees/MerkleTreePoseidon.sol";
import "../../interfaces/IVerifier.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

abstract contract AnchorBase is MerkleTreePoseidon, ReentrancyGuard {
  address public bridge;
  address public admin;
  address public handler;

  IVerifier public immutable verifier;
  uint256 public immutable denomination;
  uint8 public immutable maxEdges;

  struct PublicInputs {
    bytes _roots;
    bytes32 _nullifierHash;
    bytes32 _refreshCommitment;
    address payable _recipient;
    address payable _relayer;
    uint256 _fee;
    uint256 _refund;
  }

  struct Edge {
    uint256 chainID;
    bytes32 root;
    uint256 latestLeafIndex;
  }

  // maps sourceChainID to the index in the edge list
  mapping(uint256 => uint256) public edgeIndex;
  mapping(uint256 => bool) public edgeExistsForChain;
  Edge[] public edgeList;

  // map to store chainID => (rootIndex => root) to track neighbor histories
  mapping(uint256 => mapping(uint32 => bytes32)) public neighborRoots;
  // map to store the current historical root index for a chainID
  mapping(uint256 => uint32) public currentNeighborRootIndex;

  // map to store used nullifier hashes
  mapping(bytes32 => bool) public nullifierHashes;
  // map to store all commitments to prevent accidental deposits with the same commitment
  mapping(bytes32 => bool) public commitments;


  // the latest history index that represents the next index to store history
  uint latestHistoryIndex;

  // currency events
  event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
  event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee);
  event Refresh(bytes32 indexed commitment, bytes32 nullifierHash, uint32 insertedIndex);
  // bridge events
  event EdgeAddition(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);
  event EdgeUpdate(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);

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
    uint8 _maxEdges
  ) MerkleTreePoseidon(_merkleTreeHeight, _hasher) {
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    denomination = _denomination;
    latestHistoryIndex = 0;
    maxEdges = _maxEdges;
  }

  /**
    @dev Deposit funds into the contract. The caller must send (for ETH) or approve (for ERC20) value equal to or `denomination` of this instance.
    @param _commitment the note commitment = Poseidon(chainId, nullifier, secret)
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

  function _encodeInputs(
    bytes memory _roots,
    bytes32 _nullifierHash,
    bytes32 _refreshCommitment,
    address _recipient,
    address _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal view returns (bytes memory, bytes32[] memory) {
    uint256 _chainId = getChainId();
    bytes32[] memory result = new bytes32[](maxEdges + 1);
    bytes memory encodedInput;

    if (maxEdges == 1) {
      uint256[9] memory inputs;
      bytes32[2] memory roots = abi.decode(_roots, (bytes32[2]));
      // assign roots
      result[0] = roots[0];
      result[1] = roots[1];
      // assign input
      inputs[0] = uint256(_nullifierHash);
      inputs[1] = uint256(uint160(_recipient));
      inputs[2] = uint256(uint160(_relayer));
      inputs[3] = uint256(_fee);
      inputs[4] = uint256(_refund);
      inputs[5] = uint256(_chainId);
      inputs[6] = uint256(roots[0]);
      inputs[7] = uint256(roots[1]);
      inputs[8] = uint256(_refreshCommitment);
      encodedInput = abi.encodePacked(inputs);
    } else if (maxEdges == 2) {
      uint256[10] memory inputs;
      bytes32[3] memory roots = abi.decode(_roots, (bytes32[3]));
      // assign roots
      result[0] = roots[0];
      result[1] = roots[1];
      result[2] = roots[2];
      // assign input
      inputs[0] = uint256(_nullifierHash);
      inputs[1] = uint256(uint160(_recipient));
      inputs[2] = uint256(uint160(_relayer));
      inputs[3] = uint256(_fee);
      inputs[4] = uint256(_refund);
      inputs[5] = uint256(_chainId);
      inputs[6] = uint256(roots[0]);
      inputs[7] = uint256(roots[1]);
      inputs[8] = uint256(roots[2]);
      inputs[9] = uint256(_refreshCommitment);
      encodedInput = abi.encodePacked(inputs);
    } else if (maxEdges == 3) {
      uint256[11] memory inputs;
      bytes32[4] memory roots = abi.decode(_roots, (bytes32[4]));
      // assign roots
      result[0] = roots[0];
      result[1] = roots[1];
      result[2] = roots[2];
      result[3] = roots[3];
      // assign input
      inputs[0] = uint256(_nullifierHash);
      inputs[1] = uint256(uint160(_recipient));
      inputs[2] = uint256(uint160(_relayer));
      inputs[3] = uint256(_fee);
      inputs[4] = uint256(_refund);
      inputs[5] = uint256(_chainId);
      inputs[6] = uint256(roots[0]);
      inputs[7] = uint256(roots[1]);
      inputs[8] = uint256(roots[2]);
      inputs[9] = uint256(roots[3]);
      inputs[10] = uint256(_refreshCommitment);
      encodedInput = abi.encodePacked(inputs);
    } else if (maxEdges == 4) {
      uint256[12] memory inputs;
      bytes32[5] memory roots = abi.decode(_roots, (bytes32[5]));
      // assign roots
      result[0] = roots[0];
      result[1] = roots[1];
      result[2] = roots[2];
      result[3] = roots[3];
      result[4] = roots[4];
      // assign input
      inputs[0] = uint256(_nullifierHash);
      inputs[1] = uint256(uint160(_recipient));
      inputs[2] = uint256(uint160(_relayer));
      inputs[3] = uint256(_fee);
      inputs[4] = uint256(_refund);
      inputs[5] = uint256(_chainId);
      inputs[6] = uint256(roots[0]);
      inputs[7] = uint256(roots[1]);
      inputs[8] = uint256(roots[2]);
      inputs[9] = uint256(roots[3]);
      inputs[10] = uint256(roots[4]);
      inputs[11] = uint256(_refreshCommitment);
      encodedInput = abi.encodePacked(inputs);
    } else if (maxEdges == 5) {
      uint256[13] memory inputs;
      bytes32[6] memory roots = abi.decode(_roots, (bytes32[6]));
      // assign roots
      result[0] = roots[0];
      result[1] = roots[1];
      result[2] = roots[2];
      result[3] = roots[3];
      result[4] = roots[4];
      result[5] = roots[5];
      // assign input
      inputs[0] = uint256(_nullifierHash);
      inputs[1] = uint256(uint160(_recipient));
      inputs[2] = uint256(uint160(_relayer));
      inputs[3] = uint256(_fee);
      inputs[4] = uint256(_refund);
      inputs[5] = uint256(_chainId);
      inputs[6] = uint256(roots[0]);
      inputs[7] = uint256(roots[1]);
      inputs[8] = uint256(roots[2]);
      inputs[9] = uint256(roots[3]);
      inputs[10] = uint256(roots[4]);
      inputs[11] = uint256(roots[5]);
      inputs[12] = uint256(_refreshCommitment);
      encodedInput = abi.encodePacked(inputs);
    } else {
      require(false, "Invalid edges");
    }

    return (encodedInput, result);
  }

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
    PublicInputs calldata _publicInputs
  ) external payable nonReentrant {
    require(_publicInputs._fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_publicInputs._nullifierHash], "The note has been already spent");

    (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(
      _publicInputs._roots,
      _publicInputs._nullifierHash,
      _publicInputs._refreshCommitment,
      address(_publicInputs._recipient),
      address(_publicInputs._relayer),
      _publicInputs._fee,
      _publicInputs._refund
    );

    require(isValidRoots(roots), "Invalid roots");
    require(verify(_proof, encodedInput), "Invalid withdraw proof");

    nullifierHashes[_publicInputs._nullifierHash] = true;

    if (_publicInputs._refreshCommitment == bytes32(0x00)) {
      _processWithdraw(
        _publicInputs._recipient,
        _publicInputs._relayer,
        _publicInputs._fee,
        _publicInputs._refund
      );
      emit Withdrawal(_publicInputs._recipient,
        _publicInputs._nullifierHash,
        _publicInputs._relayer,
        _publicInputs._fee
      );
    } else {
      require(!commitments[_publicInputs._refreshCommitment], "The commitment has been submitted");
      uint32 insertedIndex = _insert(_publicInputs._refreshCommitment);
      commitments[_publicInputs._refreshCommitment] = true;
      emit Refresh(
        _publicInputs._refreshCommitment,
        _publicInputs._nullifierHash,
        insertedIndex
      );
    }
  }

  function verify(
    bytes memory _proof,
    bytes memory _input
  ) internal view returns (bool r) {
    uint256[8] memory p = abi.decode(_proof, (uint256[8]));
    (
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c
    ) = unpackProof(p);
    r = verifier.verifyProof(
      a, b, c,
      _input,
      maxEdges
    );
    require(r, "Invalid withdraw proof");
    return r;
  }

  /*
  * A helper function to convert an array of 8 uint256 values into the a, b,
  * and c array values that the zk-SNARK verifier's verifyProof accepts.
  */
  function unpackProof(
      uint256[8] memory _proof
  ) public pure returns (
      uint256[2] memory,
      uint256[2][2] memory,
      uint256[2] memory
  ) {
    return (
      [_proof[0], _proof[1]],
      [
        [_proof[2], _proof[3]],
        [_proof[4], _proof[5]]
      ],
      [_proof[6], _proof[7]]
    );
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
    roots = new bytes32[](maxEdges);
    for (uint256 i = 0; i < maxEdges; i++) {
      if (edgeList.length >= i + 1) {
        roots[i] = edgeList[i].root;
      } else {
        // merkle tree height for zeros
        roots[i] = zeros(levels);
      }
    }
    
  }

  /** @dev */
  function isKnownNeighborRoot(uint256 neighborChainID, bytes32 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }
    uint32 _currentRootIndex = currentNeighborRootIndex[neighborChainID];
    uint32 i = _currentRootIndex;
    do {
      if (_root == neighborRoots[neighborChainID][i]) {
        return true;
      }
      if (i == 0) {
        i = ROOT_HISTORY_SIZE;
      }
      i--;
    } while (i != _currentRootIndex);
    return false;
  }

  function isValidRoots(bytes32[] memory roots) public view returns (bool) {
    require(isKnownRoot(roots[0]), "Cannot find your merkle root");
    require(roots.length == maxEdges + 1, "Incorrect root array length");
    for (uint i = 0; i < edgeList.length; i++) {
      Edge memory _edge = edgeList[i];
      require(isKnownNeighborRoot(_edge.chainID, roots[i+1]), "Neighbor root not found");
    }
    return true;
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

  function getChainId() internal view returns (uint) {
    uint chainId;
    assembly { chainId := chainid() }
    return chainId;
  }
}
