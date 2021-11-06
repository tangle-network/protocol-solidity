// https://tornado.cash
/*
 * d888888P                                           dP              a88888b.                   dP
 *    88                                              88             d8'   `88                   88
 *    88    .d8888b. 88d888b. 88d888b. .d8888b. .d888b88 .d8888b.    88        .d8888b. .d8888b. 88d888b.
 *    88    88'  `88 88'  `88 88'  `88 88'  `88 88'  `88 88'  `88    88        88'  `88 Y8ooooo. 88'  `88
 *    88    88.  .88 88       88    88 88.  .88 88.  .88 88.  .88 dP Y8.   .88 88.  .88       88 88    88
 *    dP    `88888P' dP       dP    dP `88888P8 `88888P8 `88888P' 88  Y88888P' `88888P8 `88888P' dP    dP
 * ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

interface IHasher {
  function poseidon(bytes32[2] calldata inputs) external pure returns (bytes32);
}

contract VMerkleTreeWithHistory is Initializable {
  uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint256 public constant ZERO_VALUE = 21663839004416932945382355908790599225266501822907911457504978515578255421292; // = keccak256("tornado") % FIELD_SIZE

  IHasher public immutable hasher;
  uint32 public immutable levels; // should be immutable...

  // the following variables are made public for easier testing and debugging and
  // are not supposed to be accessed in regular code

  // filledSubtrees and roots could be bytes32[size], but using mappings makes it cheaper because
  // it removes index range check on every interaction
  mapping(uint256 => bytes32) public filledSubtrees;
  mapping(uint256 => bytes32) public roots;
  uint32 public constant ROOT_HISTORY_SIZE = 30;
  uint32 public currentRootIndex = 0; // todo remove
  uint32 public nextIndex = 0;

  constructor(uint32 _levels, address _hasher) {
    require(_levels > 0, "_levels should be greater than zero");
    require(_levels < 32, "_levels should be less than 32");
    levels = _levels;
    hasher = IHasher(_hasher);
    for (uint32 i = 0; i < _levels; i++) {
      filledSubtrees[i] = zeros(i);
    }

    roots[0] = zeros(_levels);
  }

  function _initialize() internal{}

  // function _initialize() internal {
  //   for (uint32 i = 0; i < levels; i++) {
  //     filledSubtrees[i] = zeros(i);
  //   }

  //   roots[0] = zeros(levels);
  // }

  /**
    @dev Hash 2 tree leaves, returns Poseidon(_left, _right)
  */
  function hashLeftRight(bytes32 _left, bytes32 _right) public view returns (bytes32) {
    require(uint256(_left) < FIELD_SIZE, "_left should be inside the field");
    require(uint256(_right) < FIELD_SIZE, "_right should be inside the field");
    bytes32[2] memory input;
    input[0] = _left;
    input[1] = _right;
    return hasher.poseidon(input);
  }

  // Modified to insert pairs of leaves for better efficiency
  function _insert(bytes32 _leaf1, bytes32 _leaf2) internal returns (uint32 index) {
    uint32 _nextIndex = nextIndex;
    require(_nextIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
    uint32 currentIndex = _nextIndex / 2;
    bytes32 currentLevelHash = hashLeftRight(_leaf1, _leaf2);
    bytes32 left;
    bytes32 right;

    for (uint32 i = 1; i < levels; i++) {
      if (currentIndex % 2 == 0) {
        left = currentLevelHash;
        right = zeros(i);
        filledSubtrees[i] = currentLevelHash;
      } else {
        left = filledSubtrees[i];
        right = currentLevelHash;
      }
      currentLevelHash = hashLeftRight(left, right);
      currentIndex /= 2;
    }

    uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
    currentRootIndex = newRootIndex;
    roots[newRootIndex] = currentLevelHash;
    nextIndex = _nextIndex + 2;
    return _nextIndex;
  }

  /**
    @dev Whether the root is present in the root history
  */
  function isKnownRoot(bytes32 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }
    uint32 _currentRootIndex = currentRootIndex;
    uint32 i = _currentRootIndex;
    do {
      if (_root == roots[i]) {
        return true;
      }
      if (i == 0) {
        i = ROOT_HISTORY_SIZE;
      }
      i--;
    } while (i != _currentRootIndex);
    return false;
  }

  /**
    @dev Returns the last root
  */
  function getLastRoot() public view returns (bytes32) {
    return roots[currentRootIndex];
  }

  /// @dev provides Zero (Empty) elements for a MiMC MerkleTree. Up to 32 levels
  function zeros(uint256 i) public pure returns (bytes32) {
    if (i == 0) return bytes32(0x2fe54c60d3acabf3343a35b6eba15db4821b340f76e741e2249685ed4899af6c);
    else if (i == 1) return bytes32(0x13e37f2d6cb86c78ccc1788607c2b199788c6bb0a615a21f2e7a8e88384222f8);
    else if (i == 2) return bytes32(0x217126fa352c326896e8c2803eec8fd63ad50cf65edfef27a41a9e32dc622765);
    else if (i == 3) return bytes32(0x0e28a61a9b3e91007d5a9e3ada18e1b24d6d230c618388ee5df34cacd7397eee);
    else if (i == 4) return bytes32(0x27953447a6979839536badc5425ed15fadb0e292e9bc36f92f0aa5cfa5013587);
    else if (i == 5) return bytes32(0x194191edbfb91d10f6a7afd315f33095410c7801c47175c2df6dc2cce0e3affc);
    else if (i == 6) return bytes32(0x1733dece17d71190516dbaf1927936fa643dc7079fc0cc731de9d6845a47741f);
    else if (i == 7) return bytes32(0x267855a7dc75db39d81d17f95d0a7aa572bf5ae19f4db0e84221d2b2ef999219);
    else if (i == 8) return bytes32(0x1184e11836b4c36ad8238a340ecc0985eeba665327e33e9b0e3641027c27620d);
    else if (i == 9) return bytes32(0x0702ab83a135d7f55350ab1bfaa90babd8fc1d2b3e6a7215381a7b2213d6c5ce);
    else if (i == 10) return bytes32(0x2eecc0de814cfd8c57ce882babb2e30d1da56621aef7a47f3291cffeaec26ad7);
    else if (i == 11) return bytes32(0x280bc02145c155d5833585b6c7b08501055157dd30ce005319621dc462d33b47);
    else if (i == 12) return bytes32(0x045132221d1fa0a7f4aed8acd2cbec1e2189b7732ccb2ec272b9c60f0d5afc5b);
    else if (i == 13) return bytes32(0x27f427ccbf58a44b1270abbe4eda6ba53bd6ac4d88cf1e00a13c4371ce71d366);
    else if (i == 14) return bytes32(0x1617eaae5064f26e8f8a6493ae92bfded7fde71b65df1ca6d5dcec0df70b2cef);
    else if (i == 15) return bytes32(0x20c6b400d0ea1b15435703c31c31ee63ad7ba5c8da66cec2796feacea575abca);
    else if (i == 16) return bytes32(0x09589ddb438723f53a8e57bdada7c5f8ed67e8fece3889a73618732965645eec);
    else if (i == 17) return bytes32(0x0064b6a738a5ff537db7b220f3394f0ecbd35bfd355c5425dc1166bf3236079b);
    else if (i == 18) return bytes32(0x095de56281b1d5055e897c3574ff790d5ee81dbc5df784ad2d67795e557c9e9f);
    else if (i == 19) return bytes32(0x11cf2e2887aa21963a6ec14289183efe4d4c60f14ecd3d6fe0beebdf855a9b63);
    else if (i == 20) return bytes32(0x2b0f6fc0179fa65b6f73627c0e1e84c7374d2eaec44c9a48f2571393ea77bcbb);
    else if (i == 21) return bytes32(0x16fdb637c2abf9c0f988dbf2fd64258c46fb6a273d537b2cf1603ea460b13279);
    else if (i == 22) return bytes32(0x21bbd7e944f6124dad4c376df9cc12e7ca66e47dff703ff7cedb1a454edcf0ff);
    else if (i == 23) return bytes32(0x2784f8220b1c963e468f590f137baaa1625b3b92a27ad9b6e84eb0d3454d9962);
    else if (i == 24) return bytes32(0x16ace1a65b7534142f8cc1aad810b3d6a7a74ca905d9c275cb98ba57e509fc10);
    else if (i == 25) return bytes32(0x2328068c6a8c24265124debd8fe10d3f29f0665ea725a65e3638f6192a96a013);
    else if (i == 26) return bytes32(0x2ddb991be1f028022411b4c4d2c22043e5e751c120736f00adf54acab1c9ac14);
    else if (i == 27) return bytes32(0x0113798410eaeb95056a464f70521eb58377c0155f2fe518a5594d38cc209cc0);
    else if (i == 28) return bytes32(0x202d1ae61526f0d0d01ef80fb5d4055a7af45721024c2c24cffd6a3798f54d50);
    else if (i == 29) return bytes32(0x23ab323453748129f2765f79615022f5bebd6f4096a796300aab049a60b0f187);
    else if (i == 30) return bytes32(0x1f15585f8947e378bcf8bd918716799da909acdb944c57150b1eb4565fda8aa0);
    else if (i == 31) return bytes32(0x1eb064b21055ac6a350cf41eb30e4ce2cb19680217df3a243617c2838185ad06);
    else revert("Index out of bounds");
  }
}