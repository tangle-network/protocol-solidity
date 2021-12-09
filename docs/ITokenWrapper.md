# ITokenWrapper

*Webb Technologies.*

> Interface for Token Wrapper contract.





## Methods

### getAmountToWrap

```solidity
function getAmountToWrap(uint256 deposit) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| deposit | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getFeeFromAmount

```solidity
function getFeeFromAmount(uint256 amountToWrap) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amountToWrap | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### setFee

```solidity
function setFee(uint8 feePercentage) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| feePercentage | uint8 | undefined

### unwrap

```solidity
function unwrap(address tokenAddress, uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | undefined
| amount | uint256 | undefined

### unwrapAndSendTo

```solidity
function unwrapAndSendTo(address tokenAddress, uint256 amount, address recipient) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | undefined
| amount | uint256 | undefined
| recipient | address | undefined

### unwrapFor

```solidity
function unwrapFor(address sender, address tokenAddress, uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | undefined
| tokenAddress | address | undefined
| amount | uint256 | undefined

### wrap

```solidity
function wrap(address tokenAddress, uint256 amount) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | undefined
| amount | uint256 | undefined

### wrapFor

```solidity
function wrapFor(address sender, address tokenAddress, uint256 amount) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | undefined
| tokenAddress | address | undefined
| amount | uint256 | undefined

### wrapForAndSendTo

```solidity
function wrapForAndSendTo(address sender, address tokenAddress, uint256 amount, address mintRecipient) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | undefined
| tokenAddress | address | undefined
| amount | uint256 | undefined
| mintRecipient | address | undefined




