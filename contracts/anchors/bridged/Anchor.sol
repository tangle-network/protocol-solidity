/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../interfaces/ITokenWrapper.sol";
import "../../interfaces/IMintableERC20.sol";
import "./LinkableAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Anchor is LinkableAnchor {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  address public immutable token;
  uint feePercentage;

  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    ITokenWrapper _token,
    address _bridge,
    address _admin,
    address _handler,
    uint8 _maxEdges
  ) LinkableAnchor(_verifier, _hasher, _denomination, _merkleTreeHeight, _bridge, _admin, _handler, _maxEdges) {
    token = address(_token);
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
    uint fee = ITokenWrapper(token).getFee(msg.value, 1);
    if (tokenAddress == address(0)) {
        require(msg.value == denomination);
        ITokenWrapper(token).wrapForAndSendTo{value: msg.value.sub(fee)}(
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
            denomination.sub(fee),
            address(this)
        );
    }
    // insert a new commitment to the tree
    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    // emit the deposit event
    emit Deposit(_commitment, insertedIndex, block.timestamp);
  }

  function withdrawAndUnwrap(
    bytes calldata _proof,
    PublicInputs memory _publicInputs,
    address tokenAddress
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

    _processWithdraw(
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

  function _processDeposit() internal override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    IMintableERC20(token).transferFrom(msg.sender, address(this), denomination);
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal override {
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

  function getToken() override external view returns (address) {
    return token;
  }
}
