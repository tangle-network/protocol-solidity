// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IBatchTreeUpdateVerifier {
  // function verifyProof(
  //     bytes calldata proof,
  //     uint256[1] calldata input
  // ) external view returns (bool);
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[1] memory input
        ) external view returns (bool r);
}
