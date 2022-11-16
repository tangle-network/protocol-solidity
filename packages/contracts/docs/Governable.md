# Governable

*Webb Technologies*

> The Governable contract that defines the governance mechanism





## Methods

### averageSessionLengthInMillisecs

```solidity
function averageSessionLengthInMillisecs() external view returns (uint64)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint64 | undefined

### currentVotingPeriod

```solidity
function currentVotingPeriod() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### governor

```solidity
function governor() external view returns (address)
```

Returns the address of the current owner.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### isGovernor

```solidity
function isGovernor() external view returns (bool)
```

Returns true if the caller is the current owner.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | bool Whether the `msg.sender` is the governor

### isSignatureFromGovernor

```solidity
function isSignatureFromGovernor(bytes data, bytes sig) external view returns (bool)
```

Returns true if the signature is signed by the current governor.



#### Parameters

| Name | Type | Description |
|---|---|---|
| data | bytes | undefined
| sig | bytes | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | bool Whether the signature of the data is signed by the governor

### lastGovernorUpdateTime

```solidity
function lastGovernorUpdateTime() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### numOfProposers

```solidity
function numOfProposers() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### proposerSetRoot

```solidity
function proposerSetRoot() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### proposerSetUpdateNonce

```solidity
function proposerSetUpdateNonce() external view returns (uint32)
```

Storage values relevant to proposer set update




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### recover

```solidity
function recover(bytes data, bytes sig) external pure returns (address)
```

Helper function for recovering the address from the signature `sig` of `data`



#### Parameters

| Name | Type | Description |
|---|---|---|
| data | bytes | The data being signed
| sig | bytes | The signature of the data

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | address The address of the signer

### refreshNonce

```solidity
function refreshNonce() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```

Leaves the contract without owner. It will not be possible to call `onlyGovernor` functions anymore. Can only be called by the current owner.Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.




### sessionLengthMultiplier

```solidity
function sessionLengthMultiplier() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### transferOwnership

```solidity
function transferOwnership(address newOwner, uint32 nonce) external nonpayable
```

Transfers ownership of the contract to a new account (`newOwner`).Can only be called by the current owner.



#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | The new owner of the contract.
| nonce | uint32 | The nonce of the proposal.

### transferOwnershipWithSignaturePubKey

```solidity
function transferOwnershipWithSignaturePubKey(bytes publicKey, uint32 nonce, bytes sig) external nonpayable
```

Transfers ownership of the contract to a new account associated with the publicKey



#### Parameters

| Name | Type | Description |
|---|---|---|
| publicKey | bytes | The public key of the new owner
| nonce | uint32 | The nonce of the proposal
| sig | bytes | The signature of the transfer ownership/refresh proposal

### updateProposerSetData

```solidity
function updateProposerSetData(bytes32 _proposerSetRoot, uint64 _averageSessionLengthInMillisecs, uint32 _numOfProposers, uint32 _proposerSetUpdateNonce, bytes _sig) external nonpayable
```

Updates the proposer set data if a valid signature from the DKG is provided. The *      data consists proposerSetRoot, the average session length in milliseconds, the *      number of proposers, and the proposal nonce.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _proposerSetRoot | bytes32 | the root hash of the proposer set Merkle tree
| _averageSessionLengthInMillisecs | uint64 | the average DKG session length in milliseconds
| _numOfProposers | uint32 | the total number of proposers
| _proposerSetUpdateNonce | uint32 | the proposal nonce (to prevent replay attacks)
| _sig | bytes | the DKGs signature of the aforementioned parameters

### voteInFavorForceSetGovernor

```solidity
function voteInFavorForceSetGovernor(Governable.Vote vote) external nonpayable
```

Casts a vote in favor of force refreshing the governor



#### Parameters

| Name | Type | Description |
|---|---|---|
| vote | Governable.Vote | A vote struct



## Events

### GovernanceOwnershipTransferred

```solidity
event GovernanceOwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### RecoveredAddress

```solidity
event RecoveredAddress(address indexed recovered)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recovered `indexed` | address | undefined |



