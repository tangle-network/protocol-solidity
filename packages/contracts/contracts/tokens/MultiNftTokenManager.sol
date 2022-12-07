/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./NftTokenWrapper.sol";
import "./MultiTokenManagerBase.sol";

/**
    @title A MultiNftTokenManager manages NftTokenWrapper systems
    using an external `governor` address
    @author Webb Technologies.
 */
contract MultiNftTokenManager is MultiTokenManagerBase {
	using SafeMath for uint256;

	function registerToken(
		address,
		string memory,
		string memory,
		bytes32,
		uint256,
		uint16,
		bool
	) public view override onlyRegistry onlyInitialized returns (address) {
		revert();
	}

	function registerNftToken(
		address _handler,
		string memory _uri,
		bytes32 _salt
	) external override onlyRegistry onlyInitialized returns (address) {
		NftTokenWrapper nftWrapper = new NftTokenWrapper{ salt: _salt }(_uri);

		nftWrapper.initialize(_handler);

		wrappedTokens.push(address(nftWrapper));
		return address(nftWrapper);
	}

	function isFungible() public pure override returns (bool) {
		return false;
	}
}
