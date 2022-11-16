# ITreasury

*Webb Technologies.*

> Interface for Treasury contract.





## Methods

### rescueTokens

```solidity
function rescueTokens(address _tokenAddress, address payable _to, uint256 _amountToRescue, uint32 _nonce) external nonpayable
```

Sends an `_amountToRescue` of tokens at `_tokenAddress` from the treasury contract to `_to`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | Address of the token to rescue.
| _to | address payable | Address of the recipient.
| _amountToRescue | uint256 | Amount of tokens to rescue.
| _nonce | uint32 | Nonce of the rescue transaction.

### setHandler

```solidity
function setHandler(address _newHandler, uint32 _nonce) external nonpayable
```

Sets the handler responsible with relaying rescue transactions.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _newHandler | address | Address of the handler.
| _nonce | uint32 | Nonce of the update.




