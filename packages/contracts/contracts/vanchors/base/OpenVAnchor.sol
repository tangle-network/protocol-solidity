/**
 * Copyright 2021-2022 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./VAnchorBase.sol";
import "../../structs/SingleAssetExtData.sol";

/**
    @title Open Variable Anchor contract
    @author Webb Technologies
    @notice The Open Variable Anchor is a variable-denominated public pool system
    derived from Webb's VAnchorBase. This system extends the anchor protocol
    in a public way by enabling public cross-chain asset transfers.

    The system requires users to supply all inputs in the clear. Commitments are constructed
    inside of the smart contract and inserted into a merkle tree for easy cross-chain state updates.
 */
abstract contract OpenVAnchor is VAnchorBase {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    address public immutable token;

    constructor(
        uint32 _levels,
        address _handler,
        address _token
    ) VAnchorBase( _levels, _handler, 255) {
        token = _token;
    }

    function deposit(
        uint48 destinationChainId,
        uint256 depositAmount,
        address recipient,
        bytes calldata delegatedCalldata,
        uint256 blinding,
        uint256 relayingFee
    ) public nonReentrant {
        require(depositAmount <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
        bytes32 commitment = keccak256(abi.encodePacked(
            destinationChainId,
            depositAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding,
            relayingFee
        ));
        // Send the wrapped asset directly to this contract.
        IERC20(token).transferFrom(msg.sender, address(this), depositAmount);
        // Insert the commitment
        _executeInsertion(uint256(commitment));
    }

    function wrapAndDeposit(
        uint48 destinationChainId,
        uint256 depositAmount,
        address recipient,
        bytes calldata delegatedCalldata,
        uint256 blinding,
        uint256 relayingFee,
        address tokenAddress
    ) public payable nonReentrant {
        require(depositAmount <= maximumDepositAmount, "amount is larger than maximumDepositAmount");
        bytes32 commitment = keccak256(abi.encodePacked(
            destinationChainId,
            depositAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding,
            relayingFee
        ));
        // Send the `tokenAddress` asset to the `TokenWrapper` and mint this contract the wrapped asset.
        _executeWrapping(tokenAddress, depositAmount);
        // Insert the commitment
        _executeInsertion(uint256(commitment));
    }

    function withdraw(
        uint256 withdrawAmount,
        address recipient,
        bytes memory delegatedCalldata,
        uint256 blinding,
        uint256 relayingFee,
        uint256[] memory merkleProof,
        uint32 commitmentIndex,
        uint256 root
    ) public nonReentrant {
        bytes32 commitment = keccak256(abi.encodePacked(
            getChainIdType(),
            withdrawAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding,
            relayingFee
        ));
        require(_isValidMerkleProof(merkleProof, uint256(commitment), commitmentIndex, root), "Invalid Merkle Proof");
        nullifierHashes[uint256(commitment)] = true;
        // Send the wrapped token to the recipient.
        _processWithdraw(token, recipient, withdrawAmount.sub(relayingFee));
        if (msg.sender != recipient) {
            // Send the fee to the relayer
            _processFee(token, msg.sender, relayingFee);
        }
    }

    function withdrawAndUnwrap(
        uint256 withdrawAmount,
        address recipient,
        bytes memory delegatedCalldata,
        uint256 blinding,
        uint256 relayingFee,
        uint256[] memory merkleProof,
        uint32 commitmentIndex,
        uint256 root,
        address tokenAddress
    ) public payable nonReentrant {
        bytes32 commitment = keccak256(abi.encodePacked(
            getChainIdType(),
            withdrawAmount,
            recipient,
            keccak256(delegatedCalldata),
            blinding,
            relayingFee
        ));
        require(_isValidMerkleProof(merkleProof, uint256(commitment), commitmentIndex, root), "Invalid Merkle Proof");
        _processWithdraw(token, payable(address(this)), withdrawAmount);
        nullifierHashes[uint256(commitment)] = true;

        ITokenWrapper(token).unwrapAndSendTo(
            tokenAddress,
            withdrawAmount.sub(relayingFee),
            recipient
        );

        if (msg.sender != recipient) {
            // Send the fee to the relayer
            _processFee(token, msg.sender, relayingFee);
        }
    }

    function _executeInsertion(uint256 commitment) internal {
        insert(commitment);
        emit NewCommitment(commitment, 0, this.getNextIndex() - 1, "");
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

    /**
		@notice Process the withdrawal by sending/minting the wrapped tokens to/for the recipient
        @param _token The address of the token to withdraw
		@param _recipient The recipient of the tokens
		@param _minusExtAmount The amount of tokens to withdraw. Since
		withdrawal ext amount is negative we apply a minus sign once more.
	 */
    function _processWithdraw(
        address _token,
        address _recipient,
        uint256 _minusExtAmount
    ) internal override {
        uint balance = IERC20(_token).balanceOf(address(this));
        if (balance >= _minusExtAmount) {
            // transfer tokens when balance exists
            IERC20(_token).safeTransfer(_recipient, _minusExtAmount);
        } else {
            // mint tokens when not enough balance exists
            IMintableERC20(_token).mint(_recipient, _minusExtAmount);
        }
    }

	/**
		@notice Process and pay the relayer their fee. Mint the fee if contract has no balance.
        @param _token The token to pay the fee in
		@param _relayer The relayer of the transaction
		@param _fee The fee to pay
	 */
	function _processFee(
        address _token,
		address _relayer,
		uint256 _fee
	) internal override {
		uint balance = IERC20(_token).balanceOf(address(this));
		if (_fee > 0) {
			if (balance >= _fee) {
				// transfer tokens when balance exists
				IERC20(_token).safeTransfer(_relayer, _fee);
			}
			else {
				IMintableERC20(_token).mint(_relayer, _fee);
			}
		}
	}

    function _isValidMerkleProof(
        uint256[] memory siblingPathNodes,
        uint256 leaf,
        uint32 leafIndex,
        uint256 root
    ) internal view returns (bool) {
        uint256 currNodeHash = leaf;
        uint32 nodeIndex = leafIndex;

        for (uint8 i = 0; i < siblingPathNodes.length; i++) {
            if (nodeIndex % 2 == 0) {
                currNodeHash = hashLeftRight(
                    currNodeHash,
                    siblingPathNodes[i]
                );
            } else {
                currNodeHash = hashLeftRight(
                    siblingPathNodes[i],
                    currNodeHash
                );
            }
            nodeIndex = nodeIndex / 2;
        }
        bool isKnownRootBool= false;
        for (uint i = 0; i < edgeList.length; i++) {
            isKnownRootBool = isKnownRootBool || isKnownNeighborRoot(edgeList[i].chainID, root);
        }
        isKnownRootBool = isKnownRootBool || this.isKnownRoot(root);
        return root == currNodeHash && isKnownRootBool;
    }

}
