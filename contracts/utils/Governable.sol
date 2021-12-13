//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";

contract Governable {
    address private _governor;

    event GovernanceOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RecoveredAddress(address indexed recovered);

    mapping (bytes32 => bool) private _usedHashes;

    constructor () {
        _governor = msg.sender;
        emit GovernanceOwnershipTransferred(address(0), _governor);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function governor() public view returns (address) {
        return _governor;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyGovernor() {
        require(isGovernor(), "Governable: caller is not the governor");
        _;
    }

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isGovernor() public view returns (bool) {
        return msg.sender == _governor;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyGovernor` functions anymore. Can only be called by the current owner.
     *
     * > Note: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyGovernor {
        emit GovernanceOwnershipTransferred(_governor, address(0));
        _governor = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public onlyGovernor {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnershipWithSignature(address newOwner, bytes memory sig, bytes memory data) public {
        // bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        // bytes32 prefixedHash = keccak256(prefix, hash);
        bytes32 hashedData = keccak256(data);
        // require(_usedHashes[hashedData] == false, "Governable: data has already been used");
        address signer = ECDSA.recover(hashedData, sig);
        require(signer == governor(), "Governable: caller is not the governor");
        _transferOwnership(newOwner);
        // _usedHashes[hashedData] = true;
    }

    function verify(bytes32 hash, uint8 v, bytes32 r, bytes32 s) public view returns(bool) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHash = keccak256(abi.encodePacked(prefix, hash));
        return ecrecover(prefixedHash, v, r, s) == governor();
    }

    function checkPubKey(bytes calldata pubkey) public view returns (bool){
        return (uint(keccak256(pubkey)) & 0x00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) == uint256(uint160(msg.sender));
    }

    function recover(bytes memory data, bytes memory sig) public {
        bytes32 hashedData = keccak256(data);
        address signer = ECDSA.recover(hashedData, sig);
        emit RecoveredAddress(signer);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Governable: new owner is the zero address");
        emit GovernanceOwnershipTransferred(_governor, newOwner);
        _governor = newOwner;
    }
}