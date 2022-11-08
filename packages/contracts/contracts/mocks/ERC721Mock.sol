// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ERC721Mock is ERC721("Webb Spider Punks", "SPDR") {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenId;

    function mint(address account) public {
        _tokenId.increment();
        _mint(account, _tokenId.current());
    }
}