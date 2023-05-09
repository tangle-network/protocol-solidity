/**
 * Copyright 2021-2023 Webb Technologies
 * SPDX-License-Identifier: MIT OR Apache-2.0
 */

pragma solidity ^0.8.18;

import "./IHasher.sol";

/*
 * Keccak hash functions for 2 inputs.
 */
contract KeccakHasher is IHasher {
	function hash3(uint256[3] memory array) public pure override returns (uint256) {
		return uint256(keccak256(abi.encodePacked(array)));
	}

	function hash4(uint256[4] memory array) public pure override returns (uint256) {
		return uint256(keccak256(abi.encodePacked(array)));
	}

	function hashLeftRight(uint256 _left, uint256 _right) public pure override returns (uint256) {
		uint256 output = uint256(_left);
		uint256 right = uint256(_right);
		output = uint256(keccak256(abi.encodePacked(output, right)));
		return output;
	}

	/// @dev provides Zero (Empty) elements for a Poseidon MerkleTree. Up to 32 levels
	function zeros(uint256 i) public pure override returns (bytes32) {
		if (i == 0)
			return bytes32(0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c);
		else if (i == 1)
			return bytes32(0x4fc2fe9184a25f44ce8ddb5f32671fcae6d9c85ed710c199acef16ad16b29911);
		else if (i == 2)
			return bytes32(0x0d826a474f851c563052d929ef0daa70f658aba9ba084f51f6e3483c13c0e59a);
		else if (i == 3)
			return bytes32(0xf7761a16b5e4c0120e4c5704b910dbe18ff6162a9668ed1c2c4efde7c4f15806);
		else if (i == 4)
			return bytes32(0xce9ce09a0ab259d6d14ca3dcd74e6c6b9e7d9074bff66973d4c57ccdffdb2a82);
		else if (i == 5)
			return bytes32(0x02efd44c63015ff1385344e0624867775486d05e6eb1290a24976964a598003b);
		else if (i == 6)
			return bytes32(0xc4dec5845d407ce2ac2e6824bb7857c4b138f819e5789d5d11e812db10c846cd);
		else if (i == 7)
			return bytes32(0x5fbe3f20c23f3bd6ac347917fb0903433e0b9a48373412348240a5f919bfde19);
		else if (i == 8)
			return bytes32(0x92d1b07e56b3da96b7917778cb657f2c513eaeeb4d1579a73b5ea316f25b7289);
		else if (i == 9)
			return bytes32(0xa08add5656d6d3d0827ef909f7647981eac42aa1f51970a752f130f718f6d76a);
		else if (i == 10)
			return bytes32(0x1704c5f297590d8ec62776b0714f4f3f2234bae0524035342b0da8b8988ebd79);
		else if (i == 11)
			return bytes32(0xc5ae2bd47379c2c6d1189cfc3d057948dc6054caf845fcacd8f7affe94b11944);
		else if (i == 12)
			return bytes32(0x12a161d6d5561062f387d91ad9f0f8966c0956afdb9e8325458b9e5057b82bdb);
		else if (i == 13)
			return bytes32(0x4ade524ba596de20bbe94507a761c45251ae7a27857ceb4287d9018525b99bc5);
		else if (i == 14)
			return bytes32(0x38287ad69151fa833bf4bf8b8eb6ffb39400a38f1a7e53b473f639c8c60fd5e4);
		else if (i == 15)
			return bytes32(0x57f2ade7d711707e785451f2aba6c95872c7fe03153a98b7327b4024e8068fa3);
		else if (i == 16)
			return bytes32(0xb1982e0d1b0de46a88d8b17941472e41a86d3ff64571ed8e0ca72d58633547fc);
		else if (i == 17)
			return bytes32(0xb7c60f8670af15eb32b4ee36727179bc085a3dde03d5f9a1486664ba576b30a6);
		else if (i == 18)
			return bytes32(0x5ff905c5c659a926b132ef3665a3de5d5a859c1d479e68851085bfc0348c5331);
		else if (i == 19)
			return bytes32(0xb4dfa78b912e98c9f7eb42d71eb537a02bf3173d44a2eb887a48b3972072dd8e);
		else if (i == 20)
			return bytes32(0x60919a16a2eb8b91cfb8ba1e5b4c155a76a14c217b5403edbd563f34e508ecdc);
		else if (i == 21)
			return bytes32(0x5fc8c1e9d260531cade53159072fe9f14921a9559e5222dca7e28d504ab3dd04);
		else if (i == 22)
			return bytes32(0x7ef08ed4b30c17c851a892c539030a92e5319857aa0cd453330a31a0183ac975);
		else if (i == 23)
			return bytes32(0x6420ebe493376e2596f8082f7902dd5c83af477fa9e5d52b74f0f7759e2a9068);
		else if (i == 24)
			return bytes32(0x93766eb9a297fe6ca5c12f268f84999d275250c2408aaea8a0a66aa7aef520a9);
		else if (i == 25)
			return bytes32(0x52b9d8e178f12c49cd409cffc0a54139816ad9de9261f49d75e0cca3c581fab8);
		else if (i == 26)
			return bytes32(0x5191df2c0bd0f66075ef15f47daf661fab17bd7d9520e1b011c5f7cb17ac1c3c);
		else if (i == 27)
			return bytes32(0xca95564bdcd199f493f50a366e5a1ba1d749f136e586c2e81127fa0bba6b3076);
		else if (i == 28)
			return bytes32(0x6955b26d7325787f232d42480b9dce4241793c3fe249ea6fbe03c6a798b20512);
		else if (i == 29)
			return bytes32(0x02fab0f86aba653fbd368bbee2baa6092199592c90397b8c4b414803910e2553);
		else if (i == 30)
			return bytes32(0x3878a3ff0eda8bcd772059f6c38939e9b4888d7848b36e8645e3929e0ba2f974);
		else if (i == 31)
			return bytes32(0x819bff9ae5cb51403b906d369e5a1bbd8b791c51f7c27d3be41f9271d9434af1);
		else revert("Index out of bounds");
	}
}
