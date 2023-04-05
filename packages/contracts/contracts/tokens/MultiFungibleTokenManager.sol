/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: Apache 2.0/MIT
 */

pragma solidity ^0.8.5;

import "./FungibleTokenWrapper.sol";
import "./MultiTokenManagerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
    @title A MultiFungibleTokenManager manages FungibleTokenWrapper systems
    using an external `handler` address.
    @author Webb Technologies.
 */
contract MultiFungibleTokenManager is MultiTokenManagerBase, ReentrancyGuard {
	using SafeMath for uint256;

	/**
        @notice Registers a new token and deploys the FungibleTokenWrapper contract
        @param _handler The address of the token handler contract
        @param _name The name of the ERC20
        @param _symbol The symbol of the ERC20
        @param _salt Salt used for matching addresses across chain using CREATE2
        @param _limit The maximum amount of tokens that can be wrapped
        @param _feePercentage The fee percentage for wrapping
        @param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
		@param _admin The address of the admin who will receive minting rights and admin role
     */
	function registerToken(
		address _handler,
		string memory _name,
		string memory _symbol,
		bytes32 _salt,
		uint256 _limit,
		uint16 _feePercentage,
		bool _isNativeAllowed,
		address _admin
	) external override nonReentrant onlyRegistry onlyInitialized returns (address) {
		FungibleTokenWrapper token = new FungibleTokenWrapper{ salt: _salt }(_name, _symbol);

		token.initialize(
			_feePercentage,
			payable(masterFeeRecipient),
			_handler,
			_limit,
			_isNativeAllowed,
			_admin
		);

		wrappedTokens.push(address(token));
		return address(token);
	}

	/**
        Registers an NFT token
     */
	function registerNftToken(
		address,
		string memory,
		bytes32
	) public view override onlyRegistry onlyInitialized returns (address) {
		revert();
	}

	function isFungible() public pure override returns (bool) {
		return true;
	}
}
