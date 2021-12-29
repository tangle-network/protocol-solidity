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
import "../anchors/LinkableTree.sol";

/** @dev This contract(pool) allows deposit of an arbitrary amount to it, shielded transfer to another registered user inside the pool
 * and withdrawal from the pool. Project utilizes UTXO model to handle users' funds.
 */
abstract contract VAnchorBase is LinkableTree {
  uint32 proposalNonce = 0;
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
    @param _hasher hasher address for the merkle tree
  */
  constructor(
    IAnchorVerifier _verifier,
    uint32 _levels,
    IPoseidonT3 _hasher,
    address _handler,
    uint8 _maxEdges
  )
    LinkableTree(_handler, _hasher, _levels, _maxEdges)
  {
    verifier = _verifier;
  }

  function initialize(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external initializer {
    _configureLimits(_minimalWithdrawalAmount, _maximumDepositAmount);
    super._initialize();
  }

  function setVerifier(address newVerifier) onlyHandler external {
    require(newVerifier != address(0), "Handler cannot be 0");
    verifier = IAnchorVerifier(newVerifier);
  }

  function setHandler(address _handler, uint32 nonce) onlyHandler external {
    handler = _handler;
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

  function configureLimits(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) public onlyHandler {
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
    _insert(_args.outputCommitments[0]);
    _insert(_args.outputCommitments[1]);
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