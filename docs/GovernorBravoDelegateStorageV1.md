# GovernorBravoDelegateStorageV1



> Storage for Governor Bravo Delegate

For future upgrades, do not change GovernorBravoDelegateStorageV1. Create a new contract which implements GovernorBravoDelegateStorageV1 and following the naming convention GovernorBravoDelegateStorageVX.



## Methods

### admin

```solidity
function admin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### comp

```solidity
function comp() external view returns (contract CompInterface)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract CompInterface | undefined

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




