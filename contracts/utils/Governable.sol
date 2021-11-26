//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Governable {
    address private _governor;

    event GovernanceOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

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
    function transferOwnershipWithSignature(address newOwner, bytes memory sig, bytes memory data) public onlyGovernor {
        bytes32 hashedData = keccak256(data);
        require(_usedHashes[hashedData] == false, "Governable: data has already been used");
        address signer = ECDSA.recover(hashedData, sig);
        require(signer == governor(), "Governable: caller is not the governor");
        _transferOwnership(newOwner);
        _usedHashes[hashedData] = true;
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