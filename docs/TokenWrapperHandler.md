# TokenWrapperHandler

*Webb Technologies.*

> Handles GovernedTokenWrapper fee and token updates

This contract is intended to be used with the Bridge and SignatureBridge contracts.



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

Proposal execution should be initiated when a proposal is finalized in the Bridge contract. by a relayer on the deposit&#39;s destination chain. Or when a valid signature is produced by the DKG in the case of SignatureBridge.



#### Parameters

| Name | Type | Description |
|---|---|---|
| resourceID | bytes32 | ResourceID corresponding to a particular set of GovernedTokenWrapper contracts
| data | bytes | Consists of a specific proposal data structure for each finer-grained token wrapper proposal

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




