/**
 * Copyright 2021 Webb Technologies, Compound Protocol
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */
 
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "../tokens/GovernedTokenWrapper.sol";
import "../interfaces/IVAnchor.sol";

/**
 * Utility library of inline functions on addresses
 */
library AddressUtils {
  /**
   * Returns whether the target address is a contract
   * @dev This function will return false if invoked during the constructor of a contract,
   * as the code is not actually created until after the constructor finishes.
   * @param _addr address to check
   * @return whether the target address is a contract
   */
  function isContract(address _addr) internal view returns (bool) {
    uint256 size;
    // XXX Currently there is no better way to check if there is a contract in an address
    // than to check the size of the code at that address.
    // See https://ethereum.stackexchange.com/a/14016/36603
    // for more details about how this works.
    // TODO Check this again before the Serenity release, because all addresses will be
    // contracts then.
    // solium-disable-next-line security/no-inline-assembly
    assembly {
      size := extcodesize(_addr)
    }
    return size > 0;
  }
}

contract GTokenWrapperMock is GovernedTokenWrapper, IERC6777 {
    bytes4 internal constant ON_TOKEN_TRANSFER = 0xa4c0ed36; // onTokenTransfer(address,uint256,bytes)

    /**
     * @notice Construct a new Comp token
     */
    constructor(string memory name, string memory symbol, address governor, uint256 limit)
      GovernedTokenWrapper(name, symbol, governor, limit, true) {}

    function transferAndCall(
      address _to,
      uint256 _value,
      bytes calldata _data
    ) override external returns (bool) {
      require(super.transfer(_to, _value));
      emit Transfer(msg.sender, _to, _value);

      if (AddressUtils.isContract(_to)) {
        require(contractFallback(msg.sender, _to, _value, _data));
      }
      return true;
    }

    /**
    * @dev call onTokenTransfer fallback on the token recipient contract
    * @param _from tokens sender
    * @param _to tokens recipient
    * @param _value amount of tokens that was sent
    * @param _data set of extra bytes that can be passed to the recipient
    */
    function contractFallback(
      address _from,
      address _to,
      uint256 _value,
      bytes calldata _data
    ) private returns (bool) {
      (bool success, bytes memory returnData) = _to.call(abi.encodeWithSelector(ON_TOKEN_TRANSFER, _from, _value, _data));
      return success;
    }    
}