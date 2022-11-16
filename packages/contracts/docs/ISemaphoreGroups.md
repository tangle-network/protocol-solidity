# ISemaphoreGroups



> SemaphoreGroups interface.



*Interface of a SemaphoreGroups contract.*

## Methods

### getDepth

```solidity
function getDepth(uint256 groupId) external view returns (uint8)
```



*Returns the depth of the tree of a group.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId | uint256 | : Id of the group.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | Depth of the group tree.

### getLatestNeighborEdges

```solidity
function getLatestNeighborEdges(uint256 groupId) external view returns (struct Edge[])
```



*Returns the last root hash of a group.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId | uint256 | : Id of the group.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | Edge[] | Latests roots from each edge connected

### getMaxEdges

```solidity
function getMaxEdges(uint256 groupId) external view returns (uint8)
```



*Returns the max edges of the linkable tree of a group.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId | uint256 | : Id of the group.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | Maximum # of edges this group supports

### getNumberOfLeaves

```solidity
function getNumberOfLeaves(uint256 groupId) external view returns (uint256)
```



*Returns the number of tree leaves of a group.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId | uint256 | : Id of the group.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Number of tree leaves.

### getRoot

```solidity
function getRoot(uint256 groupId) external view returns (uint256)
```



*Returns the last root hash of a group.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId | uint256 | : Id of the group.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | Root hash of the group.

### verifyRoots

```solidity
function verifyRoots(uint256 groupId, bytes roots) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId | uint256 | undefined
| roots | bytes | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined



## Events

### GroupCreated

```solidity
event GroupCreated(uint256 indexed groupId, uint8 depth)
```



*Emitted when a new group is created.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId `indexed` | uint256 | : Id of the group. |
| depth  | uint8 | : Depth of the tree. |

### MemberAdded

```solidity
event MemberAdded(uint256 indexed groupId, uint256 identityCommitment, uint256 root)
```



*Emitted when a new identity commitment is added.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId `indexed` | uint256 | : Group id of the group. |
| identityCommitment  | uint256 | : New identity commitment. |
| root  | uint256 | : New root hash of the tree. |

### MemberRemoved

```solidity
event MemberRemoved(uint256 indexed groupId, uint256 identityCommitment, uint256 root)
```



*Emitted when a new identity commitment is removed.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| groupId `indexed` | uint256 | : Group id of the group. |
| identityCommitment  | uint256 | : New identity commitment. |
| root  | uint256 | : New root hash of the tree. |



## Errors

### Semaphore__GroupAlreadyExists

```solidity
error Semaphore__GroupAlreadyExists()
```






### Semaphore__GroupDoesNotExist

```solidity
error Semaphore__GroupDoesNotExist()
```






### Semaphore__GroupIdIsNotLessThanSnarkScalarField

```solidity
error Semaphore__GroupIdIsNotLessThanSnarkScalarField()
```






### Semaphore__InvalidCurrentChainRoot

```solidity
error Semaphore__InvalidCurrentChainRoot()
```






### Semaphore__InvalidEdgeChainRoot

```solidity
error Semaphore__InvalidEdgeChainRoot()
```







