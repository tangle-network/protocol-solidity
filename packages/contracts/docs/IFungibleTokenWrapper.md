# IFungibleTokenWrapper

*Webb Technologies.*

> Interface for Token Wrapper contract.





## Methods

### add

```solidity
function add(address _tokenAddress, uint32 _nonce) external nonpayable
```

Adds a token at `_tokenAddress` to the FungibleTokenWrapper&#39;s wrapping listOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to be added
| _nonce | uint32 | The nonce tracking updates to this contract

### remove

```solidity
function remove(address _tokenAddress, uint32 _nonce) external nonpayable
```

Removes a token at `_tokenAddress` from the FungibleTokenWrapper&#39;s wrapping listOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to be removed
| _nonce | uint32 | The nonce tracking updates to this contract

### setFee

```solidity
function setFee(uint16 _feePercentage, uint32 _nonce) external nonpayable
```

Sets a new `_feePercentage` for the FungibleTokenWrapperOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feePercentage | uint16 | The new fee percentage
| _nonce | uint32 | The nonce tracking updates to this contract

### setFeeRecipient

```solidity
function setFeeRecipient(address payable _feeRecipient, uint32 _nonce) external nonpayable
```

Sets a new `_feeRecipient` for the FungibleTokenWrapperOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeRecipient | address payable | The new fee recipient
| _nonce | uint32 | The nonce tracking updates to this contract




