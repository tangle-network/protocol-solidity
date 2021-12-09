# LinkableAnchor









## Methods

### NOTHING_UP_MY_SLEEVE_ZERO

```solidity
function NOTHING_UP_MY_SLEEVE_ZERO() external view returns (uint256)
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

### addEdge

```solidity
function addEdge(uint256 sourceChainID, bytes32 root, uint256 leafIndex) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sourceChainID | uint256 | undefined
| root | bytes32 | undefined
| leafIndex | uint256 | undefined

### addExternalNullifier

```solidity
function addExternalNullifier(uint232 _externalNullifier) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _externalNullifier | uint232 | undefined

### admin

```solidity
function admin() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### bridge

```solidity
function bridge() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### broadcastSignal

```solidity
function broadcastSignal(bytes _signal, uint256[8] _proof, bytes _roots, uint256 _nullifiersHash, uint232 _externalNullifier) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _signal | bytes | undefined
| _proof | uint256[8] | undefined
| _roots | bytes | undefined
| _nullifiersHash | uint256 | undefined
| _externalNullifier | uint232 | undefined

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

### deactivateExternalNullifier

```solidity
function deactivateExternalNullifier(uint232 _externalNullifier) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _externalNullifier | uint232 | undefined

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
function edgeList(uint256) external view returns (uint256 chainID, bytes32 root, uint256 latestLeafIndex)
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

### externalNullifierLinkedList

```solidity
function externalNullifierLinkedList(uint232) external view returns (uint232 next, bool exists, bool isActive)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint232 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| next | uint232 | undefined
| exists | bool | undefined
| isActive | bool | undefined

### firstExternalNullifier

```solidity
function firstExternalNullifier() external view returns (uint232)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint232 | undefined

### getChainId

```solidity
function getChainId() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getLatestNeighborRoots

```solidity
function getLatestNeighborRoots() external view returns (bytes32[] roots)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| roots | bytes32[] | undefined

### getNextExternalNullifier

```solidity
function getNextExternalNullifier(uint232 _externalNullifier) external view returns (uint232)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _externalNullifier | uint232 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint232 | undefined

### getNumIdentityCommitments

```solidity
function getNumIdentityCommitments() external view returns (uint256)
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





#### Parameters

| Name | Type | Description |
|---|---|---|
| _chainID | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### hash11

```solidity
function hash11(uint256[] array) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| array | uint256[] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### hash5

```solidity
function hash5(uint256[5] array) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| array | uint256[5] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### hashLeftRight

```solidity
function hashLeftRight(uint256 _left, uint256 _right) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _left | uint256 | undefined
| _right | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### insertIdentity

```solidity
function insertIdentity(uint256 _identityCommitment) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _identityCommitment | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### insertLeaf

```solidity
function insertLeaf(uint256 _leaf) external nonpayable returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _leaf | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### isBroadcastPermissioned

```solidity
function isBroadcastPermissioned() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isExternalNullifierActive

```solidity
function isExternalNullifierActive(uint232 _externalNullifier) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _externalNullifier | uint232 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isKnownNeighborRoot

```solidity
function isKnownNeighborRoot(uint256 neighborChainID, bytes32 _root) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| neighborChainID | uint256 | undefined
| _root | bytes32 | undefined

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

### isOwner

```solidity
function isOwner() external view returns (bool)
```



*Returns true if the caller is the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isValidRoots

```solidity
function isValidRoots(bytes32[] roots) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| roots | bytes32[] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### lastExternalNullifier

```solidity
function lastExternalNullifier() external view returns (uint232)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint232 | undefined

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

### nullifierHashHistory

```solidity
function nullifierHashHistory(uint256) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### numExternalNullifiers

```solidity
function numExternalNullifiers() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### packProof

```solidity
function packProof(uint256[2] _a, uint256[2][2] _b, uint256[2] _c) external pure returns (uint256[8])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _a | uint256[2] | undefined
| _b | uint256[2][2] | undefined
| _c | uint256[2] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[8] | undefined

### preBroadcastCheck

```solidity
function preBroadcastCheck(bytes _signal, uint256[8] _proof, bytes _roots, uint256 _nullifiersHash, uint256 _signalHash, uint232 _externalNullifier) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _signal | bytes | undefined
| _proof | uint256[8] | undefined
| _roots | bytes | undefined
| _nullifiersHash | uint256 | undefined
| _signalHash | uint256 | undefined
| _externalNullifier | uint232 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### reactivateExternalNullifier

```solidity
function reactivateExternalNullifier(uint232 _externalNullifier) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _externalNullifier | uint232 | undefined

### renounceOwnership

```solidity
function renounceOwnership() external nonpayable
```



*Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. &gt; Note: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.*


### root

```solidity
function root() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### rootHistory

```solidity
function rootHistory(uint256) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### roots

```solidity
function roots(uint256) external view returns (bytes32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### setBridge

```solidity
function setBridge(address _bridge) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bridge | address | undefined

### setHandler

```solidity
function setHandler(address _handler) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _handler | address | undefined

### setPermissioning

```solidity
function setPermissioning(bool _newPermission) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _newPermission | bool | undefined

### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined

### unpackProof

```solidity
function unpackProof(uint256[8] _proof) external pure returns (uint256[2], uint256[2][2], uint256[2])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _proof | uint256[8] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | undefined
| _1 | uint256[2][2] | undefined
| _2 | uint256[2] | undefined

### updateEdge

```solidity
function updateEdge(uint256 sourceChainID, bytes32 root, uint256 leafIndex) external payable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| sourceChainID | uint256 | undefined
| root | bytes32 | undefined
| leafIndex | uint256 | undefined

### verifier

```solidity
function verifier() external view returns (contract ISemaphoreVerifier)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ISemaphoreVerifier | undefined

### zeroes

```solidity
function zeroes(uint256 i) external view returns (bytes32)
```



*provides Zero (Empty) elements for a Poseidon MerkleTree. Up to 32 levels*

#### Parameters

| Name | Type | Description |
|---|---|---|
| i | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined



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

### ExternalNullifierAdd

```solidity
event ExternalNullifierAdd(uint232 indexed externalNullifier)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| externalNullifier `indexed` | uint232 | undefined |

### ExternalNullifierChangeStatus

```solidity
event ExternalNullifierChangeStatus(uint232 indexed externalNullifier, bool indexed active)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| externalNullifier `indexed` | uint232 | undefined |
| active `indexed` | bool | undefined |

### LeafInsertion

```solidity
event LeafInsertion(uint256 indexed leaf, uint256 indexed leafIndex)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| leaf `indexed` | uint256 | undefined |
| leafIndex `indexed` | uint256 | undefined |

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |

### PermissionSet

```solidity
event PermissionSet(bool indexed newPermission)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| newPermission `indexed` | bool | undefined |



