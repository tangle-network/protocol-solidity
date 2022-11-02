/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "./OpenVAnchorBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../utils/ChainIdWithType.sol";

/**
    @title Open Variable Anchor contract
    @author Webb Technologies
    @notice The Variable Anchor is a variable-denominated public pool system
    derived from Webb's Shielded VAnchor. This system extends the anchor protocol
    in a public way by enabling public cross-chain asset transfers.

    The system is built on top the OpenAnchorBase/OpenLinkableAnchor system which allows
    it to be linked to other OpenVAnchor contracts through a simple graph-like
    interface where anchors maintain edges of their neighboring anchors.

    The system requires users to supply all inputs in the clear. Commitments are constructed
    inside of the smart contract and inserted into a merkle tree for easy cross-chain state updates.
 */
contract OpenVAnchor is OpenVAnchorBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    address public immutable token;

    constructor(
        uint32 _levels,
        IHasher _hasher,
        address _handler,
        address _token
    ) OpenVAnchorBase (
        _levels,
        _hasher,
        _handler
    ) { token = _token; }

    /**
        @notice Wraps a token for the `msg.sender` using the underlying TokenWrapper contract
        @param _tokenAddress The address of the token to wrap
        @param _amount The amount of tokens to wrap
     */
    function wrapToken(address _tokenAddress, uint256 _amount) public {
        ITokenWrapper(token).wrapFor(msg.sender, _tokenAddress, _amount);
    }

    /**
        @notice Unwraps the TokenWrapper token for the `msg.sender` into one of its wrappable tokens.
        @param _tokenAddress The address of the token to unwrap into
        @param _amount The amount of tokens to unwrap
     */
    function unwrapIntoToken(address _tokenAddress, uint256 _amount) public {
        ITokenWrapper(token).unwrapFor(msg.sender, _tokenAddress, _amount);
    }

    /**
        @notice Wrap the native token for the `msg.sender` into the TokenWrapper token
        @notice The amount is taken from `msg.value`
     */
    function wrapNative() payable public {
        ITokenWrapper(token).wrapFor{value: msg.value}(msg.sender, address(0), 0);
    }

    /**
        @notice Unwrap the TokenWrapper token for the `msg.sender` into the native token
        @param _amount The amount of tokens to unwrap
     */
    function unwrapIntoNative(address _tokenAddress, uint256 _amount) public {
        ITokenWrapper(token).unwrapFor(msg.sender, _tokenAddress, _amount);
    }

    function deposit(
        uint48 destinationChainId,
        uint256 depositAmount,
        address recipient,
        bytes calldata delegatedCalldata,
        uint256 blinding
    ) public nonReentrant {
        require(depositAmount <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
        bytes32 commitment = keccak256(abi.encodePacked(
            destinationChainId,
            depositAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding
        ));
        // Send the wrapped asset directly to this contract.
        IERC20(token).transferFrom(msg.sender, address(this), depositAmount);
        // Insert the commitment
        _executeInsertion(commitment);
    }

    function wrapAndDeposit(
        uint48 destinationChainId,
        uint256 depositAmount,
        address recipient,
        bytes calldata delegatedCalldata,
        uint256 blinding,
        address tokenAddress
    ) public payable nonReentrant {
        require(depositAmount <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
        bytes32 commitment = keccak256(abi.encodePacked(
            destinationChainId,
            depositAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding
        ));
        // Send the `tokenAddress` asset to the `TokenWrapper` and mint this contract the wrapped asset.
        _executeWrapping(tokenAddress, depositAmount);
        // Insert the commitment
        _executeInsertion(commitment);
    }

    function withdraw(
        uint256 withdrawAmount,
        address recipient,
        bytes memory delegatedCalldata,
        uint256 blinding,
        bytes32[] memory merkleProof,
        uint32 commitmentIndex,
        bytes32 root
    ) public nonReentrant {
        bytes32 commitment = keccak256(abi.encodePacked(
            getChainIdType(),
            withdrawAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding
        ));
        require(_isValidMerkleProof(merkleProof, commitment, commitmentIndex, root), "Invalid Merkle Proof");
        nullifierHashes[commitment] = true;
        // Send the wrapped token to the recipient.
        _processWithdraw(recipient, withdrawAmount);
    }

    function withdrawAndUnwrap(
        uint256 withdrawAmount,
        address recipient,
        bytes memory delegatedCalldata,
        uint256 blinding,
        bytes32[] memory merkleProof,
        uint32 commitmentIndex,
        bytes32 root,
        address tokenAddress
    ) public payable nonReentrant {
        bytes32 commitment = keccak256(abi.encodePacked(
            getChainIdType(),
            withdrawAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding
        ));
        require(_isValidMerkleProof(merkleProof, commitment, commitmentIndex, root), "Invalid Merkle Proof");
        _processWithdraw(payable(address(this)), withdrawAmount);
        nullifierHashes[commitment] = true;

        ITokenWrapper(token).unwrapAndSendTo(
            tokenAddress,
            withdrawAmount,
            recipient
        );
    }

    function _executeInsertion(bytes32 commitment) internal {
        insert(commitment);
        emit NewCommitment(commitment, nextIndex - 1);
    }

    function _processWithdraw(
        address _recipient,
        uint256 withdrawAmount
    ) internal override {
        uint balance = IERC20(token).balanceOf(address(this));
        if (balance >= withdrawAmount) {
            // transfer tokens when balance exists
            IERC20(token).safeTransfer(_recipient, withdrawAmount);
        } else {
            // mint tokens when not enough balance exists
            IMintableERC20(token).mint(_recipient, withdrawAmount);
        }
    }

    function _executeWrapping(
        address _tokenAddress,
        uint256 depositAmount
    ) payable public {
        // Before executing the wrapping, determine the amount which needs to be sent to the tokenWrapper
        uint256 wrapAmount = ITokenWrapper(token).getAmountToWrap(depositAmount);

        // If the address is zero, this is meant to wrap native tokens
        if (_tokenAddress == address(0)) {
            require(msg.value == wrapAmount);
            // If the wrapping is native, ensure the amount sent to the tokenWrapper is 0
            ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
                    msg.sender,
                    _tokenAddress,
                    0,
                    address(this)
            );
        } else {
            // wrap into the token and send directly to this contract
            ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
                    msg.sender,
                    _tokenAddress,
                    wrapAmount,
                    address(this)
            );
        }
    }

    function _isValidMerkleProof(
        bytes32[] memory siblingPathNodes,
        bytes32 leaf,
        uint32 leafIndex,
        bytes32 root
    ) internal view returns (bool) {
        bytes32 currNodeHash = leaf;
        uint32 nodeIndex = leafIndex;

        for (uint8 i = 0; i < siblingPathNodes.length; i++) {
            if (nodeIndex % 2 == 0) {
                currNodeHash = bytes32(hasher.hashLeftRight(
                    uint256(currNodeHash),
                    uint256(siblingPathNodes[i])
                ));
            } else {
                currNodeHash = bytes32(hasher.hashLeftRight(
                    uint256(siblingPathNodes[i]),
                    uint256(currNodeHash)
                ));
            }
            nodeIndex = nodeIndex / 2;
        }
        bool isKnownRootBool= false;
        for (uint i = 0; i < edgeList.length; i++) {
            isKnownRootBool = isKnownRootBool || isKnownNeighborRoot(edgeList[i].chainID, root);
        }
        isKnownRootBool = isKnownRootBool || isKnownRoot(root);
        return root == currNodeHash && isKnownRootBool;
    }
}
