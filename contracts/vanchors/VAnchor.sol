/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "./LinkableVAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract VAnchor is LinkableVAnchor {
  using SafeERC20 for IERC20;
  address public immutable token;

  constructor(
    IVAnchorVerifier _verifier,
    uint32 _levels,
    address _hasher,
    address _token,
    PermissionedAccounts memory _permissions,
    uint8 _maxEdges
  ) LinkableVAnchor(
    _verifier,
    _levels,
    _hasher,
    _permissions,
    _maxEdges
  ) {token = _token;}


  function wrapAndDeposit(
    address tokenAddress,
    uint256 _extAmount
  ) payable public {
    // wrap into the token and send directly to this contract
    if (tokenAddress == address(0)) {
        require(msg.value == _extAmount);
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
            _extAmount,
            address(this)
        );
    }
    //Any events that need to be emitted
  }

  function withdrawAndUnwrap(
    address tokenAddress,
    address recipient,
    uint256 _minusExtAmount
  ) public payable nonReentrant {
    ITokenWrapper(token).unwrapAndSendTo(
    tokenAddress,
    _minusExtAmount,
    recipient
    );
  }

  function transactWrap(
    Proof memory _args,
    ExtData memory _extData,
    address tokenAddress
  ) external payable nonReentrant {
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      require(!isSpent(_args.inputNullifiers[i]), "Input is already spent");
    }
    require(uint256(_args.extDataHash) == uint256(keccak256(abi.encode(_extData))) % FIELD_SIZE, "Incorrect external data hash");
    require(_args.publicAmount == calculatePublicAmount(_extData.extAmount, _extData.fee), "Invalid public amount");

    if (_args.inputNullifiers.length == 2) {
      (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs2(_args);
      require(isValidRoots(roots), "Invalid roots");
      require(verify2(_args.proof, encodedInput), "Invalid transaction proof");
    } else if (_args.inputNullifiers.length == 16) {
      (bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs16(_args);
      require(isValidRoots(roots), "Invalid roots");
      require(verify16(_args.proof, encodedInput), "Invalid transaction proof");
    } else {
      revert("unsupported input count");
    }

    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      // sets the nullifier for the input UTXO to spent
      nullifierHashes[_args.inputNullifiers[i]] = true;
    }

    //Check if extAmount > 0, call wrapAndDeposit
    if (_extData.extAmount > 0) {
      //wrapAndDeposit
      wrapAndDeposit(tokenAddress, uint256(_extData.extAmount));
    } 
    //Otherwise, check if extAmount < 0, call withdrawAndUnwrap
    if (_extData.extAmount < 0) {
      //withdrawAndUnwrap
      withdrawAndUnwrap(tokenAddress, _extData.recipient, uint256(-_extData.extAmount));
    }

    if (_extData.fee > 0) {
      //Do something
      _processFee(_extData.relayer, _extData.fee);
    }

    _insert(_args.outputCommitments[0], _args.outputCommitments[1]);
    emit NewCommitment(_args.outputCommitments[0], nextIndex - 2, _extData.encryptedOutput1);
    emit NewCommitment(_args.outputCommitments[1], nextIndex - 1, _extData.encryptedOutput2);
    for (uint256 i = 0; i < _args.inputNullifiers.length; i++) {
      emit NewNullifier(_args.inputNullifiers[i]);
    }
  }

  function _processDeposit(uint256 _extAmount) internal override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    IMintableERC20(token).transferFrom(msg.sender, address(this), _extAmount);
  }

  function _processWithdraw(
    address _recipient,
    uint256 _minusExtAmount
  ) internal override {

    uint balance = IERC20(token).balanceOf(address(this));
    if (balance >= _minusExtAmount) {
      // transfer tokens when balance exists
      IERC20(token).safeTransfer(_recipient, _minusExtAmount);
    } else {
      // mint tokens when not enough balance exists
      IMintableERC20(token).mint(_recipient, _minusExtAmount);
    }
  }

  function _processFee(
    address  _relayer,
    uint256 _fee
  ) internal override {
    uint balance = IERC20(token).balanceOf(address(this));
    if (_fee > 0) {
      if (balance >= _fee) {
        // transfer tokens when balance exists
        IERC20(token).safeTransfer(_relayer, _fee);
      }
      else {
        IMintableERC20(token).mint(_relayer, _fee);
      }
    }
  }
}
