/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "../interfaces/ITokenWrapper.sol";
import "../interfaces/IMintableERC20.sol";
import "../interfaces/IVerifier.sol";
import "../interfaces/IFixedDepositAnchor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./AnchorBase.sol";

/**
	@title The FixedDepositAnchor contract.
	@notice The FixedDepositAnchor system is an interoperable
	shielded pool supporting fixed denomination deposits of ERC20 tokens.
	
	The system is built on top the AnchorBase/LinkableTree system which allows
	it to be linked to other FixedDepositAnchors through a simple graph-like
	interface where anchors maintain edges of their neighboring anchors.

	The system requires users to both deposit a fixed denomination of ERC20
	assets into the smart contract and insert a commitment into the underlying
	merkle tree of the form: commitment = Poseidon(destinationChainId, nullifier, secret).
	Commitments adhering to different hash functions and formats will invalidate
	any attempt at withdrawal.

	Information regarding the commitments:
	- Poseidon is a zkSNARK friendly hash function
	- destinationChainId is the chainId of the destination chain, where the withdrawal
	  is intended to be made
	- nullifier is a random field element and identifier for the deposit that will
	  be used to withdraw the deposit and ensure that the deposit is not double withdrawn.
	- secret is a random field element that will remain secret throughout the lifetime
	  of the deposit and withdrawal.
	
	Using the preimage of the commitment, users can generate a zkSNARK proof that
	the deposit is located in one-of-many anchor merkle trees and that the commitment's
	destination chain id matches the underlying chain id of the anchor where the
	withdrawal is taking place. The chain id opcode is leveraged to prevent any
	tampering of this data.
 */
