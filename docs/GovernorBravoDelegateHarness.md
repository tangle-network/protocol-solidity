# GovernorBravoDelegateHarness









## Methods

### BALLOT_TYPEHASH

```solidity
function BALLOT_TYPEHASH() external view returns (bytes32)
```

The EIP-712 typehash for the ballot struct used by the contract




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### DOMAIN_TYPEHASH

```solidity
function DOMAIN_TYPEHASH() external view returns (bytes32)
```

The EIP-712 typehash for the contract&#39;s domain




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### MAX_PROPOSAL_THRESHOLD

```solidity
function MAX_PROPOSAL_THRESHOLD() external view returns (uint256)
```

The maximum setable proposal threshold




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MAX_VOTING_DELAY

```solidity
function MAX_VOTING_DELAY() external view returns (uint256)
```

The max setable voting delay




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MAX_VOTING_PERIOD

```solidity
function MAX_VOTING_PERIOD() external view returns (uint256)
```

The max setable voting period




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MIN_PROPOSAL_THRESHOLD

```solidity
function MIN_PROPOSAL_THRESHOLD() external view returns (uint256)
```

The minimum setable proposal threshold




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MIN_VOTING_DELAY

```solidity
function MIN_VOTING_DELAY() external view returns (uint256)
```

The min setable voting delay




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MIN_VOTING_PERIOD

```solidity
function MIN_VOTING_PERIOD() external view returns (uint256)
```

The minimum setable voting period




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### _acceptAdmin

```solidity
function _acceptAdmin() external nonpayable
```

Accepts transfer of admin rights. msg.sender must be pendingAdmin

*Admin function for pending admin to accept role and update admin*


### _initiate

```solidity
function _initiate(address governorAlpha) external nonpayable
```

Initiate the GovernorBravo contract

*Admin only. Sets initial proposal id which initiates the contract, ensuring a continuous proposal id count*

#### Parameters

| Name | Type | Description |
|---|---|---|
| governorAlpha | address | The address for the Governor to continue the proposal id count from

### _setPendingAdmin

```solidity
function _setPendingAdmin(address newPendingAdmin) external nonpayable
```

Begins transfer of admin rights. The newPendingAdmin must call `_acceptAdmin` to finalize the transfer.

*Admin function to begin change of admin. The newPendingAdmin must call `_acceptAdmin` to finalize the transfer.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newPendingAdmin | address | New pending admin.

### _setProposalThreshold

```solidity
function _setProposalThreshold(uint256 newProposalThreshold) external nonpayable
```

Admin function for setting the proposal threshold

*newProposalThreshold must be greater than the hardcoded min*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newProposalThreshold | uint256 | new proposal threshold

### _setVotingDelay

```solidity
function _setVotingDelay(uint256 newVotingDelay) external nonpayable
```

Admin function for setting the voting delay



#### Parameters

| Name | Type | Description |
|---|---|---|
| newVotingDelay | uint256 | new voting delay, in blocks

### _setVotingPeriod

```solidity
function _setVotingPeriod(uint256 newVotingPeriod) external nonpayable
```

Admin function for setting the voting period



#### Parameters

| Name | Type | Description |
|---|---|---|
| newVotingPeriod | uint256 | new voting period, in blocks

### admin

```solidity
function admin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### cancel

```solidity
function cancel(uint256 proposalId) external nonpayable
```

Cancels a proposal only if sender is the proposer, or proposer delegates dropped below proposal threshold



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | The id of the proposal to cancel

### castVote

```solidity
function castVote(uint256 proposalId, uint8 support) external nonpayable
```

Cast a vote for a proposal



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | The id of the proposal to vote on
| support | uint8 | The support value for the vote. 0=against, 1=for, 2=abstain

### castVoteBySig

```solidity
function castVoteBySig(uint256 proposalId, uint8 support, uint8 v, bytes32 r, bytes32 s) external nonpayable
```

Cast a vote for a proposal by signature

*External function that accepts EIP-712 signatures for voting on proposals.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | undefined
| support | uint8 | undefined
| v | uint8 | undefined
| r | bytes32 | undefined
| s | bytes32 | undefined

### castVoteWithReason

```solidity
function castVoteWithReason(uint256 proposalId, uint8 support, string reason) external nonpayable
```

Cast a vote for a proposal with a reason



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | The id of the proposal to vote on
| support | uint8 | The support value for the vote. 0=against, 1=for, 2=abstain
| reason | string | The reason given for the vote by the voter

### comp

```solidity
function comp() external view returns (contract CompInterface)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract CompInterface | undefined

