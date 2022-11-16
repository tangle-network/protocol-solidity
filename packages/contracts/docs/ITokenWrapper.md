# ITokenWrapper

*Webb Technologies.*

> Interface for Token Wrapper contract.





## Methods

### getAmountToWrap

```solidity
function getAmountToWrap(uint256 _deposit) external view returns (uint256)
```

Gets the amount to wrap for an exact `_deposit` amount of tokens. This function calculates the amount needed to wrap inclusive of the fee that will be charged from `getFeeFromAmount` to meet the `_deposit` amount



#### Parameters

| Name | Type | Description |
|---|---|---|
| _deposit | uint256 | Amount of tokens needed for the deposit to be valid

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getFeeFromAmount

```solidity
function getFeeFromAmount(uint256 _amountToWrap) external view returns (uint256)
```

Gets the fee for an `_amountToWrap` amount of tokens



#### Parameters

| Name | Type | Description |
|---|---|---|
| _amountToWrap | uint256 | Amount of tokens to wrap

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | uint256 The fee amount for the `_amountToWrap` amount of tokens

### unwrap

```solidity
function unwrap(address _tokenAddress, uint256 _amount) external nonpayable
```

Unwraps an `amount` of an underlying token into the token at `tokenAddress`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | Address of the token to unwrap into
| _amount | uint256 | Amount of tokens to unwrap

### unwrapAndSendTo

```solidity
function unwrapAndSendTo(address _tokenAddress, uint256 _amount, address _recipient) external nonpayable
```

Unwraps an `amount` of an underlying token into the token at `tokenAddress` and sends to a `recipient` address



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | Address of the token to unwrap into
| _amount | uint256 | Amount of tokens to unwrap
| _recipient | address | Address of the recipient

### unwrapFor

```solidity
function unwrapFor(address _sender, address _tokenAddress, uint256 _amount) external nonpayable
```

Unwraps an `amount` of an underlying token into the token at `tokenAddress` for a `sender`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _sender | address | The sender address the tokens are being unwrapped for
| _tokenAddress | address | Address of the token to unwrap into
| _amount | uint256 | Amount of tokens to unwrap

### wrap

```solidity
function wrap(address _tokenAddress, uint256 _amount) external payable
```

Wraps an `amount` of tokens from `tokenAddress`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | Address of the token to wrap
| _amount | uint256 | Amount of tokens to wrap

### wrapFor

```solidity
function wrapFor(address _sender, address _tokenAddress, uint256 _amount) external payable
```

Wraps an `amount` of tokens from `tokenAddress` for the `sender`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _sender | address | The sender address the tokens are being wrapped for
| _tokenAddress | address | Address of the token to wrap
| _amount | uint256 | Amount of tokens to wrap

### wrapForAndSendTo

```solidity
function wrapForAndSendTo(address _sender, address _tokenAddress, uint256 _amount, address _mintRecipient) external payable
```

Wraps an `amount of tokens from `tokenAddress` for the `sender` address and sends to a `_mintRecipient` 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _sender | address | The sender address the tokens are being wrapped for
| _tokenAddress | address | Address of the token to wrap
| _amount | uint256 | Amount of tokens to wrap
| _mintRecipient | address | Address of the recipient of the wrapped tokens




