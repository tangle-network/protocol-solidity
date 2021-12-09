# Bridge

*ChainSafe Systems &amp; Webb Technologies.*

> Facilitates deposits, creation and voting of deposit proposals, and deposit executions.





## Methods

### DEFAULT_ADMIN_ROLE

```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### MAX_RELAYERS

```solidity
function MAX_RELAYERS() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### RELAYER_ROLE

```solidity
function RELAYER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### _chainID

```solidity
function _chainID() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### _counts

```solidity
function _counts(uint256) external view returns (uint64)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint64 | undefined

### _expiry

```solidity
function _expiry() external view returns (uint40)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint40 | undefined

### _fee

```solidity
function _fee() external view returns (uint128)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### _hasVotedOnProposal

```solidity
function _hasVotedOnProposal(uint72 destNonce, bytes32 dataHash, address relayer) external view returns (bool)
```

Returns true if {relayer} has voted on {destNonce} {dataHash} proposal.Naming left unchanged for backward compatibility.



#### Parameters

| Name | Type | Description |
|---|---|---|
| destNonce | uint72 | destinationChainID + nonce of the proposal.
| dataHash | bytes32 | Hash of data to be provided when update proposal is executed.
| relayer | address | Address to check.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### _relayerThreshold

```solidity
function _relayerThreshold() external view returns (uint8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### _resourceIDToHandlerAddress

```solidity
function _resourceIDToHandlerAddress(bytes32) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### _totalRelayers

```solidity
function _totalRelayers() external view returns (uint256)
```

Returns total relayers number.Added for backwards compatibility.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### adminAddRelayer

```solidity
function adminAddRelayer(address relayerAddress) external nonpayable
```

Grants {relayerAddress} the relayer role.Only callable by an address that currently has the admin role, which is checked in grantRole().Emits {RelayerAdded} event.



#### Parameters

| Name | Type | Description |
|---|---|---|
| relayerAddress | address | Address of relayer to be added.

### adminChangeFee

```solidity
function adminChangeFee(uint256 newFee) external nonpayable
```

Changes deposit fee.Only callable by admin.



#### Parameters

| Name | Type | Description |
|---|---|---|
| newFee | uint256 | Value {_fee} will be updated to.

### adminChangeRelayerThreshold

```solidity
function adminChangeRelayerThreshold(uint256 newThreshold) external nonpayable
```

Modifies the number of votes required for a proposal to be considered passed.Only callable by an address that currently has the admin role.Emits {RelayerThresholdChanged} event.



#### Parameters

| Name | Type | Description |
|---|---|---|
| newThreshold | uint256 | Value {_relayerThreshold} will be changed to.

### adminPauseTransfers

```solidity
function adminPauseTransfers() external nonpayable
```

Pauses deposits, proposal creation and voting, and deposit executions.Only callable by an address that currently has the admin role.




### adminRemoveRelayer

```solidity
function adminRemoveRelayer(address relayerAddress) external nonpayable
```

Removes relayer role for {relayerAddress}.Only callable by an address that currently has the admin role, which is checked in revokeRole().Emits {RelayerRemoved} event.



#### Parameters

| Name | Type | Description |
|---|---|---|
| relayerAddress | address | Address of relayer to be removed.

### adminSetBurnable

```solidity
function adminSetBurnable(address handlerAddress, address tokenAddress) external nonpayable
```

Sets a resource as burnable for handler contracts that use the IERCHandler interface.Only callable by an address that currently has the admin role.



#### Parameters

| Name | Type | Description |
|---|---|---|
| handlerAddress | address | Address of handler resource will be set for.
| tokenAddress | address | Address of contract to be called when a deposit is made and a deposited is executed.

### adminSetResource

```solidity
function adminSetResource(address handlerAddress, bytes32 resourceID, address executionContextAddress) external nonpayable
```

Sets a new resource for handler contracts that use the IExecutor interface, and maps the {handlerAddress} to {resourceID} in {_resourceIDToHandlerAddress}.Only callable by an address that currently has the admin role.



#### Parameters

| Name | Type | Description |
|---|---|---|
| handlerAddress | address | Address of handler resource will be set for.
| resourceID | bytes32 | ResourceID to be used when making deposits.
| executionContextAddress | address | Address of contract to be called when a proposal is ready to execute on it

### adminUnpauseTransfers

```solidity
function adminUnpauseTransfers() external nonpayable
```

Unpauses deposits, proposal creation and voting, and deposit executions.Only callable by an address that currently has the admin role.




### adminWithdraw

```solidity
function adminWithdraw(address handlerAddress, address tokenAddress, address recipient, uint256 amountOrTokenID) external nonpayable
```

Used to manually withdraw funds from ERC safes.



#### Parameters

| Name | Type | Description |
|---|---|---|
| handlerAddress | address | Address of handler to withdraw from.
| tokenAddress | address | Address of token to withdraw.
| recipient | address | Address to withdraw tokens to.
| amountOrTokenID | uint256 | Either the amount of ERC20 tokens or the ERC721 token ID to withdraw.

### cancelProposal

```solidity
function cancelProposal(uint256 chainID, uint64 nonce, bytes32 dataHash) external nonpayable
```

Cancels a deposit proposal that has not been executed yet.Only callable by relayers when Bridge is not paused.Proposal must be past expiry threshold.Emits {ProposalEvent} event with status {Cancelled}.



#### Parameters

| Name | Type | Description |
|---|---|---|
| chainID | uint256 | ID of chain deposit originated from.
| nonce | uint64 | ID of deposited generated by origin Bridge contract.
| dataHash | bytes32 | Hash of data originally provided when deposit was made.

### deposit

```solidity
function deposit(uint32 destinationChainID, bytes32 resourceID, bytes data) external payable
```

Initiates a transfer using a specified handler contract.Only callable when Bridge is not paused.Emits {Deposit} event.



#### Parameters

| Name | Type | Description |
|---|---|---|
| destinationChainID | uint32 | ID of chain deposit will be bridged to.
| resourceID | bytes32 | ResourceID used to find address of handler to be used for deposit.
| data | bytes | Additional data to be passed to specified handler.

### executeProposal

```solidity
function executeProposal(uint256 chainID, uint64 nonce, bytes data, bytes32 resourceID) external nonpayable
```

Executes a deposit proposal that is considered passed using a specified handler contract.Only callable by relayers when Bridge is not paused.Proposal must have Passed status.Hash of {data} must equal proposal&#39;s {dataHash}.Emits {ProposalEvent} event with status {Executed}.



#### Parameters

| Name | Type | Description |
|---|---|---|
| chainID | uint256 | ID of chain deposit originated from.
| nonce | uint64 | ID of action generated by origin Bridge contract.
| data | bytes | Data originally provided when deposit was made.
| resourceID | bytes32 | ResourceID to be used when making deposits.

### getProposal

```solidity
function getProposal(uint256 originChainID, uint64 nonce, bytes32 dataHash) external view returns (struct Bridge.Proposal)
```

Returns a proposal.



#### Parameters

| Name | Type | Description |
|---|---|---|
| originChainID | uint256 | Chain ID deposit originated from.
| nonce | uint64 | ID of proposal generated by proposal&#39;s origin Bridge contract.
| dataHash | bytes32 | Hash of data to be provided when deposit proposal is executed.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | Bridge.Proposal | Proposal which consists of: - _dataHash Hash of data to be provided when deposit proposal is executed. - _yesVotes Number of votes in favor of proposal. - _noVotes Number of votes against proposal. - _status Current status of proposal.

### getRoleAdmin

```solidity
function getRoleAdmin(bytes32 role) external view returns (bytes32)
```



*Returns the admin role that controls `role`. See {grantRole} and {revokeRole}. To change a role&#39;s admin, use {_setRoleAdmin}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### getRoleMember

```solidity
function getRoleMember(bytes32 role, uint256 index) external view returns (address)
```



*Returns one of the accounts that have `role`. `index` must be a value between 0 and {getRoleMemberCount}, non-inclusive. Role bearers are not sorted in any particular way, and their ordering may change at any point. WARNING: When using {getRoleMember} and {getRoleMemberCount}, make sure you perform all queries on the same block. See the following https://forum.openzeppelin.com/t/iterating-over-elements-on-enumerableset-in-openzeppelin-contracts/2296[forum post] for more information.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| index | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### getRoleMemberCount

```solidity
function getRoleMemberCount(bytes32 role) external view returns (uint256)
```



*Returns the number of accounts that have `role`. Can be used together with {getRoleMember} to enumerate all bearers of a role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getRoleMemberIndex

```solidity
function getRoleMemberIndex(bytes32 role, address account) external view returns (uint256)
```



*Returns the index of the account that have `role`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### grantRole

```solidity
function grantRole(bytes32 role, address account) external nonpayable
```



*Grants `role` to `account`. If `account` had not been already granted `role`, emits a {RoleGranted} event. Requirements: - the caller must have ``role``&#39;s admin role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

### hasRole

```solidity
function hasRole(bytes32 role, address account) external view returns (bool)
```



*Returns `true` if `account` has been granted `role`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isRelayer

```solidity
function isRelayer(address relayer) external view returns (bool)
```

Returns true if {relayer} has the relayer role.



#### Parameters

| Name | Type | Description |
|---|---|---|
| relayer | address | Address to check.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### paused

```solidity
function paused() external view returns (bool)
```



*Returns true if the contract is paused, and false otherwise.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### renounceAdmin

```solidity
function renounceAdmin(address newAdmin) external nonpayable
```

Removes admin role from {msg.sender} and grants it to {newAdmin}.Only callable by an address that currently has the admin role.



#### Parameters

| Name | Type | Description |
|---|---|---|
| newAdmin | address | Address that admin role will be granted to.

### renounceRole

```solidity
function renounceRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from the calling account. Roles are often managed via {grantRole} and {revokeRole}: this function&#39;s purpose is to provide a mechanism for accounts to lose their privileges if they are compromised (such as when a trusted device is misplaced). If the calling account had been granted `role`, emits a {RoleRevoked} event. Requirements: - the caller must be `account`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

### revokeRole

```solidity
function revokeRole(bytes32 role, address account) external nonpayable
```



*Revokes `role` from `account`. If `account` had been granted `role`, emits a {RoleRevoked} event. Requirements: - the caller must have ``role``&#39;s admin role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

### transferFunds

```solidity
function transferFunds(address payable[] addrs, uint256[] amounts) external nonpayable
```

Transfers eth in the contract to the specified addresses. The parameters addrs and amounts are mapped 1-1. This means that the address at index 0 for addrs will receive the amount (in WEI) from amounts at index 0.



#### Parameters

| Name | Type | Description |
|---|---|---|
| addrs | address payable[] | Array of addresses to transfer {amounts} to.
| amounts | uint256[] | Array of amonuts to transfer to {addrs}.

### voteProposal

```solidity
function voteProposal(uint256 chainID, uint64 nonce, bytes32 resourceID, bytes32 dataHash) external nonpayable
```

&quot;Creates&quot; the proposal upon first vote.When called, {msg.sender} will be marked as voting in favor of proposal.Only callable by relayers when Bridge is not paused.Proposal must not have already been passed or executed.{msg.sender} must not have already voted on proposal.Emits {ProposalEvent} event with status indicating the proposal status.Emits {ProposalVote} event.



#### Parameters

| Name | Type | Description |
|---|---|---|
| chainID | uint256 | ID of chain deposit originated from. // TO BE REMOVED SINCE WE WANT PRIVACY
| nonce | uint64 | ID of deposited generated by origin Bridge contract.
| resourceID | bytes32 | undefined
| dataHash | bytes32 | Hash of data provided when deposit was made.



## Events

### Deposit

```solidity
event Deposit(uint256 destinationChainID, bytes32 resourceID, uint64 nonce)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| destinationChainID  | uint256 | undefined |
| resourceID  | bytes32 | undefined |
| nonce  | uint64 | undefined |

### Paused

```solidity
event Paused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |

### ProposalEvent

```solidity
event ProposalEvent(uint256 originChainID, uint64 nonce, enum Bridge.ProposalStatus status, bytes32 dataHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| originChainID  | uint256 | undefined |
| nonce  | uint64 | undefined |
| status  | enum Bridge.ProposalStatus | undefined |
| dataHash  | bytes32 | undefined |

### ProposalVote

```solidity
event ProposalVote(uint256 originChainID, uint64 nonce, enum Bridge.ProposalStatus status, bytes32 dataHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| originChainID  | uint256 | undefined |
| nonce  | uint64 | undefined |
| status  | enum Bridge.ProposalStatus | undefined |
| dataHash  | bytes32 | undefined |

### RelayerAdded

```solidity
event RelayerAdded(address relayer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| relayer  | address | undefined |

### RelayerRemoved

```solidity
event RelayerRemoved(address relayer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| relayer  | address | undefined |

### RelayerThresholdChanged

```solidity
event RelayerThresholdChanged(uint256 newThreshold)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newThreshold  | uint256 | undefined |

### RoleGranted

```solidity
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### RoleRevoked

```solidity
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### Unpaused

```solidity
event Unpaused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |



