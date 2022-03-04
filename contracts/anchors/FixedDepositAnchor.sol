/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "../interfaces/IVerifier.sol";
import "../interfaces/IFixedDepositAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./AnchorBase.sol";

contract FixedDepositAnchor is AnchorBase, IFixedDepositAnchor {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  address public immutable token;
  uint256 public immutable denomination;

  // currency events
  event Deposit(address sender, uint32 indexed leafIndex, bytes32 indexed commitment, uint256 timestamp);
  event Withdrawal(address to, address indexed relayer, uint256 fee);
  event Refresh(bytes32 indexed commitment, bytes32 nullifierHash, uint32 insertedIndex);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of hash contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    address _handler,
    ITokenWrapper _token,
    IAnchorVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint8 _maxEdges
  ) AnchorBase(_handler, _verifier, _hasher, _merkleTreeHeight, _maxEdges) {
    require(_denomination > 0, "denomination should be greater than 0");
    denomination = _denomination;
    token = address(_token);
  }

  function deposit(bytes32 _commitment) override public payable {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    uint32 insertedIndex = insert(_commitment);
    IMintableERC20(token).transferFrom(msg.sender, address(this), denomination);
    emit Deposit(msg.sender, insertedIndex, _commitment, block.timestamp);
  }

  function _isValidExtDataHash(ExtData calldata _extData, bytes32 _extDataHash) internal pure returns (bool) {
    bytes memory _extData = abi.encode(_extData._refreshCommitment, _extData._recipient, _extData._relayer, _extData._fee, _extData._refund);

    return (uint256(_extDataHash) == uint256(keccak256(_extData)) % FIELD_SIZE);
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
    Proof calldata _proof,
    ExtData calldata _extData
  ) override external payable nonReentrant {
    require(_extData._fee <= denomination, "Fee exceeds transfer value");
    require(!isSpent(_proof._nullifierHash), "The note has been already spent");
    require(_isValidExtDataHash(_extData, _proof._extDataHash), "extDataHash is invalid");
    bytes calldata proof = _proof.proof;    
    (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(_proof);

    require(isValidRoots(roots), "Invalid roots");
    require(verify(proof, encodedInput), "Invalid withdraw proof");
    nullifierHashes[_proof._nullifierHash] = true;
    if (_extData._refreshCommitment == bytes32(0x00)) {
      processWithdraw(
        _extData._recipient,
        _extData._relayer,
        _extData._fee,
        _extData._refund
      );
    } else {
      require(!commitments[_extData._refreshCommitment], "The commitment has been submitted");
      uint32 insertedIndex = _insert(_extData._refreshCommitment);
      commitments[_extData._refreshCommitment] = true;
      emit Refresh(
        _extData._refreshCommitment,
        _proof._nullifierHash,
        insertedIndex
      );
    }
  }

  function processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal {
    require(msg.value == _refund, "Incorrect refund amount received by the contract");

    uint balance = IERC20(token).balanceOf(address(this));
    
    if (balance >= denomination) {
      // transfer tokens when balance exists
      IERC20(token).safeTransfer(_recipient, denomination - _fee);
      if (_fee > 0) {
        IERC20(token).safeTransfer(_relayer, _fee);
      }
    } else {
      // mint tokens when not enough balance exists
      IMintableERC20(token).mint(_recipient, denomination - _fee);
      if (_fee > 0) {
        IMintableERC20(token).mint(_relayer, _fee);
      }
    }

    emit Withdrawal(_recipient, _relayer, _fee);

    if (_refund > 0) {
      (bool success, ) = _recipient.call{ value: _refund }("");
      if (!success) {
        // let's return _refund back to the relayer
        _relayer.transfer(_refund);
      }
    }
  }

  function wrapToken(address tokenAddress, uint256 amount) public {
    ITokenWrapper(token).wrapFor(msg.sender, tokenAddress, amount);
  }

  function unwrapIntoToken(address tokenAddress, uint256 amount) public {
    ITokenWrapper(token).unwrapFor(msg.sender, tokenAddress, amount);
  }

  function wrapNative() payable public {
    ITokenWrapper(token).wrapFor{value: msg.value}(msg.sender, address(0), 0);
  }

  function unwrapIntoNative(address tokenAddress, uint256 amount) public {
    ITokenWrapper(token).unwrapFor(msg.sender, tokenAddress, amount);
  }

  function wrapAndDeposit(
    address tokenAddress,
    bytes32 _commitment
  ) payable public {
    require(!commitments[_commitment], "The commitment has been submitted");
    // wrap into the token and send directly to this contract
    if (tokenAddress == address(0)) {
        require(msg.value == ITokenWrapper(token).getAmountToWrap(denomination));
        ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
            msg.sender,
            tokenAddress,
            0,
            address(this)
        );
    }
    else {
        ITokenWrapper(token).wrapForAndSendTo(
            msg.sender,
            tokenAddress,
            ITokenWrapper(token).getAmountToWrap(denomination),
            address(this)
        );
    }
    // insert a new commitment to the tree
    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    // emit the deposit event
    emit Deposit(msg.sender, insertedIndex, _commitment, block.timestamp);
  }

  function withdrawAndUnwrap(
    Proof calldata _proof,
    ExtData calldata _extData,
    address tokenAddress
  ) external payable nonReentrant {
    require(_extData._fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_proof._nullifierHash], "The note has been already spent");
    require(_isValidExtDataHash(_extData, _proof._extDataHash), "extDataHash is invalid");

    (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(_proof);
    bytes calldata proof = _proof.proof;

    require(isValidRoots(roots), "Invalid roots");
    require(verify(proof, encodedInput), "Invalid withdraw proof");

    nullifierHashes[_proof._nullifierHash] = true;

    processWithdraw(
      payable(address(this)),
      _extData._relayer,
      _extData._fee,
      _extData._refund
    );
    
    ITokenWrapper(token).unwrapAndSendTo(
      tokenAddress,
      denomination - _extData._fee,
      address(_extData._recipient)
    );
  }

  function getDenomination() override  external view returns (uint) {
    return denomination;
  }

  function getToken() override  external view returns (address) {
    return token;
  }

  function _encodeInputs(
    Proof calldata _proof
  ) internal view returns (bytes memory, bytes32[] memory) {
    bytes memory encodedInput = abi.encodePacked(
      uint256(_proof._nullifierHash),
      uint256(_proof._extDataHash),
      uint256(getChainIdType()),
      _proof._roots
    );

    bytes32[] memory result = decodeRoots(_proof._roots);

    return (encodedInput, result);
  }

  function getProposalNonce() public view returns (uint32) {
    return proposalNonce;
  }
}
