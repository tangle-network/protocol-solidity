# IERCHandler

*ChainSafe Systems.*

> Interface to be used with handlers that support ERC20s and ERC721s.





## Methods

### setBurnable

```solidity
function setBurnable(address contractAddress) external nonpayable
```

First verifies {contractAddress} is whitelisted, then sets {_burnList}[{contractAddress}] to true.



#### Parameters

| Name | Type | Description |
|---|---|---|
| contractAddress | address | Address of contract to be used when making or executing deposits.

### withdraw

```solidity
function withdraw(address tokenAddress, address recipient, uint256 amountOrTokenID) external nonpayable
```

Used to manually release funds from ERC safes.



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | Address of token contract to release.
| recipient | address | Address to release tokens to.
| amountOrTokenID | uint256 | Either the amount of ERC20 tokens or the ERC721 token ID to release.




