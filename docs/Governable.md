# Governable









## Methods

### governor

```solidity
function governor() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### isGovernor

```solidity
function isGovernor() external view returns (bool)
```



*Returns true if the caller is the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyGovernor` functions anymore. Can only be called by the current owner. &gt; Note: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined

### transferOwnershipWithSignature

```solidity
function transferOwnershipWithSignature(address newOwner, bytes sig, bytes data) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined
| sig | bytes | undefined
| data | bytes | undefined



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



