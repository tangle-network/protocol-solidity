// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;

import { PRBTest } from "@prb/test/PRBTest.sol";
import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";
import { SignatureBridge } from "../SignatureBridge.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

/// @dev See the "Writing Tests" section in the Foundry Book if this is your first time with Forge.
/// https://book.getfoundry.sh/forge/writing-tests
contract SignatureBridgeTest is PRBTest, StdCheats {
    /// @dev An optional function invoked before each test case is run
    function setUp() public virtual {
        // solhint-disable-previous-line no-empty-blocks
    }

    /// @dev Simple test. Run Forge with `-vvvv` to see console logs.
    function test_Example() external {
        console2.log("Hello World");
        assertTrue(true);
    }

    /// @dev Test that fuzzes an unsigned integer.
    function testFuzz_Example(uint256 x) external {
        vm.assume(x != 0);
        assertGt(x, 0);
    }
}
