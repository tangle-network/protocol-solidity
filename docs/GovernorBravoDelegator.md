# GovernorBravoDelegator









## Methods

### _setImplementation

```solidity
function _setImplementation(address implementation_) external nonpayable
```

Called by the admin to update the implementation of the delegator



#### Parameters

| Name | Type | Description |
|---|---|---|
| implementation_ | address | The address of the new implementation for delegation

### admin

```solidity
function admin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### implementation

```solidity
function implementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### pendingAdmin

```solidity
function pendingAdmin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined



## Events

### NewAdmin

```solidity
event NewAdmin(address oldAdmin, address newAdmin)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldAdmin  | address | undefined |
| newAdmin  | address | undefined |

### NewImplementation

```solidity
event NewImplementation(address oldImplementation, address newImplementation)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldImplementation  | address | undefined |
| newImplementation  | address | undefined |

### NewPendingAdmin

```solidity
event NewPendingAdmin(address oldPendingAdmin, address newPendingAdmin)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldPendingAdmin  | address | undefined |
| newPendingAdmin  | address | undefined |

### ProposalCanceled

```solidity
event ProposalCanceled(uint256 id)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id  | uint256 | undefined |

### ProposalCreated

```solidity
event ProposalCreated(uint256 id, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id  | uint256 | undefined |
| proposer  | address | undefined |
| targets  | address[] | undefined |
| values  | uint256[] | undefined |
| signatures  | string[] | undefined |
| calldatas  | bytes[] | undefined |
| startBlock  | uint256 | undefined |
| endBlock  | uint256 | undefined |
| description  | string | undefined |

### ProposalExecuted

```solidity
event ProposalExecuted(uint256 id)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id  | uint256 | undefined |

### ProposalQueued

```solidity
event ProposalQueued(uint256 id, uint256 eta)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| id  | uint256 | undefined |
| eta  | uint256 | undefined |

### ProposalThresholdSet

```solidity
event ProposalThresholdSet(uint256 oldProposalThreshold, uint256 newProposalThreshold)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldProposalThreshold  | uint256 | undefined |
| newProposalThreshold  | uint256 | undefined |

### VoteCast

```solidity
event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 votes, string reason)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| voter `indexed` | address | undefined |
| proposalId  | uint256 | undefined |
| support  | uint8 | undefined |
| votes  | uint256 | undefined |
| reason  | string | undefined |

### VotingDelaySet

```solidity
event VotingDelaySet(uint256 oldVotingDelay, uint256 newVotingDelay)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldVotingDelay  | uint256 | undefined |
| newVotingDelay  | uint256 | undefined |

### VotingPeriodSet

```solidity
event VotingPeriodSet(uint256 oldVotingPeriod, uint256 newVotingPeriod)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| oldVotingPeriod  | uint256 | undefined |
| newVotingPeriod  | uint256 | undefined |



