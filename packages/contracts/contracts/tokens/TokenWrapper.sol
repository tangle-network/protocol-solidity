/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "../interfaces/tokens/ITokenWrapper.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
	@title A token that allows ERC20s to wrap into and mint it.
	@author Webb Technologies.
	@notice This contract is intended to be used with TokenHandler/FungibleToken contract.
 */
abstract contract TokenWrapper is ERC20PresetMinterPauser, ITokenWrapper, ReentrancyGuard {
	using SafeERC20 for IERC20;
	uint16 public feePercentage;
	address payable public feeRecipient;

	/**
		@notice TokenWrapper constructor
		@param _name The name of the ERC20
		@param _symbol The symbol of the ERC20
	 */
	constructor(
		string memory _name,
		string memory _symbol
	) ERC20PresetMinterPauser(_name, _symbol) {}

	/**
		@notice Get the fee for a target amount to wrap
		@param _amountToWrap The amount to wrap
		@return uint The fee amount of the token being wrapped
	 */
	function getFeeFromAmount(uint256 _amountToWrap) public view override returns (uint256) {
		return (_amountToWrap * feePercentage) / 10000;
	}

	/**
		@notice Get the fee for a target amount to wrap
		@param _admin the address for granting minting, pausing and admin roles at initialization
	 */
	function _initialize(address _admin) internal {
		_setupRole(MINTER_ROLE, _admin);
		_setupRole(DEFAULT_ADMIN_ROLE, _admin);
		_setupRole(PAUSER_ROLE, _admin);
	}

	/**
		@notice Get the amount to wrap for a target `_deposit` amount
		@param _deposit The deposit amount
		@return uint The amount to wrap conditioned on the deposit amount
	 */
	function getAmountToWrap(uint256 _deposit) public view override returns (uint256) {
		return (_deposit * 10000) / (10000 - feePercentage);
	}

	/**
		@notice Used to wrap tokens on behalf of a sender. Must be called by a minter role.
		@param tokenAddress Address of ERC20 to transfer.
		@param amount Amount of tokens to transfer.
	 */
	function wrap(
		address tokenAddress,
		uint256 amount
	) public payable override nonReentrant isValidWrapping(tokenAddress, feeRecipient, amount) {
		_wrapForAndSendTo(_msgSender(), tokenAddress, amount, _msgSender());
	}

	/**
		@notice Used to wrap tokens on behalf of a sender
		@param sender Address of sender where assets are sent from.
		@param tokenAddress Address of ERC20 to transfer.
		@param amount Amount of tokens to transfer.
	 */
	function wrapFor(
		address sender,
		address tokenAddress,
		uint256 amount
	)
		public
		payable
		override
		nonReentrant
		isMinter
		isValidWrapping(tokenAddress, feeRecipient, amount)
	{
		_wrapForAndSendTo(sender, tokenAddress, amount, sender);
	}

	/**
		@notice Used to wrap tokens on behalf of a sender and mint to a potentially different address
		@param sender Address of sender where assets are sent from.
		@param tokenAddress Address of ERC20 to transfer.
		@param amount Amount of tokens to transfer.
		@param recipient Recipient of the wrapped tokens.
	 */
	function wrapForAndSendTo(
		address sender,
		address tokenAddress,
		uint256 amount,
		address recipient
	)
		public
		payable
		override
		nonReentrant
		isMinter
		isValidWrapping(tokenAddress, feeRecipient, amount)
	{
		_wrapForAndSendTo(sender, tokenAddress, amount, recipient);
	}

	/**
		@notice Used to unwrap/burn the wrapper token on behalf of a sender.
		@param tokenAddress Address of ERC20 to unwrap into.
		@param amount Amount of tokens to burn.
	 */
	function unwrap(
		address tokenAddress,
		uint256 amount
	) public override nonReentrant isValidUnwrapping(tokenAddress, amount) {
		_unwrapAndSendTo(_msgSender(), tokenAddress, amount, _msgSender());
	}

	/**
		@notice Used to unwrap/burn the wrapper token on behalf of a sender.
		@param tokenAddress Address of ERC20 to unwrap into.
		@param amount Amount of tokens to burn.
	 */
	function unwrapAndSendTo(
		address tokenAddress,
		uint256 amount,
		address recipient
	) public override nonReentrant isValidUnwrapping(tokenAddress, amount) {
		_unwrapAndSendTo(_msgSender(), tokenAddress, amount, recipient);
	}

	/**
		@notice Used to unwrap/burn the wrapper token.
		@param sender The address that the caller is unwrapping for
		@param tokenAddress Address of ERC20 to unwrap into.
		@param amount Amount of tokens to burn.
	 */
	function unwrapFor(
		address sender,
		address tokenAddress,
		uint256 amount
	) public override nonReentrant isMinter isValidUnwrapping(tokenAddress, amount) {
		_unwrapAndSendTo(sender, tokenAddress, amount, sender);
	}

	function isValidToken(address tokenAddress) public view override returns (bool) {
		if (tokenAddress == address(0)) {
			return _isNativeValid();
		} else {
			return _isValidAddress(tokenAddress);
		}
	}

	function _wrapForAndSendTo(
		address sender,
		address tokenAddress,
		uint256 amount,
		address recipient
	) internal {
		uint256 costToWrap = getFeeFromAmount(tokenAddress == address(0) ? msg.value : amount);
		uint256 leftover = tokenAddress == address(0)
			? uint256(msg.value) - costToWrap
			: amount - costToWrap;
		if (tokenAddress == address(0)) {
			// transfer fee (costToWrap) to feeRecipient
			feeRecipient.transfer(costToWrap);
		} else {
			// transfer liquidity to the token wrapper
			IERC20(tokenAddress).safeTransferFrom(sender, address(this), leftover);
			// transfer fee (costToWrap) to feeRecipient
			IERC20(tokenAddress).safeTransferFrom(sender, feeRecipient, costToWrap);
		}
		// mint the wrapped token for the recipient
		_mint(recipient, leftover);
	}

	function _unwrapAndSendTo(
		address sender,
		address tokenAddress,
		uint256 amount,
		address recipient
	) internal {
		// burn wrapped token from sender
		_burn(sender, amount);
		// unwrap liquidity and send to the sender
		if (tokenAddress == address(0)) {
			// transfer native liquidity from the token wrapper to the sender
			payable(recipient).transfer(amount);
		} else {
			// transfer ERC20 liquidity from the token wrapper to the sender
			IERC20(tokenAddress).safeTransfer(recipient, amount);
		}
	}

	/** @dev this function is defined in a child contract */
	function _isValidAddress(address tokenAddress) internal view virtual returns (bool);

	/** @dev this function is defined in a child contract */
	function _isValidHistoricalAddress(address tokenAddress) internal view virtual returns (bool);

	/** @dev this function is defined in a child contract */
	function _isNativeValid() internal view virtual returns (bool);

	/** @dev this function is defined in a child contract */
	function _isValidAmount(uint256 amount) internal view virtual returns (bool);

	modifier isMinter() {
		require(hasRole(MINTER_ROLE, msg.sender), "TokenWrapper: must have minter role");
		_;
	}

	/**
		@notice Modifier to check if the wrapping is valid
		@param _tokenAddress The token address to wrap from
		@param _feeRecipient The fee recipient for the wrapping fee
		@param _amount The amount of tokens to wrap
	 */
	modifier isValidWrapping(
		address _tokenAddress,
		address _feeRecipient,
		uint256 _amount
	) {
		if (_tokenAddress == address(0)) {
			require(_amount == 0, "TokenWrapper: Invalid amount provided for native wrapping");
			require(
				_isNativeValid(),
				"TokenWrapper: Native wrapping is not allowed for this token wrapper"
			);
		} else {
			require(msg.value == 0, "TokenWrapper: Invalid value sent for wrapping");
			require(_isValidAddress(_tokenAddress), "TokenWrapper: Invalid token address");
		}

		require(_feeRecipient != address(0), "TokenWrapper: Fee Recipient cannot be zero address");
		require(_isValidAmount(_amount), "TokenWrapper: Invalid token amount");
		_;
	}

	/**
		@notice Modifier to check if the unwrapping is valid
		@param _tokenAddress The token address to unwrap into
		@param _amount The amount of tokens to unwrap
	 */
	modifier isValidUnwrapping(address _tokenAddress, uint256 _amount) {
		if (_tokenAddress == address(0)) {
			require(address(this).balance >= _amount, "TokenWrapper: Insufficient native balance");
			require(
				_isNativeValid(),
				"TokenWrapper: Native unwrapping is not allowed for this token wrapper"
			);
		} else {
			require(
				IERC20(_tokenAddress).balanceOf(address(this)) >= _amount,
				"TokenWrapper: Insufficient ERC20 balance"
			);
			require(
				_isValidHistoricalAddress(_tokenAddress),
				"TokenWrapper: Invalid historical token address"
			);
		}

		_;
	}
}
