# AnchorProxy









## Methods

### anchorTrees

```solidity
function anchorTrees() external view returns (contract IAnchorTrees)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAnchorTrees | undefined

### backupNotes

```solidity
function backupNotes(bytes[] _encryptedNotes) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _encryptedNotes | bytes[] | undefined

### deposit

```solidity
function deposit(contract IAnchor _anchor, bytes32 _commitment, bytes _encryptedNote) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _anchor | contract IAnchor | undefined
| _commitment | bytes32 | undefined
| _encryptedNote | bytes | undefined

### governance

```solidity
function governance() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### instances

```solidity
function instances(contract IAnchor) external view returns (contract IERC20 token, enum AnchorProxy.InstanceState state)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IAnchor | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined
| state | enum AnchorProxy.InstanceState | undefined

### withdraw

```solidity
function withdraw(contract IAnchor _anchor, bytes _proof, IAnchor.PublicInputs _publicInputs) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _anchor | contract IAnchor | undefined
| _proof | bytes | undefined
| _publicInputs | IAnchor.PublicInputs | undefined



## Events

### AnchorProxyDeposit

```solidity
event AnchorProxyDeposit(contract IAnchor indexed anchor, bytes32 indexed commitment, uint256 timestamp)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| anchor `indexed` | contract IAnchor | undefined |
| commitment `indexed` | bytes32 | undefined |
| timestamp  | uint256 | undefined |

### EncryptedNote

```solidity
event EncryptedNote(address indexed sender, bytes encryptedNote)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sender `indexed` | address | undefined |
| encryptedNote  | bytes | undefined |

### InstanceStateUpdated

```solidity
event InstanceStateUpdated(contract IAnchor indexed instance, enum AnchorProxy.InstanceState state)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| instance `indexed` | contract IAnchor | undefined |
| state  | enum AnchorProxy.InstanceState | undefined |



