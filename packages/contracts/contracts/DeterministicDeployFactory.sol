// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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
		(bool success, bytes memory data) = c.delegatecall(
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
}

