# LinkableAnchor

*Webb Technologies*

> The LinkableAnchor contract

The LinkableAnchor contract extends the MerkleTreePoseidon contract with a graph-like interface for linking to other LinkableAnchors. Links between these trees are represented as directed edges (since updates occur on one contract per transaction). The edge data is maintained as a record of the: - Chain id that the edge points to - Latest merkle root of the MerkleTreePoseidon contract being linked - Latest leaf insertion index (used as a nonce) of the linked merkle tree. Updating the state of the LinkableAnchor&#39;s edges is done through the handler architecture defined originally by ChainSafe&#39;s ChainBridge system. In our case, we employ a handler to propagate updates to a LinkableAnchor contract. For example, the handler can be connected to an oracle system, signature system, or any other bridge system to provide the state of the neighboring LinkableAnchor&#39;s edge data. The LinkableAnchor contract is meant to be inherited by child contracts that define their own architecture around: 1. The structure of elements being inserted into the underlying Merkle Tree 2. The type of zkSNARK necessary for proving membership of a specific element in one-of-many LinkableAnchors connected in a bridge. An example usage of this system is the: - VAnchor.sol - for variable sized private bridging of assets



## Methods

### EVM_CHAIN_ID_TYPE

```solidity
function EVM_CHAIN_ID_TYPE() external view returns (bytes2)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes2 | undefined

### FIELD_SIZE

```solidity
function FIELD_SIZE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### ROOT_HISTORY_SIZE

```solidity
function ROOT_HISTORY_SIZE() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### ZERO_VALUE

```solidity
function ZERO_VALUE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### configureMaximumDepositLimit

```solidity
function configureMaximumDepositLimit(uint256 maximumDepositAmount, uint32 nonce) external nonpayable
```

Sets the maximal deposit limit for the anchor



#### Parameters

| Name | Type | Description |
|---|---|---|
| maximumDepositAmount | uint256 | The new maximal deposit limit
| nonce | uint32 | undefined

### configureMinimalWithdrawalLimit

```solidity
function configureMinimalWithdrawalLimit(uint256 minimalWithdrawalAmount, uint32 nonce) external nonpayable
```

Sets the minimal withdrawal limit for the anchor



#### Parameters

| Name | Type | Description |
|---|---|---|
| minimalWithdrawalAmount | uint256 | The new minimal withdrawal limit
| nonce | uint32 | undefined

### currentNeighborRootIndex

```solidity
function currentNeighborRootIndex(uint256) external view returns (uint32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### currentRootIndex

```solidity
function currentRootIndex() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### edgeExistsForChain

```solidity
function edgeExistsForChain(uint256) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### edgeIndex

```solidity
function edgeIndex(uint256) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### edgeList

```solidity
function edgeList(uint256) external view returns (uint256 chainID, bytes32 root, uint256 latestLeafIndex, bytes32 srcResourceID)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| chainID | uint256 | undefined
| root | bytes32 | undefined
| latestLeafIndex | uint256 | undefined
| srcResourceID | bytes32 | undefined

### filledSubtrees

```solidity
function filledSubtrees(uint256) external view returns (bytes32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### getChainId

```solidity
function getChainId() external view returns (uint256)
```

Gets the chain id using the chain id opcode




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getChainIdType

```solidity
function getChainIdType() external view returns (uint48)
```

Computes the modified chain id using the underlying chain type (EVM)




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint48 | undefined

### getLastRoot

```solidity
function getLastRoot() external view returns (bytes32)
```



*Returns the last root*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### getLatestNeighborEdges

```solidity
function getLatestNeighborEdges() external view returns (struct Edge[])
```

Get the latest state of all neighbor edges




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | Edge[] | Edge[] An array of all neighboring and potentially empty edges

### getLatestNeighborRoots

```solidity
function getLatestNeighborRoots() external view returns (bytes32[])
```

Get the latest merkle roots of all neighbor edges




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32[] | bytes32[] An array of merkle roots

### getProposalNonce

```solidity
function getProposalNonce() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### handler

```solidity
function handler() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### hasEdge

```solidity
function hasEdge(uint256 _chainID) external view returns (bool)
```

Checks the `_chainID` has an edge on this contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _chainID | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### hashLeftRight

```solidity
function hashLeftRight(contract IHasher _hasher, bytes32 _left, bytes32 _right) external view returns (bytes32)
```



*Hash 2 tree leaves*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _hasher | contract IHasher | undefined
| _left | bytes32 | undefined
| _right | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### hasher

```solidity
function hasher() external view returns (contract IHasher)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IHasher | undefined

### isKnownNeighborRoot

```solidity
function isKnownNeighborRoot(uint256 _neighborChainID, bytes32 _root) external view returns (bool)
```

Checks to see whether a `_root` is known for a neighboring `neighborChainID`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _neighborChainID | uint256 | The chainID of the neighbor&#39;s edge
| _root | bytes32 | The root to check

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isKnownRoot

```solidity
function isKnownRoot(bytes32 _root) external view returns (bool)
```



*Whether the root is present in the root history*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _root | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isValidRoots

```solidity
function isValidRoots(bytes32[] _roots) external view returns (bool)
```

Checks validity of an array of merkle roots in the history. The first root should always be the root of `this` underlying merkle tree and the remaining roots are of the neighboring roots in `edges.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _roots | bytes32[] | An array of bytes32 merkle roots to be checked against the history.

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### levels

```solidity
function levels() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### maxEdges

```solidity
function maxEdges() external view returns (uint8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### neighborRoots

```solidity
function neighborRoots(uint256, uint32) external view returns (bytes32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined
| _1 | uint32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### nextIndex

```solidity
function nextIndex() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### parseChainIdFromResourceId

```solidity
function parseChainIdFromResourceId(bytes32 _resourceId) external pure returns (uint64)
```

Parses the typed chain ID out from a 32-byte resource ID



#### Parameters

| Name | Type | Description |
|---|---|---|
| _resourceId | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint64 | undefined

### proposalNonce

```solidity
function proposalNonce() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### roots

```solidity
function roots(uint256) external view returns (bytes32 root, uint256 latestLeafindex)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| root | bytes32 | undefined
| latestLeafindex | uint256 | undefined

### setHandler

```solidity
function setHandler(address handler, uint32 nonce) external nonpayable
```

Sets the handler for updating edges and other contract state



#### Parameters

| Name | Type | Description |
|---|---|---|
| handler | address | The new handler address
| nonce | uint32 | The nonce for tracking update counts

### updateEdge

```solidity
function updateEdge(bytes32 _root, uint32 _leafIndex, bytes32 _srcResourceID) external payable
```

Add an edge to the tree or update an existing edge.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _root | bytes32 | The merkle root of the edge&#39;s merkle tree
| _leafIndex | uint32 | The latest leaf insertion index of the edge&#39;s merkle tree
| _srcResourceID | bytes32 | The origin resource ID of the originating linked anchor update



## Events

### EdgeAddition

```solidity
event EdgeAddition(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| chainID  | uint256 | undefined |
| latestLeafIndex  | uint256 | undefined |
| merkleRoot  | bytes32 | undefined |

### EdgeUpdate

```solidity
event EdgeUpdate(uint256 chainID, uint256 latestLeafIndex, bytes32 merkleRoot)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| chainID  | uint256 | undefined |
| latestLeafIndex  | uint256 | undefined |
| merkleRoot  | bytes32 | undefined |

### Initialized

```solidity
event Initialized(uint8 version)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| version  | uint8 | undefined |



