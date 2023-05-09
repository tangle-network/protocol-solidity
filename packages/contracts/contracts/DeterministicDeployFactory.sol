/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity ^0.8.18;

contract DeterministicDeployFactory {
	event Deploy(address addr);

	function deploy(bytes memory bytecode, uint _salt) external returns (address) {
		address addr;
		assembly {
			addr := create2(0, add(bytecode, 0x20), mload(bytecode), _salt)
			if iszero(extcodesize(addr)) {
				revert(0, 0)
			}
		}

		emit Deploy(addr);
		return addr;
	}

	/**
		@notice Deploy a fungible token
		@param bytecode The bytecode of the contract
		@param _salt The salt for the contract
		@param _feePercentage The fee percentage for wrapping
		@param _feeRecipient The recipient for fees from wrapping.
		@param _handler The address of the handler
		@param _limit The maximum amount of tokens that can be wrapped
		@param _isNativeAllowed Whether or not native tokens are allowed to be wrapped
	 */
	function deployFungibleToken(
		bytes memory bytecode,
		uint _salt,
		uint16 _feePercentage,
		address _feeRecipient,
		address _handler,
		uint256 _limit,
		bool _isNativeAllowed
	) external {
		address c = this.deploy(bytecode, _salt);
		// delegate call initialize the contract created with the msg.sender
		(bool success, bytes memory data) = c.call(
			abi.encodeWithSignature(
				"initialize(uint16,address,address,uint256,bool)",
				_feePercentage,
				_feeRecipient,
				_handler,
				_limit,
				_isNativeAllowed
			)
		);
		require(success, string(data));
	}

	/**
		@notice Deploy a VAnchor
		@param bytecode The bytecode of the contract
		@param _salt The salt for the contract
		@param _minimalWithdrawalAmount The minimal withdrawal amount
		@param _maximumDepositAmount The maximum deposit amount
	 */
	function deployVAnchor(
		bytes memory bytecode,
		uint _salt,
		uint256 _minimalWithdrawalAmount,
		uint256 _maximumDepositAmount
	) external {
		address c = this.deploy(bytecode, _salt);
		// delegate call initialize the contract created with the msg.sender
		(bool success, bytes memory data) = c.call(
			abi.encodeWithSignature(
				"initialize(uint256,uint256)",
				_minimalWithdrawalAmount,
				_maximumDepositAmount
			)
		);
		require(success, string(data));
	}
}
