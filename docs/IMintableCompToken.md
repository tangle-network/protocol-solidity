# IMintableCompToken

*ChainSafe Systems.*

> Interface for Bridge contract.





## Methods

### delegate

```solidity
function delegate(address delegatee) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| delegatee | address | undefined

### delegateBySig

```solidity
function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| delegatee | address | undefined
| nonce | uint256 | undefined
| expiry | uint256 | undefined
| v | uint8 | undefined
| r | bytes32 | undefined
| s | bytes32 | undefined

### getCurrentVotes

```solidity
function getCurrentVotes(address account) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getPriorVotes

```solidity
function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined
| blockNumber | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### mint

```solidity
function mint(address to, uint256 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined
| amount | uint256 | undefined

### transfer

```solidity
function transfer(address dst, uint256 rawAmount) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| dst | address | undefined
| rawAmount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### transferFrom

```solidity
function transferFrom(address src, address dst, uint256 rawAmount) external nonpayable returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| src | address | undefined
| dst | address | undefined
| rawAmount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined




