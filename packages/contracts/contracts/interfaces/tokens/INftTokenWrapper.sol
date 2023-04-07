/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
    @title Interface for Nft Token Wrapper contract.
    @author Webb Technologies.
 */
interface INftTokenWrapper {
	function wrap721(uint256 _tokenId) external;

	function unwrap721(uint256 _tokenId, address _tokenContract) external;
}
