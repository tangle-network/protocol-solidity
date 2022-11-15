/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../anchors/LinkableAnchor.sol";
import "../interfaces/verifiers/IAnchorVerifier.sol";
import "../interfaces/verifiers/ISetVerifier.sol";

contract LinkableAnchorMock is LinkableAnchor, ISetVerifier{
    constructor(
        address _handler,
        IAnchorVerifier _verifier,
        IHasher _hasher,
        uint32 _merkleTreeHeight,
        uint8 _maxEdges
    ) LinkableAnchor(_handler, _hasher, _merkleTreeHeight, _maxEdges) {
        require(address(_verifier) != address(0), "Verifier address cannot be 0");
        return;
    }

    function setHandler(address _handler, uint32 _nonce) override external onlyHandler {
        handler = _handler;
        proposalNonce = _nonce;
        return;
    }

    function setVerifier(address _verifier, uint32 _nonce) override external onlyHandler {
        _verifier = _verifier;
        proposalNonce = _nonce;
        return;
    }

    function configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount, uint32 _nonce) view override external onlyHandler {
        _minimalWithdrawalAmount + _minimalWithdrawalAmount;
        return;
    }

    function configureMaximumDepositLimit(uint256 _maximumDepositAmount, uint32 _nonce) view override external onlyHandler {
        _maximumDepositAmount + _maximumDepositAmount;
        return;
    }
}
