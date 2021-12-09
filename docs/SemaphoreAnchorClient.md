# SemaphoreAnchorClient









## Methods

### broadcastSignal

```solidity
function broadcastSignal(bytes _signal, uint256[8] _proof, bytes _roots, uint256 _nullifiersHash, uint232 _externalNullifier) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _signal | bytes | undefined
| _proof | uint256[8] | undefined
| _roots | bytes | undefined
| _nullifiersHash | uint256 | undefined
| _externalNullifier | uint232 | undefined

### getExternalNullifierBySignalIndex

```solidity
function getExternalNullifierBySignalIndex(uint256 _index) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _index | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getSignalBySignalIndex

```solidity
function getSignalBySignalIndex(uint256 _index) external view returns (bytes)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _index | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | undefined

### nextSignalIndex

```solidity
function nextSignalIndex() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### semaphore

```solidity
function semaphore() external view returns (contract SemaphoreAnchorBase)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract SemaphoreAnchorBase | undefined

### signalIndexToExternalNullifier

```solidity
function signalIndexToExternalNullifier(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### signalIndexToSignal

```solidity
function signalIndexToSignal(uint256) external view returns (bytes)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | undefined



## Events

### SignalBroadcastByClient

```solidity
event SignalBroadcastByClient(uint256 indexed signalIndex)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| signalIndex `indexed` | uint256 | undefined |



