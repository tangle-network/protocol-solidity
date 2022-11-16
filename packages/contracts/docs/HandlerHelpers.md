# HandlerHelpers

*Webb Technologies, adapted from ChainSafe Systems.*

> Function used across handler contracts.

This contract is intended to be used with the Bridge contract.



## Methods

### _bridgeAddress

```solidity
function _bridgeAddress() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### _contractAddressToResourceID

```solidity
function _contractAddressToResourceID(address) external view returns (bytes32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### _contractWhitelist

```solidity
function _contractWhitelist(address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### _resourceIDToContractAddress

```solidity
function _resourceIDToContractAddress(bytes32) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### executeProposal

```solidity
function executeProposal(bytes32 resourceID, bytes data) external nonpayable
```

It is intended that proposals are executed by the Bridge contract.



#### Parameters

| Name | Type | Description |
|---|---|---|
| resourceID | bytes32 | undefined
| data | bytes | Consists of additional data needed for a specific deposit execution.

### migrateBridge

```solidity
function migrateBridge(address newBridge) external nonpayable
```

Migrates the bridge to a new bridge address



#### Parameters

| Name | Type | Description |
|---|---|---|
| newBridge | address | New bridge address

### setResource

```solidity
function setResource(bytes32 resourceID, address contractAddress) external nonpayable
```

First verifies {_resourceIDToContractAddress}[{resourceID}] and {_contractAddressToResourceID}[{contractAddress}] are not already set, then sets {_resourceIDToContractAddress} with {contractAddress}, {_contractAddressToResourceID} with {resourceID}, and {_contractWhitelist} to true for {contractAddress}.



#### Parameters

| Name | Type | Description |
|---|---|---|
| resourceID | bytes32 | ResourceID to be used when executing proposals.
| contractAddress | address | Address of contract to be called when a proposal is signed and submitted for execution.




