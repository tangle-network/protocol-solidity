/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: Apache 2.0/MIT
 */

pragma solidity ^0.8.5;

import "./NftTokenWrapper.sol";
import "./MultiTokenManagerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
    @title A MultiNftTokenManager manages NftTokenWrapper systems
    using an external `governor` address
    @author Webb Technologies.
 */
contract MultiNftTokenManager is MultiTokenManagerBase, ReentrancyGuard {
	using SafeMath for uint256;

	function registerToken(
		address,
		string memory,
		string memory,
		bytes32,
		uint256,
		uint16,
		bool,
		address
	) public view override onlyRegistry onlyInitialized returns (address) {
		revert();
	}

	function registerNftToken(
		address _handler,
		string memory _uri,
		bytes32 _salt
	) external override nonReentrant onlyRegistry onlyInitialized returns (address) {
		NftTokenWrapper nftWrapper = new NftTokenWrapper{ salt: _salt }(_uri);

		nftWrapper.initialize(_handler);

		wrappedTokens.push(address(nftWrapper));
		return address(nftWrapper);
	}

	function isFungible() public pure override returns (bool) {
		return false;
	}
}
