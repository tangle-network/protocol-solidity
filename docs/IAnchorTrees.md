# IAnchorTrees



> IAnchorTrees interface

Interface for AnchorTrees used in Anonymity mining



## Methods

### registerDeposit

```solidity
function registerDeposit(address instance, bytes32 commitment) external nonpayable
```

Registers a deposit in the AnchorTree



#### Parameters

| Name | Type | Description |
|---|---|---|
| instance | address | The address of the Anchor
| commitment | bytes32 | The commitment to be inserted into the tree

### registerWithdrawal

```solidity
function registerWithdrawal(address instance, bytes32 nullifier) external nonpayable
```

Registers a withdrawal in the AnchorTree



#### Parameters

| Name | Type | Description |
|---|---|---|
| instance | address | The address of the Anchor
| nullifier | bytes32 | The nullifier to be exposed during withdraw