contract FixedDepositAnchor is AnchorBase, IFixedDepositAnchor {
	using SafeERC20 for IERC20;
	using SafeMath for uint256;

	// The token that is used to pay the deposit
	address public immutable token;
	// The denomination unit of the deposit
	uint256 public immutable denomination;

	// Events
	event Deposit(address sender, uint32 indexed leafIndex, bytes32 indexed commitment, uint256 timestamp);
	event Withdrawal(address to, address indexed relayer, uint256 fee);
	event Refresh(bytes32 indexed commitment, bytes32 nullifierHash, uint32 insertedIndex);

	/**
		@notice The FixedDepositAnchor constructor
		@param _handler The address of AnchorHandler for this contract
		@param _token The address of the token that is used to pay the deposit
		@param _verifier The address of SNARK verifier for this contract
		@param _hasher The address of hash contract
		@param _denomination The transfer amount for each deposit
		@param _merkleTreeHeight The height of underlying Merkle Tree
		@param _maxEdges The maximum number of edges in the LinkableTree + Verifier supports.
		@notice The `_maxEdges` is zero-knowledge circuit dependent, meaning the
		`_verifier` ONLY supports a certain maximum # of edges. Therefore we need to
		limit the size of the LinkableTree with this parameter.
	*/
	constructor(
		address _handler,
		ITokenWrapper _token,
		IAnchorVerifier _verifier,
		IPoseidonT3 _hasher,
		uint256 _denomination,
		uint32 _merkleTreeHeight,
		uint8 _maxEdges
	) AnchorBase(_handler, _verifier, _hasher, _merkleTreeHeight, _maxEdges) {
		require(_denomination > 0, "denomination should be greater than 0");
		denomination = _denomination;
		token = address(_token);
	}

	/**
		@notice The deposit function
		@param _commitment The commitment for the deposit
	 */
	function deposit(bytes32 _commitment) override public payable {
		require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
		uint32 insertedIndex = insert(_commitment);
		IMintableERC20(token).transferFrom(msg.sender, address(this), denomination);
		emit Deposit(msg.sender, insertedIndex, _commitment, block.timestamp);
	}

	/**
		@notice Checks whether an external data object matches a proivded hash.
		@return bool Whether the hashes match.
	 */
	function _isValidExtDataHash(ExtData calldata _extData, bytes32 _extDataHash) internal pure returns (bool) {
		bytes memory extData = abi.encode(
			_extData._refreshCommitment,
			_extData._recipient,
			_extData._relayer,
			_extData._fee,
			_extData._refund
		);

		return (uint256(_extDataHash) == uint256(keccak256(extData)) % FIELD_SIZE);
	}

	/**
		@notice Withdraw a deposit from the contract
		@param _proof The zkSNARK proof data
		@param _extData The external data containing arbitrary public inputs
	*/
	function withdraw(
		Proof calldata _proof,
		ExtData calldata _extData
	) override external payable nonReentrant {
		require(_extData._fee <= denomination, "Fee exceeds transfer value");
		require(!isSpent(_proof._nullifierHash), "The note has been already spent");
		require(_isValidExtDataHash(_extData, _proof._extDataHash), "extDataHash is invalid");
		bytes calldata proof = _proof.proof;    
		(bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(_proof);

		require(isValidRoots(roots), "Invalid roots");
		require(verify(proof, encodedInput), "Invalid withdraw proof");
		nullifierHashes[_proof._nullifierHash] = true;
		if (_extData._refreshCommitment == bytes32(0x00)) {
			processWithdraw(
				_extData._recipient,
				_extData._relayer,
				_extData._fee,
				_extData._refund
			);
		} else {
			require(!commitments[_extData._refreshCommitment], "The commitment has been submitted");
			uint32 insertedIndex = _insert(_extData._refreshCommitment);
			commitments[_extData._refreshCommitment] = true;
			emit Refresh(
				_extData._refreshCommitment,
				_proof._nullifierHash,
				insertedIndex
			);
		}
	}

	/**
		@notice Process the withdrawal of a deposit to the recipient / relayer
		@param _recipient The address of the recipient
		@param _relayer The address of the relayer who relayed the transaction
		@param _fee The fee paid for the transaction to the relayer
		@param _refund The refund amount to the recipient from the relayer
	 */
	function processWithdraw(
		address payable _recipient,
		address payable _relayer,
		uint256 _fee,
		uint256 _refund
	) internal {
		require(msg.value == _refund, "Incorrect refund amount received by the contract");

		uint balance = IERC20(token).balanceOf(address(this));
		
		if (balance >= denomination) {
			// transfer tokens when balance exists
			IERC20(token).safeTransfer(_recipient, denomination - _fee);
			if (_fee > 0) {
				IERC20(token).safeTransfer(_relayer, _fee);
			}
		} else {
			// mint tokens when not enough balance exists
			IMintableERC20(token).mint(_recipient, denomination - _fee);
			if (_fee > 0) {
				IMintableERC20(token).mint(_relayer, _fee);
			}
		}

		emit Withdrawal(_recipient, _relayer, _fee);

		if (_refund > 0) {
			(bool success, ) = _recipient.call{ value: _refund }("");
			if (!success) {
				// let's return _refund back to the relayer
				_relayer.transfer(_refund);
			}
		}
	}

	/**
		@notice Wraps a token for the `msg.sender` using the underlying FixedDepositAnchor's TokenWrapper contract
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
	function unwrapIntoNative(uint256 _amount) public {
		ITokenWrapper(token).unwrapFor(msg.sender, address(0), _amount);
	}

	/**
		@notice Wraps a token for the `msg.sender` and deposits it into the contract
		@param _tokenAddress The address of the token to wrap
		@param _commitment The commitment to insert for the deposit
	 */
	function wrapAndDeposit(
		address _tokenAddress,
		bytes32 _commitment
	) payable public {
		require(!commitments[_commitment], "The commitment has been submitted");
		// Get the amount depending on the asset being wrapped (native or ERC20)
		uint amount = 0;
		if (_tokenAddress == address(0)) {
			require(msg.value == ITokenWrapper(token).getAmountToWrap(denomination));
		} else {
			amount = ITokenWrapper(token).getAmountToWrap(denomination);
		}
		// Wrap into the token and send directly to this contract
		ITokenWrapper(token).wrapForAndSendTo{value: msg.value}(
			msg.sender,
			_tokenAddress,
			amount,
			address(this)
		);
		// insert a new commitment to the tree
		uint32 insertedIndex = _insert(_commitment);
		commitments[_commitment] = true;
		// emit the deposit event
		emit Deposit(msg.sender, insertedIndex, _commitment, block.timestamp);
	}

	/**
		@notice Withdraws a deposit and unwraps into a valid token for the `msg.sender`
		@param _proof The zkSNARK proof for the withdrawal
		@param _extData The external data for the withdrawal
		@param _tokenAddress The address of the token to unwrap into
	 */
	function withdrawAndUnwrap(
		Proof calldata _proof,
		ExtData calldata _extData,
		address _tokenAddress
	) external payable nonReentrant {
		require(_extData._fee <= denomination, "Fee exceeds transfer value");
		require(!nullifierHashes[_proof._nullifierHash], "The note has been already spent");
		require(_isValidExtDataHash(_extData, _proof._extDataHash), "extDataHash is invalid");

		(bytes memory encodedInput, bytes32[] memory roots) = _encodeInputs(_proof);
		bytes calldata proof = _proof.proof;

		require(isValidRoots(roots), "Invalid roots");
		require(verify(proof, encodedInput), "Invalid withdraw proof");

		nullifierHashes[_proof._nullifierHash] = true;

		processWithdraw(
			payable(address(this)),
			_extData._relayer,
			_extData._fee,
			_extData._refund
		);
		
		ITokenWrapper(token).unwrapAndSendTo(
			_tokenAddress,
			denomination - _extData._fee,
			address(_extData._recipient)
		);
	}

	/**
		@notice Gets the denomination unit of a deposit into this contract
		@return uint256 The denomination unit of a deposit into this contract
	 */
	function getDenomination() override external view returns (uint256) {
		return denomination;
	}

	/**
		@notice Gets the deposit token address of this contract
		@return address The deposit token address of this contract
	 */
	function getToken() override  external view returns (address) {
		return token;
	}

	/**
		@notice Encodes the inputs for the proof from the `Proof` struct.
		@return (bytes memory encodedInput, bytes32[] memory roots) The encoded inputs for the proof
	 */
	function _encodeInputs(
		Proof calldata _proof
	) internal view returns (bytes memory, bytes32[] memory) {
		bytes memory encodedInput = abi.encodePacked(
			uint256(_proof._nullifierHash),
			uint256(_proof._extDataHash),
			uint256(getChainIdType()),
			_proof._roots
		);

		bytes32[] memory result = decodeRoots(_proof._roots);

		return (encodedInput, result);
	}
}
