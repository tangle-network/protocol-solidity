/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

import "./IBatchTree.sol";

abstract contract IMultiAssetVAnchorBatchTree is IBatchTree {
    function getRegistry() external view virtual returns (address);
    function _executeWrapping(address _fromToken, address _toToken, uint256 amount) external virtual;
}