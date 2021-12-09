# TimelockInterface









## Methods

### GRACE_PERIOD

```solidity
function GRACE_PERIOD() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### acceptAdmin

```solidity
function acceptAdmin() external nonpayable
```






### cancelTransaction

```solidity
function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| target | address | undefined
| value | uint256 | undefined
| signature | string | undefined
| data | bytes | undefined
| eta | uint256 | undefined

### delay

```solidity
function delay() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### executeTransaction

```solidity
function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external payable returns (bytes)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| target | address | undefined
| value | uint256 | undefined
| signature | string | undefined
| data | bytes | undefined
| eta | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | undefined

### queueTransaction

```solidity
function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable returns (bytes32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| target | address | undefined
| value | uint256 | undefined
| signature | string | undefined
| data | bytes | undefined
| eta | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### queuedTransactions

```solidity
function queuedTransactions(bytes32 hash) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| hash | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined




