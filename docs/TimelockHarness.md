# TimelockHarness









## Methods

### GRACE_PERIOD

```solidity
function GRACE_PERIOD() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MAXIMUM_DELAY

```solidity
function MAXIMUM_DELAY() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MINIMUM_DELAY

```solidity
function MINIMUM_DELAY() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### acceptAdmin

```solidity
function acceptAdmin() external nonpayable
```






### admin

```solidity
function admin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

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

### harnessSetAdmin

```solidity
function harnessSetAdmin(address admin_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| admin_ | address | undefined

### harnessSetPendingAdmin

```solidity
function harnessSetPendingAdmin(address pendingAdmin_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| pendingAdmin_ | address | undefined

### pendingAdmin

```solidity
function pendingAdmin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

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
function queuedTransactions(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### setDelay

```solidity
function setDelay(uint256 delay_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| delay_ | uint256 | undefined

### setPendingAdmin

```solidity
function setPendingAdmin(address pendingAdmin_) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| pendingAdmin_ | address | undefined



## Events

### CancelTransaction

```solidity
event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| txHash `indexed` | bytes32 | undefined |
| target `indexed` | address | undefined |
| value  | uint256 | undefined |
| signature  | string | undefined |
| data  | bytes | undefined |
| eta  | uint256 | undefined |

### ExecuteTransaction

```solidity
event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| txHash `indexed` | bytes32 | undefined |
| target `indexed` | address | undefined |
| value  | uint256 | undefined |
| signature  | string | undefined |
| data  | bytes | undefined |
| eta  | uint256 | undefined |

### NewAdmin

```solidity
event NewAdmin(address indexed newAdmin)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newAdmin `indexed` | address | undefined |

### NewDelay

```solidity
event NewDelay(uint256 indexed newDelay)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newDelay `indexed` | uint256 | undefined |

### NewPendingAdmin

```solidity
event NewPendingAdmin(address indexed newPendingAdmin)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newPendingAdmin `indexed` | address | undefined |

### QueueTransaction

```solidity
event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256 value, string signature, bytes data, uint256 eta)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| txHash `indexed` | bytes32 | undefined |
| target `indexed` | address | undefined |
| value  | uint256 | undefined |
| signature  | string | undefined |
| data  | bytes | undefined |
| eta  | uint256 | undefined |



