/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../interfaces/ITokenWrapper.sol";
import "../../interfaces/IMintableERC20.sol";
import "../../interfaces/IVerifier.sol";
import "../../interfaces/IFixedDepositAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./AnchorBaseV2.sol";

contract FixedDepositAnchorV2 is AnchorBaseV2, IFixedDepositAnchor {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  address public immutable token;
  uint256 public immutable denomination;
  // currency events
  event Deposit(address sender, bytes32 indexed commitment, uint256 timestamp);
  event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee);
  event Refresh(bytes32 indexed commitment, bytes32 nullifierHash, uint32 insertedIndex);

  struct EncodeInputsData {
    bytes32 _nullifierHash;
    bytes32 _refreshCommitment;
    address _recipient;
    address _relayer;
    uint256 _fee;
    uint256 _refund;
  }
  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _hasher the address of hash contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
  */
  constructor(
    ITokenWrapper _token,
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint8 _maxEdges
  ) AnchorBaseV2(_verifier, _hasher, _merkleTreeHeight, _maxEdges) {
    require(_denomination > 0, "denomination should be greater than 0");
    denomination = _denomination;
    token = address(_token);
  }

  function deposit(bytes32 _commitment) override public payable {
    insert(_commitment);
    emit Deposit(msg.sender, _commitment, block.timestamp);
  }


  function _processInsertion() internal override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    IMintableERC20(token).transferFrom(msg.sender, address(this), denomination);
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
  ) override external payable nonReentrant {
    require(_publicInputs._fee <= denomination, "Fee exceeds transfer value");
    require(!isSpent(_publicInputs._nullifierHash), "The note has been already spent");

    (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(
      _publicInputs._roots,
      EncodeInputsData(
        _publicInputs._nullifierHash,
        _publicInputs._refreshCommitment,
        address(_publicInputs._recipient),
        address(_publicInputs._relayer),
        _publicInputs._fee,
        _publicInputs._refund
      )
    );

    require(isValidRoots(roots), "Invalid roots");
    require(verify(_proof, encodedInput), "Invalid withdraw proof");

    nullifierHashes[_publicInputs._nullifierHash] = true;

    if (_publicInputs._refreshCommitment == bytes32(0x00)) {
      processWithdraw(
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
    emit Deposit(msg.sender, _commitment, block.timestamp);
  }

  function withdrawAndUnwrap(
    bytes calldata _proof,
    PublicInputs calldata _publicInputs,
    address tokenAddress
  ) external payable nonReentrant {
    require(_publicInputs._fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_publicInputs._nullifierHash], "The note has been already spent");

    (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(
      _publicInputs._roots,
      EncodeInputsData(
        _publicInputs._nullifierHash,
        _publicInputs._refreshCommitment,
        address(_publicInputs._recipient),
        address(_publicInputs._relayer),
        _publicInputs._fee,
        _publicInputs._refund
      )
    );

    require(isValidRoots(roots), "Invalid roots");
    require(verify(_proof, encodedInput), "Invalid withdraw proof");

    nullifierHashes[_publicInputs._nullifierHash] = true;

    processWithdraw(
      payable(address(this)),
      _publicInputs._relayer,
      _publicInputs._fee,
      _publicInputs._refund
    );
    
    ITokenWrapper(token).unwrapAndSendTo(
      tokenAddress,
      denomination - _publicInputs._fee,
      address(_publicInputs._recipient)
    );

    emit Withdrawal(
      _publicInputs._recipient,
      _publicInputs._nullifierHash,
      _publicInputs._relayer,
      _publicInputs._fee
    );
  }

  

  


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

  function getDenomination() override  external view returns (uint) {
    return denomination;
  }

  function getToken() override  external view returns (address) {
    return token;
  }

  function _encodeInputs(
    bytes calldata _roots,
    EncodeInputsData memory encodeDataInput
  ) internal view returns (bytes memory, bytes32[] memory) {
    bytes memory encodedInput = abi.encodePacked(
      uint256(encodeDataInput._nullifierHash),
      uint256(uint160(encodeDataInput._recipient)),
      uint256(uint160(encodeDataInput._relayer)),
      uint256(encodeDataInput._fee),
      uint256(encodeDataInput._refund),
      uint256(encodeDataInput._refreshCommitment),
      uint256(getChainId()),
      _roots
    );

    bytes32[] memory result = decodeRoots(_roots);

    return (encodedInput, result);
  }
}