### execute

```solidity
function execute(uint256 proposalId) external payable
```

Executes a queued proposal if eta has passed



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | The id of the proposal to execute

### getActions

```solidity
function getActions(uint256 proposalId) external view returns (address[] targets, uint256[] values, string[] signatures, bytes[] calldatas)
```

Gets actions of a proposal



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | the id of the proposal returns Targets, values, signatures, and calldatas of the proposal actions

#### Returns

| Name | Type | Description |
|---|---|---|
| targets | address[] | undefined
| values | uint256[] | undefined
| signatures | string[] | undefined
| calldatas | bytes[] | undefined

### getReceipt

```solidity
function getReceipt(uint256 proposalId, address voter) external view returns (struct GovernorBravoDelegateStorageV1.Receipt)
```

Gets the receipt for a voter on a given proposal



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | the id of proposal
| voter | address | The address of the voter returns The voting receipt

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | GovernorBravoDelegateStorageV1.Receipt | undefined

### implementation

```solidity
function implementation() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### initialProposalId

```solidity
function initialProposalId() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### initialize

```solidity
function initialize(address timelock_, address comp_, uint256 votingPeriod_, uint256 votingDelay_, uint256 proposalThreshold_) external nonpayable
```

Used to initialize the contract during delegator contructor



#### Parameters

| Name | Type | Description |
|---|---|---|
| timelock_ | address | The address of the Timelock
| comp_ | address | The address of the COMP token
| votingPeriod_ | uint256 | The initial voting period
| votingDelay_ | uint256 | The initial voting delay
| proposalThreshold_ | uint256 | The initial proposal threshold

### latestProposalIds

```solidity
function latestProposalIds(address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### name

```solidity
function name() external view returns (string)
```

The name of this contract




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined

### pendingAdmin

```solidity
function pendingAdmin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### proposalCount

```solidity
function proposalCount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### proposalMaxOperations

```solidity
function proposalMaxOperations() external view returns (uint256)
```

The maximum number of actions that can be included in a proposal




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### proposalThreshold

```solidity
function proposalThreshold() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### proposals

```solidity
function proposals(uint256) external view returns (uint256 id, address proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool canceled, bool executed)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| id | uint256 | undefined
| proposer | address | undefined
| eta | uint256 | undefined
| startBlock | uint256 | undefined
| endBlock | uint256 | undefined
| forVotes | uint256 | undefined
| againstVotes | uint256 | undefined
| abstainVotes | uint256 | undefined
| canceled | bool | undefined
| executed | bool | undefined

### propose

```solidity
function propose(address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description) external nonpayable returns (uint256)
```

Function used to propose a new proposal. Sender must have delegates above the proposal threshold



#### Parameters

| Name | Type | Description |
|---|---|---|
| targets | address[] | Target addresses for proposal calls
| values | uint256[] | Eth values for proposal calls
| signatures | string[] | Function signatures for proposal calls
| calldatas | bytes[] | Calldatas for proposal calls
| description | string | String description of the proposal returns Proposal id of new proposal

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### queue

```solidity
function queue(uint256 proposalId) external nonpayable
```

Queues a proposal of state succeeded



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | The id of the proposal to queue

### quorumVotes

```solidity
function quorumVotes() external view returns (uint256)
```

The number of votes in support of a proposal required in order for a quorum to be reached and for a vote to succeed




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### state

```solidity
function state(uint256 proposalId) external view returns (enum GovernorBravoDelegateStorageV1.ProposalState)
```

Gets the state of a proposal



#### Parameters

| Name | Type | Description |
|---|---|---|
| proposalId | uint256 | The id of the proposal returns Proposal state

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | enum GovernorBravoDelegateStorageV1.ProposalState | undefined

### timelock

```solidity
function timelock() external view returns (contract TimelockInterface)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract TimelockInterface | undefined

### votingDelay

```solidity
function votingDelay() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### votingPeriod

```solidity
function votingPeriod() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined



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



