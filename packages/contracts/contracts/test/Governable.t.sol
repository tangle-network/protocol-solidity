/**
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */
pragma solidity >=0.8.19 <0.9.0;

import { PRBTest } from "@prb/test/PRBTest.sol";
import { console2 } from "forge-std/console2.sol";
import { StdCheats } from "forge-std/StdCheats.sol";

import { Governable, Vote } from "../utils/Governable.sol";
import { MerkleTreeMock as MerkleTree } from "../mocks/MerkleTreeMock.sol";
import { KeccakHasher } from "../hashers/KeccakHasher.sol";
import { ProposalHelpers } from "./ProposalHelpers.t.sol";

contract GovernableTest is PRBTest, StdCheats, ProposalHelpers {
	Governable governableContract;
	KeccakHasher hasher;
	MerkleTree tree;

	uint32 refreshNonce;

	address alice;
	address governor;

	function setUp() public virtual {
		alice = vm.addr(1);
		governor = alice;

		refreshNonce = 0;
		governableContract = new Governable(governor, refreshNonce);

		hasher = new KeccakHasher();
		tree = new MerkleTree(2, hasher);
	}

	function signWithGoverner(bytes memory data) public view returns (bytes memory) {
		(uint8 v, bytes32 r, bytes32 s) = vm.sign(1, keccak256(data));
		return abi.encodePacked(r, s, v);
	}

	function test_transferOwnership() public {
        address newGovernor = address(0x3);
		vm.prank(governor);
		governableContract.transferOwnership(newGovernor, refreshNonce + 1);
		assertEq(governableContract.governor(), newGovernor);
		assertEq(governableContract.refreshNonce(), refreshNonce + 1);
	}

	function test_transferOwnershipShouldFailFromNotGovernor(address newGovernor) public {
		vm.prank(vm.addr(2));
		vm.expectRevert(bytes("Governable: caller is not the governor"));
		governableContract.transferOwnership(newGovernor, refreshNonce + 1);
	}

	function test_transferOwnershipShouldFailIfTransferringToZero() public {
		vm.prank(governor);
		vm.expectRevert(bytes("Governable: New governor is the zero address"));
		governableContract.transferOwnership(address(0x0), refreshNonce + 1);
	}

	function test_transferOwnershipWithSignature() public {
		string
			memory pubkeyString = "989f3c75d99033df6074a25c7255629da79c57fd5379bcb6e2438d2bf339e1511a71de858155b44efcbe1f7621693fae07e57a531799a38c4d00e2904389e938";
		bytes memory pubkey = fromHex(pubkeyString);
		address newGovernor = 0xe725B59239D1b324CF0e0a93473009A155167733;
		bytes memory sig = signWithGoverner(abi.encodePacked(refreshNonce + 1, pubkey));
		vm.prank(governor);
		governableContract.transferOwnershipWithSignaturePubKey(pubkey, refreshNonce + 1, sig);
		assertEq(governableContract.governor(), newGovernor);
		assertEq(governableContract.refreshNonce(), refreshNonce + 1);
	}

	function test_transferOwnershipWithSignatureShouldFailWithInvalidNonce() public {
		string
			memory pubkeyString = "989f3c75d99033df6074a25c7255629da79c57fd5379bcb6e2438d2bf339e1511a71de858155b44efcbe1f7621693fae07e57a531799a38c4d00e2904389e938";
		bytes memory pubkey = fromHex(pubkeyString);
		address newGovernor = 0xe725B59239D1b324CF0e0a93473009A155167733;
		bytes memory sig = signWithGoverner(abi.encodePacked(newGovernor, refreshNonce + 2));
		vm.prank(governor);
		vm.expectRevert(bytes("Governable: Nonce must increment by 1"));
		governableContract.transferOwnershipWithSignaturePubKey(pubkey, refreshNonce + 2, sig);
	}

	function test_proposerSetUpdate(address[4] memory proposers) public {
		for (uint i = 0; i < proposers.length; i++) {
			tree.insert(uint256(keccak256(abi.encodePacked(proposers[i]))));
		}

		bytes32 merkleRoot = bytes32(tree.getLastRoot());
		uint64 averageSessionLengthInMillisecs = 50000;
		uint32 numOfProposers = 4;
		uint32 proposerSetUpdateNonce = 1;
		bytes memory proposerSetUpdate = buildProposerSetUpdateProposal(
			merkleRoot,
			averageSessionLengthInMillisecs,
			numOfProposers,
			proposerSetUpdateNonce
		);

		bytes memory sig = signWithGoverner(proposerSetUpdate);

		vm.prank(governor);
		governableContract.updateProposerSetData(
			merkleRoot,
			averageSessionLengthInMillisecs,
			numOfProposers,
			proposerSetUpdateNonce,
			sig
		);

		assertEq(governableContract.proposerSetUpdateNonce(), proposerSetUpdateNonce);
		assertEq(governableContract.proposerSetRoot(), merkleRoot);
		assertEq(
			governableContract.averageSessionLengthInMillisecs(),
			averageSessionLengthInMillisecs
		);
		assertEq(governableContract.numOfProposers(), numOfProposers);
		assertEq(governableContract.currentVotingPeriod(), 1);
	}

	function test_proposerSetUpdateForceChangeGovernor() public {
		address[] memory proposers = new address[](4);

		for (uint256 i = 0; i < 4; i++) {
			address proposer = vm.addr(uint256(keccak256(abi.encodePacked(i))));
			vm.deal(proposer, 100 ether);
			proposers[i] = proposer;
		}

		for (uint i = 0; i < proposers.length; i++) {
			tree.insert(uint256(keccak256(abi.encodePacked(proposers[i]))));
		}

		bytes32 merkleRoot = bytes32(tree.getLastRoot());
		uint64 averageSessionLengthInMillisecs = 50000;
		uint32 numOfProposers = 4;
		uint32 proposerSetUpdateNonce = 1;
		bytes memory proposerSetUpdate = buildProposerSetUpdateProposal(
			merkleRoot,
			averageSessionLengthInMillisecs,
			numOfProposers,
			proposerSetUpdateNonce
		);

		bytes memory sig = signWithGoverner(proposerSetUpdate);

		vm.prank(governor);
		governableContract.updateProposerSetData(
			merkleRoot,
			averageSessionLengthInMillisecs,
			numOfProposers,
			proposerSetUpdateNonce,
			sig
		);

		// Now execute the voting protocol
		vm.warp(
			block.timestamp +
				averageSessionLengthInMillisecs *
				governableContract.sessionLengthMultiplier()
		);
		address newGovernor = vm.addr(2);
		// We only need a majority of votes so we can skip the last proposer
		for (uint i = 0; i < proposers.length - 1; i++) {
			bytes32[] memory path = getPathForLeaf(proposers, i, merkleRoot);
			Vote memory vote = governableContract.createVote(uint32(i), newGovernor, path);
			vm.prank(proposers[i]);
			governableContract.voteInFavorForceSetGovernor(vote);
		}

		assertEq(governableContract.governor(), newGovernor);
		assertEq(governableContract.currentVotingPeriod(), 2);
	}

	function test_proposerSetUpdateForceChangeGovernorWithSig() public {
		address[] memory proposers = new address[](4);

		for (uint256 i = 0; i < 4; i++) {
			address proposer = vm.addr(uint256(keccak256(abi.encodePacked(i))));
			vm.deal(proposer, 100 ether);
			proposers[i] = proposer;
		}

		for (uint i = 0; i < proposers.length; i++) {
			tree.insert(uint256(keccak256(abi.encodePacked(proposers[i]))));
		}

		bytes32 merkleRoot = bytes32(tree.getLastRoot());
		uint64 averageSessionLengthInMillisecs = 50000;
		uint32 numOfProposers = 4;
		uint32 proposerSetUpdateNonce = 1;
		bytes memory proposerSetUpdate = buildProposerSetUpdateProposal(
			merkleRoot,
			averageSessionLengthInMillisecs,
			numOfProposers,
			proposerSetUpdateNonce
		);

		bytes memory sig = signWithGoverner(proposerSetUpdate);

		vm.prank(governor);
		governableContract.updateProposerSetData(
			merkleRoot,
			averageSessionLengthInMillisecs,
			numOfProposers,
			proposerSetUpdateNonce,
			sig
		);

		// Now execute the voting protocol
		vm.warp(
			block.timestamp +
				averageSessionLengthInMillisecs *
				governableContract.sessionLengthMultiplier()
		);
		address newGovernor = vm.addr(2);
		// We only need a majority of votes so we can skip the last proposer
		Vote[] memory votes = new Vote[](proposers.length - 1);
		bytes[] memory sigs = new bytes[](proposers.length - 1);
		for (uint i = 0; i < proposers.length - 1; i++) {
			bytes32[] memory path = getPathForLeaf(proposers, i, merkleRoot);
			Vote memory vote = governableContract.createVote(uint32(i), newGovernor, path);
			// Sign the vote with the proposer's key
			(uint8 v, bytes32 r, bytes32 s) = vm.sign(
				uint256(keccak256(abi.encodePacked(i))),
				keccak256(abi.encode(vote))
			);
			bytes memory sig = abi.encodePacked(r, s, v);
			votes[i] = vote;
			sigs[i] = sig;
		}
		// Submit the votes and signatures
		governableContract.voteInFavorForceSetGovernorWithSig(votes, sigs);
		assertEq(governableContract.governor(), newGovernor);
		assertEq(governableContract.currentVotingPeriod(), 2);
	}

	// Convert an hexadecimal character to their value
	function fromHexChar(uint8 c) public pure returns (uint8) {
		if (bytes1(c) >= bytes1("0") && bytes1(c) <= bytes1("9")) {
			return c - uint8(bytes1("0"));
		}
		if (bytes1(c) >= bytes1("a") && bytes1(c) <= bytes1("f")) {
			return 10 + c - uint8(bytes1("a"));
		}
		if (bytes1(c) >= bytes1("A") && bytes1(c) <= bytes1("F")) {
			return 10 + c - uint8(bytes1("A"));
		}
		revert("fail");
	}

	// Convert an hexadecimal string to raw bytes
	function fromHex(string memory s) public pure returns (bytes memory) {
		bytes memory ss = bytes(s);
		require(ss.length % 2 == 0); // length must be even
		bytes memory r = new bytes(ss.length / 2);
		for (uint i = 0; i < ss.length / 2; ++i) {
			r[i] = bytes1(fromHexChar(uint8(ss[2 * i])) * 16 + fromHexChar(uint8(ss[2 * i + 1])));
		}
		return r;
	}

	/// Calculate the merkle path for a given node given all the leaves, the index we want
	/// to prove, and the root to check against to ensure we have the correct path.
	function getPathForLeaf(
		address[] memory proposers,
		uint index,
		bytes32 root
	) public returns (bytes32[] memory) {
		bytes32[4] memory firstLayer = [
			keccak256(abi.encodePacked(proposers[0])),
			keccak256(abi.encodePacked(proposers[1])),
			keccak256(abi.encodePacked(proposers[2])),
			keccak256(abi.encodePacked(proposers[3]))
		];
		bytes32[2] memory secondLayer = [
			keccak256(abi.encodePacked(firstLayer[0], firstLayer[1])),
			keccak256(abi.encodePacked(firstLayer[2], firstLayer[3]))
		];

		bytes32 calculatedRoot = keccak256(abi.encodePacked(secondLayer[0], secondLayer[1]));
		require(calculatedRoot == root, "Invalid root");

		bytes32[] memory siblingPath = new bytes32[](2);
		if (index == 0) {
			siblingPath[0] = firstLayer[1];
			siblingPath[1] = secondLayer[1];
		} else if (index == 1) {
			siblingPath[0] = firstLayer[0];
			siblingPath[1] = secondLayer[1];
		} else if (index == 2) {
			siblingPath[0] = firstLayer[3];
			siblingPath[1] = secondLayer[0];
		} else if (index == 3) {
			siblingPath[0] = firstLayer[2];
			siblingPath[1] = secondLayer[0];
		} else {
			revert("Invalid index");
		}

		// Verify the sibling path
		bytes32 currNodeHash = firstLayer[index];
		uint nextIndex = index;
		for (uint i = 0; i < siblingPath.length; i++) {
			if (nextIndex % 2 == 0) {
				currNodeHash = keccak256(abi.encodePacked(currNodeHash, siblingPath[i]));
			} else {
				currNodeHash = keccak256(abi.encodePacked(siblingPath[i], currNodeHash));
			}
			nextIndex = nextIndex / 2;
		}
		require(currNodeHash == root, "Invalid sibling path");
		return siblingPath;
	}
}
