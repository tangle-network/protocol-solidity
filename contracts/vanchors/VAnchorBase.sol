/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { IAnchorVerifier } from "../interfaces/IAnchorVerifier.sol";
import "../trees/VMerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libs/VAnchorEncodeInputs.sol";


/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */
abstract contract VAnchorBase is VMerkleTreeWithHistory, ReentrancyGuard {

  PermissionedAccounts public permissions;
  uint8 public immutable maxEdges;

  struct PermissionedAccounts {
    address bridge;
    address admin;
    address handler;
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

  // bridge events
  event EdgeAddition(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);
  event EdgeUpdate(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot);

  //end of new stuff

  int256 public constant MAX_EXT_AMOUNT = 2**248;
  uint256 public constant MAX_FEE = 2**248;

  IAnchorVerifier public verifier;

  uint256 public lastBalance;
  uint256 public minimalWithdrawalAmount;
  uint256 public maximumDepositAmount;
  mapping(bytes32 => bool) public nullifierHashes;

  struct ExtData {
    address recipient;
    int256 extAmount;
    address relayer;
    uint256 fee;
    bytes encryptedOutput1;
    bytes encryptedOutput2;
  }

  struct Account {
    address owner;
    bytes publicKey;
  }

  event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput);
  event NewNullifier(bytes32 nullifier);
  event PublicKey(address indexed owner, bytes key);

  // modifier onlyGovernance() {
  //   require(isCalledByOwner(), "only governance");
  //   _;
  // }

  /**
    @dev The constructor
    @param _verifier the addresses of SNARK verifiers for 2 inputs and 16 inputs
    @param _levels hight of the commitments merkle tree
    @param _hasher hasher address for the merkle tree
  */
  constructor(
    IAnchorVerifier _verifier,
    uint32 _levels,
    address _hasher,
    uint8 _maxEdges
  )
    VMerkleTreeWithHistory(_levels, _hasher)
  {
    verifier = _verifier;
    maxEdges = _maxEdges;
  }

  function initialize(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external initializer {
    _configureLimits(_minimalWithdrawalAmount, _maximumDepositAmount);
    super._initialize();
  }

  /** @dev this function is defined in a child contract */
  function _processDeposit(
    uint256 _extAmount
  ) internal virtual;

  /** @dev Main function that allows deposits, transfers and withdrawal.
   */
  function transact(VAnchorEncodeInputs.Proof memory _args, ExtData memory _extData) public {
    if (_extData.extAmount > 0) {
      // for deposits from L2
      _processDeposit(uint256(_extData.extAmount));
      require(uint256(_extData.extAmount) <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
    }

    _transact(_args, _extData);
  }

  function register(Account memory _account) public {
    require(_account.owner == msg.sender, "only owner can be registered");
    _register(_account);
  }

  function registerAndTransact(
    Account memory _account,
    VAnchorEncodeInputs.Proof memory _proofArgs,
    ExtData memory _extData
  ) public {
    register(_account);
    transact(_proofArgs, _extData);
  }

  function configureLimits(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) public onlyAdmin {
    _configureLimits(_minimalWithdrawalAmount, _maximumDepositAmount);
  }

  function calculatePublicAmount(int256 _extAmount, uint256 _fee) public pure returns (uint256) {
    require(_fee < MAX_FEE, "Invalid fee");
    require(_extAmount > -MAX_EXT_AMOUNT && _extAmount < MAX_EXT_AMOUNT, "Invalid ext amount");
    int256 publicAmount = _extAmount - int256(_fee);
    return (publicAmount >= 0) ? uint256(publicAmount) : FIELD_SIZE - uint256(-publicAmount);
  }

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  function _register(Account memory _account) internal {
    emit PublicKey(_account.owner, _account.publicKey);
  }

  /** @dev this function is defined in a child contract */
  //removed payable from address might need to add it back if things don't work
  function _processWithdraw(
    address  _recipient,
    uint256 _minusExtAmount
  ) internal virtual;

  /** similar to _processWithdraw. Is defined in a child contract */
  function _processFee(
    address  _relayer,
    uint256 _fee
  ) internal virtual;

  function _transact(VAnchorEncodeInputs.Proof memory _args, ExtData memory _extData) internal nonReentrant {
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
    require(_args.publicAmount == calculatePublicAmount(_extData.extAmount, _extData.fee), "Invalid public amount");

    if (_args.inputNullifiers.length == 2) {
      (bytes memory encodedInput, bytes32[] memory roots) = VAnchorEncodeInputs._encodeInputs2(_args, maxEdges);
      require(isValidRoots(roots), "Invalid roots");
      require(verify2(_args.proof, encodedInput), "Invalid transaction proof");
    } else if (_args.inputNullifiers.length == 16) {
      (bytes memory encodedInput, bytes32[] memory roots) = VAnchorEncodeInputs._encodeInputs16(_args, maxEdges);
      require(isValidRoots(roots), "Invalid roots");
      require(verify16(_args.proof, encodedInput), "Invalid transaction proof");
    } else {
      revert("unsupported input count");
    }

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      // sets the nullifier for the input UTXO to spent
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    if (_extData.extAmount < 0) {
      require(_extData.recipient != address(0), "Can't withdraw to zero address");
      require(uint256(-_extData.extAmount) >= minimalWithdrawalAmount, "amount is less than minimalWithdrawalAmount"); // prevents ddos attack to Bridge
      _processWithdraw(_extData.recipient, uint256(-_extData.extAmount));
    }
    if (_extData.fee > 0) {
      _processFee(_extData.relayer, _extData.fee);
    }

    //lastBalance = token.balanceOf(address(this));
    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }

  function _configureLimits(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) internal {
    minimalWithdrawalAmount = _minimalWithdrawalAmount;
    maximumDepositAmount = _maximumDepositAmount;
  }

  modifier onlyAdmin()  {
    require(msg.sender == permissions.admin, 'sender is not the admin');
    _;
  }

  modifier onlyBridge()  {
    require(msg.sender == permissions.bridge, 'sender is not the bridge');
    _;
  }

  modifier onlyHandler()  {
    require(msg.sender == permissions.handler, 'sender is not the handler');
    _;
  }

  /** @dev */
  function getLatestNeighborEdges() public view returns (Edge[] memory edges) {
    edges = new Edge[](maxEdges);
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

  function verify2(
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
      maxEdges,
      true
    );
    require(r, "Invalid withdraw proof");
    return r;
  }

  function verify16(
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
      maxEdges,
      false
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
}