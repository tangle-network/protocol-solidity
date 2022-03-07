//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "hardhat/console.sol";

contract Governable {
    address private _governor;
    uint32 public refreshNonce = 0;

    // Storage values relevant to proposer set update
    uint32 public proposerSetUpdateNonce = 0;
    bytes32 public proposerSetRoot;
    uint64 public averageSessionLengthInMillisecs = 2**64 - 1;
    uint256 public sessionLengthMultiplier = 2;
    uint32 public numOfProposers;
    mapping (bytes => bool) alreadyVoted;
    uint256 public currentVotingPeriod = 0;
    mapping (uint256 => mapping(address => uint32)) numOfVotesForGovernor;


    struct Vote {
        bytes leaf;
        uint32 leafIndex;
        bytes32[] siblingPathNodes;
        address proposedGovernor;
    }

    // Last time ownership was transferred to a new govenror
    uint256 public lastGovernorUpdateTime;

    event GovernanceOwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RecoveredAddress(address indexed recovered);

    mapping (bytes32 => bool) private _usedHashes;

    constructor (address governor) {
        _governor = governor;
        lastGovernorUpdateTime = block.timestamp;
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
     * @dev Returns true if the signature is signed by the current governor.
     */
    function isSignatureFromGovernor(bytes memory data, bytes memory sig) public view returns (bool) {
        bytes32 hashedData = keccak256(data);
        address signer = ECDSA.recover(hashedData, sig);
        return signer == governor();
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
    function transferOwnership(address newOwner, uint32 nonce) public onlyGovernor {
        require(refreshNonce < nonce, "Invalid nonce");
        require(nonce <= refreshNonce + 1, "Nonce must increment by 1");
        _transferOwnership(newOwner);
        refreshNonce = nonce;
    }
    
    /**
     * @dev Transfers ownership of the contract to a new account associated with the publicKey    * input
     */
    function transferOwnershipWithSignaturePubKey(bytes memory publicKey, uint32 nonce, bytes memory sig) public {
        require(refreshNonce < nonce, "Invalid nonce");
        require(nonce <= refreshNonce + 1, "Nonce must increment by 1");
        bytes32 pubKeyHash = keccak256(publicKey);
        address newOwner = address(uint160(uint256(pubKeyHash)));
        require(isSignatureFromGovernor(abi.encodePacked(nonce, publicKey), sig), "Governable: caller is not the governor");
        _transferOwnership(newOwner);
        refreshNonce = nonce;
    }

    function recover(bytes memory data, bytes memory sig) public view returns (address) {
        bytes32 hashedData = keccak256(data);
        address signer = ECDSA.recover(hashedData, sig);
        return signer;
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address newOwner) internal {
        require(newOwner != address(0), "Governable: new owner is the zero address");
        emit GovernanceOwnershipTransferred(_governor, newOwner);
        _governor = newOwner;
        lastGovernorUpdateTime = block.timestamp;
        currentVotingPeriod++;
    }

    function updateProposerSetData(bytes32 _proposerSetRoot, uint64 _averageSessionLengthInMillisecs, uint32 _numOfProposers, uint32 _proposerSetUpdateNonce, bytes memory sig) public {
        // Valid Nonce
        require(proposerSetUpdateNonce < _proposerSetUpdateNonce, "Invalid nonce");
        require(_proposerSetUpdateNonce <= proposerSetUpdateNonce + 1, "Nonce must increment by 1");

        // Valid Signature
        require(isSignatureFromGovernor(abi.encodePacked(_proposerSetRoot, bytes8(_averageSessionLengthInMillisecs), bytes4(_numOfProposers), bytes4(_proposerSetUpdateNonce)), sig), "Governable: caller is not the governor");

        proposerSetRoot = _proposerSetRoot;
        averageSessionLengthInMillisecs = _averageSessionLengthInMillisecs;
        numOfProposers = _numOfProposers;
        proposerSetUpdateNonce = _proposerSetUpdateNonce;
        currentVotingPeriod++;
    }

    function voteInFavorForceSetGovernor(Vote memory vote) external {
        // Check time 
        require(block.timestamp >= lastGovernorUpdateTime + sessionLengthMultiplier * (averageSessionLengthInMillisecs / 1000), "Invalid time for vote");
        
        // Check merkle proof is valid
        require(_isValidMerkleProof(vote.siblingPathNodes, vote.leaf, vote.leafIndex), "invalid merkle proof");

        // Make sure not already voted
        require(!alreadyVoted[vote.leaf], "already voted");

        alreadyVoted[vote.leaf] = true;
        numOfVotesForGovernor[currentVotingPeriod][vote.proposedGovernor] += 1;
        _tryResolveVote(vote.proposedGovernor);
    }

    function _tryResolveVote(address proposedGovernor) internal {
        if (numOfVotesForGovernor[currentVotingPeriod][proposedGovernor] > numOfProposers / 2) {
            _transferOwnership(proposedGovernor);
        }
    }

    function _isValidMerkleProof(bytes32[] memory siblingPathNodes, bytes memory leaf, uint32 leafIndex) internal view returns (bool) {
        bytes32 leafHash = keccak256(leaf);
        bytes32 currNodeHash = leafHash;
        uint32 nodeIndex = leafIndex;

        for (uint8 i = 0; i < siblingPathNodes.length; i++) {
            if (nodeIndex % 2 == 0) {
                currNodeHash = keccak256(abi.encodePacked(currNodeHash, siblingPathNodes[i]));
            } else {
                currNodeHash = keccak256(abi.encodePacked(siblingPathNodes[i], currNodeHash));
            }
            nodeIndex = nodeIndex / 2;
        }
        return proposerSetRoot == currNodeHash;
    }
}