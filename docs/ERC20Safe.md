# ERC20Safe

*ChainSafe Systems.*

> Manages deposited ERC20s.

This contract is intended to be used with ERC20Handler contract.



## Methods

### fundERC20

```solidity
function fundERC20(address tokenAddress, address owner, uint256 amount) external nonpayable
```

Used to transfer tokens into the safe to fund proposals.



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | Address of ERC20 to transfer.
| owner | address | Address of current token owner.
| amount | uint256 | Amount of tokens to transfer.




