# IExecutor

*ChainSafe Systems.*

> Interface for handler contracts that support deposits and deposit executions.





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




