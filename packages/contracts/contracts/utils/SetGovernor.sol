/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Governable Token contract.
 * @author Webb Technologies.
 */
contract SetGovernor {
    address public governor;
    uint public proposalNonce;

    /**
        @notice Sets the governor of the ISetGovernor contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor, uint _nonce) external onlyGovernor {
        require(proposalNonce < _nonce, "SetGovernor: Invalid nonce");
        require(_nonce < proposalNonce + 1, "SetGovernor: Nonce must not increment more than 1048");
        governor = _governor;
    }

    modifier onlyGovernor {
        require(msg.sender == governor, "SetGovernor: Only governor can call this function");
        _;
    }
}
