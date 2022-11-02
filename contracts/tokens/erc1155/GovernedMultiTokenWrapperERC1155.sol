/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later-only
 */

pragma solidity ^0.8.0;

import "./MultiTokenWrapperERC1155.sol";

/**
    @title A governed MultiTokenWrapperERC1155 system using an external `governor` address
    @author Webb Technologies.
    @notice Governs allowable ERC20s to deposit using a governable wrapping limit and
    sets fees for wrapping into itself. This contract is intended to be used with
    TokenHandler contract.
 */
contract GovernedMultiTokenWrapperERC1155 is MultiTokenWrapperERC1155 {
    using SafeMath for uint256;

    address public governor;

    // Wrapping lists for each wrapped token
    // The ordering is (wrappedToken) => (wrappableTokens[])
    // For example (webbUSD-1) => ([DAI, USDC, USDT])
    //             (webbUSD-2) => ([DAI])
    //             ...
    mapping (address => address[]) public tokens;
    // Historical list for each wrapped token (used if tokens are removed)
    mapping (address => address[]) public historicalTokens;

    // Mapping of wrappable tokens for each wrapped token
    // The ordering is (wrappedToken => (wrappableToken => bool))
    // For example (webbUSD) => (DAI => true, USDC => true, USDT => true)
    mapping (address => mapping (address => bool)) valid;

    // Mapping of history of wrapped token lists.
    mapping (address => mapping (address => bool)) historicallyValid;

    mapping (address => bool) public isNativeAllowed;
    mapping (address => uint256) public wrappingLimit;

    uint256 public proposalNonce = 0;

    /**
        @notice GovernedMultiTokenWrapperERC1155 constructor
        @param _uri The uri of the ERC1155 MultiTokenWrapperERC1155
        @param _feeRecipient The recipient for fees from wrapping.
        @param _governor The address of the governor
        @notice An example of the uri scheme https://token-cdn-domain/{id}.json
        @notice https://eips.ethereum.org/EIPS/eip-1155#metadata
     */
    constructor(
        string memory _uri,
        address payable _feeRecipient,
        address _governor
    ) MultiTokenWrapperERC1155(_uri, _feeRecipient) {
        governor = _governor;
    }

    /**
        @notice Sets the governor of the GovernedMultiTokenWrapperERC1155 contract
        @param _governor The address of the new governor
        @notice Only the governor can call this function
     */
    function setGovernor(address _governor) public onlyGovernor {
        governor = _governor;
    }

    /**
        @notice Sets whether native tokens are allowed to be wrapped
        @param allowed Whether or not native tokens are allowed to be wrapped
        @notice Only the governor can call this function
     */
    function setNativeAllowed(address toTokenAddress, bool allowed) public onlyGovernor {
        isNativeAllowed[toTokenAddress] = allowed;
    }

    /**
        @notice Adds a token at `_tokenAddress` to the GovernedMultiTokenWrapperERC1155's wrapping list
        @param fromTokenAddress The address of the token to be added to `toTokenAddress`'s wrapping list
        @param toTokenAddress The address of the wrapping token whose wrapping list will be updated
        @param nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
    function add(address fromTokenAddress, address toTokenAddress, uint32 nonce) public onlyGovernor {
        require(!valid[toTokenAddress][fromTokenAddress], "Token should not be valid");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce < proposalNonce + 1048, "Nonce must not increment more than 1048");
        tokens[toTokenAddress].push(fromTokenAddress);

        if (!historicallyValid[toTokenAddress][fromTokenAddress]) {
            historicalTokens[toTokenAddress].push(fromTokenAddress);
            historicallyValid[toTokenAddress][fromTokenAddress] = true;
        }
        valid[toTokenAddress][fromTokenAddress] = true;
        proposalNonce = nonce;
    }

    /**
        @notice Removes a token at `_tokenAddress` from the GovernedMultiTokenWrapperERC1155's wrapping list
        @param fromTokenAddress The address of the token to be removed from `toTokenAddress`'s wrapping list
        @param toTokenAddress The address of the wrapping token whose wrapping list will be updated
        @param nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
    function remove(address fromTokenAddress, address toTokenAddress, uint32 nonce) public onlyGovernor {
        require(valid[toTokenAddress][fromTokenAddress], "Token should be valid");
        require(proposalNonce < nonce, "Invalid nonce");
        require(nonce < proposalNonce + 1048, "Nonce must not increment more than 1048");
        uint index = 0;
        for (uint i = 0; i < tokens[toTokenAddress].length; i++) {
            if (tokens[toTokenAddress][i] == fromTokenAddress) {
                index = i;
                break;
            }
        }
        require(index < tokens[toTokenAddress].length, "token not found");
        valid[toTokenAddress][fromTokenAddress] = false;
        proposalNonce = nonce;
        removeTokenAtIndex(toTokenAddress, index);
    }

    /**
        @notice Updates the `limit` of tokens that can be wrapped
        @param limit The new limit of tokens that can be wrapped
        @notice Only the governor can call this function
     */
    function updateLimit(address toTokenAddress, uint256 limit) public onlyGovernor {
        wrappingLimit[toTokenAddress] = limit;
    }

    /**
        @notice Sets a new `_feePercentage` for the GovernedMultiTokenWrapperERC1155
        @param _feePercentage The new fee percentage
        @param _nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
    function setFee(address tokenAddress, uint16 _feePercentage, uint32 _nonce) override external onlyGovernor {
        require(0 <= _feePercentage && _feePercentage <= 10_000, "invalid fee percentage");
        require(proposalNonce < _nonce, "Invalid nonce");
        require(_nonce < proposalNonce + 1048, "Nonce must not increment more than 1048");
        wrappedTokenToWrappingFeePercentage[tokenAddress] = _feePercentage;
        proposalNonce = _nonce;
    }

    /**
        @notice Sets a new `_feeRecipient` for the GovernedMultiTokenWrapperERC1155
        @param _feeRecipient The new fee recipient
        @param _nonce The nonce tracking updates to this contract
        @notice Only the governor can call this function
     */
    function setFeeRecipient(address payable _feeRecipient, uint32 _nonce) public onlyGovernor {
        require(proposalNonce < _nonce, "Invalid nonce");
        require(_nonce < proposalNonce + 1048, "Nonce must not increment more than 1048");
        require(_feeRecipient != address(0), "Fee Recipient cannot be zero address");
        feeRecipient = _feeRecipient;
        proposalNonce = _nonce;
    }

    /**
        @notice Removes a token at `index` from the GovernedMultiTokenWrapperERC1155's wrapping list
        @param tokenAddress The address of the wrapping token whose wrapping list will be updated
        @param index The index of the token to be removed
     */
    function removeTokenAtIndex(address tokenAddress, uint index) internal {
        tokens[tokenAddress][index] = tokens[tokenAddress][tokens[tokenAddress].length-1];
        tokens[tokenAddress].pop();
    }

    /**
        @notice Gets the current fee percentage
        @return uint16 The fee percentage
     */
    function getFee(address tokenAddress) view external returns (uint16) {
        return wrappedTokenToWrappingFeePercentage[tokenAddress];
    }

    /**
        @notice Checks if the token at `tokenAddress` is valid (i.e. if it's in the wrapping list)
        @param fromTokenAddress The address of the token to be checked in the `toTokenAddress` wrapping list
        @param toTokenAddress The address of the token whose wrapping list is being checked
        @return bool Whether or not the token is valid
     */
    function _isValidAddress(address fromTokenAddress, address toTokenAddress) override internal virtual returns (bool) {
        return valid[toTokenAddress][fromTokenAddress];
    }
    
    /**
        @notice Checks if the token at `tokenAddress` is historically valid
        (i.e. if it was in the wrapping list at any point in history).
        @param fromTokenAddress The address of the token to be checked in the `toTokenAddress` wrapping history
        @param toTokenAddress The address of the token whose history is being checked
        @return bool Whether or not the token is historically valid
     */
    function _isValidHistoricalAddress(address fromTokenAddress, address toTokenAddress) override internal virtual returns (bool) {
        return historicallyValid[toTokenAddress][fromTokenAddress];
    }

    /**
        @notice Checks if an amount of the underlying token can be wrapped or if the limit has been reached
        @param amount The amount of the underlying token to be wrapped
        @param toTokenAddress The address of the wrapped token whose total supply is being checked
        @return bool Whether or not the amount can be wrapped
     */
    function _isValidAmount(address toTokenAddress, uint256 amount) override internal virtual returns (bool) {
        uint tokenId = wrappedTokenToTokenId[toTokenAddress];
        return amount + totalSupply(tokenId) <= wrappingLimit[toTokenAddress];
    }

    /**
        @notice Checks if the native token is allowed to be wrapped
        @param toTokenAddress The address of the wrapped token
        @return bool Whether or not the native token is allowed to be wrapped
     */
    function _isNativeValid(address toTokenAddress) override internal virtual returns (bool) {
        // TODO: Check if the native token is allowed to be wrapped into the provided token address
        return isNativeAllowed[toTokenAddress];
    }

    /**
        @notice Gets the currently available wrappable tokens by their addresses
        @return address[] The currently available wrappable token addresses
     */
    function getTokens(address toTokenAddress) external view returns (address[] memory) {
        return tokens[toTokenAddress];
    }

    /**
        @notice Modifier for enforcing that the caller is the governor
     */
    modifier onlyGovernor() {
        require(msg.sender == governor, "Only governor can call this function");
        _;
    }
}
