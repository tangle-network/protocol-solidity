# LinkableVAnchor









## Methods

### FIELD_SIZE

```solidity
function FIELD_SIZE() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MAX_EXT_AMOUNT

```solidity
function MAX_EXT_AMOUNT() external view returns (int256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int256 | undefined

### MAX_FEE

```solidity
function MAX_FEE() external view returns (uint256)
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

### calculatePublicAmount

```solidity
function calculatePublicAmount(int256 _extAmount, uint256 _fee) external pure returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _extAmount | int256 | undefined
| _fee | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### configureLimits

```solidity
function configureLimits(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _minimalWithdrawalAmount | uint256 | undefined
| _maximumDepositAmount | uint256 | undefined

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
function getLatestNeighborEdges() external view returns (struct VAnchorBase.Edge[] edges)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| edges | VAnchorBase.Edge[] | undefined

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

### hashLeftRight

```solidity
function hashLeftRight(bytes32 _left, bytes32 _right) external view returns (bytes32)
```



*Hash 2 tree leaves, returns Poseidon(_left, _right)*

#### Parameters

| Name | Type | Description |
|---|---|---|
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

### initialize

```solidity
function initialize(uint256 _minimalWithdrawalAmount, uint256 _maximumDepositAmount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _minimalWithdrawalAmount | uint256 | undefined
| _maximumDepositAmount | uint256 | undefined

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

### isSpent

```solidity
function isSpent(bytes32 _nullifierHash) external view returns (bool)
```



*whether a note is already spent *

#### Parameters

| Name | Type | Description |
|---|---|---|
| _nullifierHash | bytes32 | undefined

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

### lastBalance

```solidity
function lastBalance() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

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

### maximumDepositAmount

```solidity
function maximumDepositAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### minimalWithdrawalAmount

```solidity
function minimalWithdrawalAmount() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

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

### nullifierHashes

```solidity
function nullifierHashes(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### permissions

```solidity
function permissions() external view returns (address bridge, address admin, address handler)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| bridge | address | undefined
| admin | address | undefined
| handler | address | undefined

### register

```solidity
function register(VAnchorBase.Account _account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _account | VAnchorBase.Account | undefined

### registerAndTransact

```solidity
function registerAndTransact(VAnchorBase.Account _account, VAnchorEncodeInputs.Proof _proofArgs, VAnchorBase.ExtData _extData) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _account | VAnchorBase.Account | undefined
| _proofArgs | VAnchorEncodeInputs.Proof | undefined
| _extData | VAnchorBase.ExtData | undefined

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

### transact

```solidity
function transact(VAnchorEncodeInputs.Proof _args, VAnchorBase.ExtData _extData) external nonpayable
```



*Main function that allows deposits, transfers and withdrawal.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _args | VAnchorEncodeInputs.Proof | undefined
| _extData | VAnchorBase.ExtData | undefined

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
function verifier() external view returns (contract IVAnchorVerifier)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVAnchorVerifier | undefined

### zeros

```solidity
function zeros(uint256 i) external pure returns (bytes32)
```



*provides Zero (Empty) elements for a MiMC MerkleTree. Up to 32 levels*

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

### NewCommitment

```solidity
event NewCommitment(bytes32 commitment, uint256 index, bytes encryptedOutput)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| commitment  | bytes32 | undefined |
| index  | uint256 | undefined |
| encryptedOutput  | bytes | undefined |

### NewNullifier

```solidity
event NewNullifier(bytes32 nullifier)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| nullifier  | bytes32 | undefined |

### PublicKey

```solidity
event PublicKey(address indexed owner, bytes key)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| owner `indexed` | address | undefined |
| key  | bytes | undefined |



