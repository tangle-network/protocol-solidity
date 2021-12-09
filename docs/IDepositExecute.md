# IDepositExecute

*ChainSafe Systems.*

> Interface for handler contracts that support deposits and deposit executions.





## Methods

### deposit

```solidity
function deposit(bytes32 resourceID, uint32 destinationChainID, uint64 depositNonce, address depositer, bytes data) external nonpayable
```

It is intended that deposit are made using the Bridge contract.



#### Parameters

| Name | Type | Description |
|---|---|---|
| resourceID | bytes32 | undefined
| destinationChainID | uint32 | Chain ID deposit is expected to be bridged to.
| depositNonce | uint64 | This value is generated as an ID by the Bridge contract.
| depositer | address | Address of account making the deposit in the Bridge contract.
| data | bytes | Consists of additional data needed for a specific deposit.




