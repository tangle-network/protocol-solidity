/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

/**
 * @dev Interface of the Governable Token contract.
 * @author Webb Technologies.
 */
interface ISetGovernor {
    /**
        @notice Sets the governor of the ISetGovernor contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor) external;
}
