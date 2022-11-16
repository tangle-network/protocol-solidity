# IExecutor

*Webb Technologies, adapted from ChainSafe Systems.*

> Interface for handler contracts that support proposal executions.





## Methods

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

Correlates {resourceID} with {contractAddress}.



#### Parameters

| Name | Type | Description |
|---|---|---|
| resourceID | bytes32 | ResourceID to be used when making deposits.
| contractAddress | address | Address of contract to be called when a deposit is made and a deposited is executed.




