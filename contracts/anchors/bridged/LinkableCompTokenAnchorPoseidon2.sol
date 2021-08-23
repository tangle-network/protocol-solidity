/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../../tokens/TokenWrapper.sol";
import "../../interfaces/ITokenWrapper.sol";
import "./LinkableAnchorPoseidon2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract LinkableCompTokenAnchorPoseidon2 is LinkableAnchorPoseidon2 {
  using SafeERC20 for IERC20;
  address public immutable token;
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

  constructor(
    IVerifier _verifier,
    IPoseidonT3 _hasher,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    uint32 _chainID,
    TokenWrapper _token
  ) LinkableAnchorPoseidon2(_verifier, _hasher, _denomination, _merkleTreeHeight, _chainID) {
    token = address(_token);
  }
  
  function wrap(address tokenAddress, uint256 amount) external {
    ITokenWrapper(token).wrap(msg.sender, tokenAddress, amount);
  }
  
  function wrapAndDeposit(address tokenAddress, bytes32 _commitment) external {
    // have to use a struct to avoid stack too deep error
    ITokenWrapper.WrapAndDepositInput memory input = ITokenWrapper.WrapAndDepositInput(
      {tokenAddress: tokenAddress, amount: denomination});
    try ITokenWrapper(token).wrapAndDeposit(msg.sender, input) 
    { 
      // deposit logic aside from _processDeposit()
      require(!commitments[_commitment], "The commitment has been submitted");
      uint32 insertedIndex = _insert(_commitment);
      commitments[_commitment] = true;
      emit Deposit(_commitment, insertedIndex, block.timestamp);
    } catch Error(string memory reason) {
      revert(reason);
    }
  }
 
  function unwrap(address tokenAddress, uint256 amount) external {
    ITokenWrapper(token).unwrap(msg.sender, tokenAddress, amount);
  }

  
  function withdrawAndUnwrap(
    address tokenAddress, 
    bytes calldata _proof,
    bytes calldata _roots,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund) external {
    //withdraws then burns then calls modified unwrap?
    bytes32[2] memory roots = abi.decode(_roots, (bytes32[2]));
    require(_fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_nullifierHash], "The note has been already spent");
    require(isKnownRoot(roots[0]), "Cannot find your merkle root");
    require(roots.length >= edgeList.length + 1, "Incorrect root array length");
    for (uint i = 0; i < edgeList.length; i++) {
      Edge memory _edge = edgeList[i];
      require(isKnownNeighborRoot(_edge.chainID, roots[i+1]), "Neighbor root not found");
    }
    address rec = address(_recipient);
    address rel = address(_relayer);

    uint256[8] memory inputs;
    inputs[0] = uint256(_nullifierHash);
    inputs[1] = uint256(uint160(rec));
    inputs[2] = uint256(uint160(rel));
    inputs[3] = uint256(_fee);
    inputs[4] = uint256(_refund);
    inputs[5] = uint256(chainID);
    inputs[6] = uint256(roots[0]);
    inputs[7] = uint256(roots[1]);
    bytes memory encodedInputs = abi.encodePacked(inputs);

    require(verify(_proof, encodedInputs), "Invalid withdraw proof");
  
    nullifierHashes[_nullifierHash] = true;
    _processWithdrawAndUnwrap(tokenAddress, _recipient, _relayer, _fee, _refund);
    emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);
  }


  function _processDeposit() internal override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    IMintableCompToken(token).transferFrom(msg.sender, address(this), denomination);
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal override {
    require(msg.value == _refund, "Incorrect refund amount received by the contract");

    if (IERC20(token).balanceOf(address(this)) == 0) {
      IMintableCompToken(token).mint(_recipient, denomination - _fee);
      if (_fee > 0) {
        IMintableCompToken(token).mint(_relayer, _fee);
      }
    } else {
      IERC20(token).safeTransfer(_recipient, denomination - _fee);
      if (_fee > 0) {
        IERC20(token).safeTransfer(_relayer, _fee);
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

  function _processWithdrawAndUnwrap(
    address tokenAddress,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal {
    require(TokenWrapper(token).hasRole(MINTER_ROLE, msg.sender), "ERC20PresetMinterPauser: must have minter role");
    require(ITokenWrapper(token).isValidAddress(tokenAddress), "Invalid token address");
    require(ITokenWrapper(token).isValidAmount(denomination), "Invalid token amount");
    require(msg.value == _refund, "Incorrect refund amount received by the contract");
    // burn tokens in anchor if they exist
    if (IERC20(token).balanceOf(address(this)) >= denomination) {
      TokenWrapper(token).burn(denomination);
    }
    // transfer "unwrapped" tokens
    IERC20(tokenAddress).transfer(_recipient, denomination - _fee);
    if (_fee > 0) {
      IERC20(tokenAddress).transfer(_relayer, _fee);
    }

    if (_refund > 0) {
      (bool success, ) = _recipient.call{ value: _refund }("");
      if (!success) {
        // let's return _refund back to the relayer
        _relayer.transfer(_refund);
      }
    }
  }
}
