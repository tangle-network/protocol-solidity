# VAnchor

*Webb Technologies*

> Variable Anchor contract

The Variable Anchor is a variable-denominated shielded pool system derived from Tornado Nova (tornado-pool). This system extends the shielded pool system into a bridged system and allows for join/split transactions. The system is built on top the VAnchorBase/AnchorBase/LinkableTree system which allows it to be linked to other VAnchor contracts through a simple graph-like interface where anchors maintain edges of their neighboring anchors. The system requires users to create and deposit UTXOs for the supported ERC20 asset into the smart contract and insert a commitment into the underlying merkle tree of the form: commitment = Poseidon(chainID, amount, pubKey, blinding). The hash input is the UTXO data. All deposits/withdrawals are unified under a common `transact` function which requires a zkSNARK proof that the UTXO commitments are well-formed (i.e. that the deposit amount matches the sum of new UTXOs&#39; amounts). Information regarding the commitments: - Poseidon is a zkSNARK friendly hash function - destinationChainID is the chainId of the destination chain, where the withdrawal is intended to be made - Details of the UTXO and hashes are below UTXO = { destinationChainID, amount, pubkey, blinding } commitment = Poseidon(destinationChainID, amount, pubKey, blinding) nullifier = Poseidon(commitment, merklePath, sign(privKey, commitment, merklePath)) Commitments adhering to different hash functions and formats will invalidate any attempt at withdrawal. Using the preimage / UTXO of the commitment, users can generate a zkSNARK proof that the UTXO is located in one-of-many VAnchor merkle trees and that the commitment&#39;s destination chain id matches the underlying chain id of the VAnchor where the transaction is taking place. The chain id opcode is leveraged to prevent any tampering of this data.



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

### commitments

```solidity
function commitments(bytes32) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### configureMaximumDepositLimit

```solidity
function configureMaximumDepositLimit(uint256 _maximumDepositAmount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _maximumDepositAmount | uint256 | undefined

### configureMinimalWithdrawalLimit

```solidity
function configureMinimalWithdrawalLimit(uint256 _minimalWithdrawalAmount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _minimalWithdrawalAmount | uint256 | undefined

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
function getLatestNeighborEdges() external view returns (struct LinkableTree.Edge[])
```

Get the latest state of all neighbor edges




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | LinkableTree.Edge[] | Edge[] An array of all neighboring and potentially empty edges

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
function getProposalNonce() external nonpayable returns (uint32)
```

Gets the proposal nonce of this contract

*The nonce tracks how many times the handler has updated the contract*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

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
function hashLeftRight(contract IPoseidonT3 _hasher, bytes32 _left, bytes32 _right) external pure returns (bytes32)
```



*Hash 2 tree leaves, returns PoseidonT3([_left, _right])*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _hasher | contract IPoseidonT3 | undefined
| _left | bytes32 | undefined
| _right | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### hasher

```solidity
function hasher() external view returns (contract IPoseidonT3)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IPoseidonT3 | undefined

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

### isSpent

```solidity
function isSpent(bytes32 _nullifierHash) external view returns (bool)
```

Whether a note is already spent



#### Parameters

| Name | Type | Description |
|---|---|---|
| _nullifierHash | bytes32 | The nullifier hash of the deposit note

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | bool Whether the note is already spent

### isSpentArray

```solidity
function isSpentArray(bytes32[] _nullifierHashes) external view returns (bool[])
```

Whether an array of notes is already spent



#### Parameters

| Name | Type | Description |
|---|---|---|
| _nullifierHashes | bytes32[] | The array of nullifier hashes of the deposit notes

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool[] | bool[] An array indicated whether each note&#39;s nullifier hash is already spent

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

Registers and transacts in a single flow



#### Parameters

| Name | Type | Description |
|---|---|---|
| _account | VAnchorBase.Account | The account to register
| _proofArgs | VAnchorEncodeInputs.Proof | The zkSNARK proof parameters
| _extData | VAnchorBase.ExtData | The external data for the transaction

### registerAndTransactWrap

```solidity
function registerAndTransactWrap(VAnchorBase.Account _account, VAnchorEncodeInputs.Proof _proofArgs, VAnchorBase.ExtData _extData, address _tokenAddress) external nonpayable
```

Registers and transacts and wraps in a single flow



#### Parameters

| Name | Type | Description |
|---|---|---|
| _account | VAnchorBase.Account | The account to register
| _proofArgs | VAnchorEncodeInputs.Proof | The zkSNARK proof parameters
| _extData | VAnchorBase.ExtData | The external data for the transaction
| _tokenAddress | address | The token to wrap from

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

### setHandler

```solidity
function setHandler(address _handler, uint32 _nonce) external nonpayable
```

Set a new handler with a nonce

*Can only be called by the `AnchorHandler` contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _handler | address | The new handler address
| _nonce | uint32 | The nonce for updating the new handler

### setVerifier

```solidity
function setVerifier(address _verifier, uint32 _nonce) external nonpayable
```

Set a new verifier with a nonce

*Can only be called by the `AnchorHandler` contract*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _verifier | address | The new verifier address
| _nonce | uint32 | The nonce for updating the new verifier

### token

```solidity
function token() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### transact

```solidity
function transact(VAnchorEncodeInputs.Proof _args, VAnchorBase.ExtData _extData) external nonpayable
```

Executes a deposit/withdrawal or combination join/split transaction



#### Parameters

| Name | Type | Description |
|---|---|---|
| _args | VAnchorEncodeInputs.Proof | The zkSNARK proof parameters
| _extData | VAnchorBase.ExtData | The external data for the transaction

### transactWrap

```solidity
function transactWrap(VAnchorEncodeInputs.Proof _args, VAnchorBase.ExtData _extData, address _tokenAddress) external payable
```

Executes a deposit/withdrawal or combination join/split transaction including wrapping or unwrapping



#### Parameters

| Name | Type | Description |
|---|---|---|
| _args | VAnchorEncodeInputs.Proof | The zkSNARK proof parameters
| _extData | VAnchorBase.ExtData | The external data for the transaction
| _tokenAddress | address | The token to wrap from or unwrap into depending on the positivity of `_extData.extAmount`

### unpackProof

```solidity
function unpackProof(uint256[8] _proof) external pure returns (uint256[2], uint256[2][2], uint256[2])
```

A helper function to convert an array of 8 uint256 values into the a, b, and c array values that the zk-SNARK verifier&#39;s verifyProof accepts.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _proof | uint256[8] | The array of 8 uint256 values

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[2] | (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c) The unpacked proof values
| _1 | uint256[2][2] | undefined
| _2 | uint256[2] | undefined

### unwrapIntoNative

```solidity
function unwrapIntoNative(address _tokenAddress, uint256 _amount) external nonpayable
```

Unwrap the TokenWrapper token for the `msg.sender` into the native token



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | undefined
| _amount | uint256 | The amount of tokens to unwrap

### unwrapIntoToken

```solidity
function unwrapIntoToken(address _tokenAddress, uint256 _amount) external nonpayable
```

Unwraps the TokenWrapper token for the `msg.sender` into one of its wrappable tokens.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to unwrap into
| _amount | uint256 | The amount of tokens to unwrap

### updateEdge

```solidity
function updateEdge(uint256 _sourceChainID, bytes32 _root, uint256 _leafIndex) external payable
```

Add an edge to the tree or update an existing edge.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _sourceChainID | uint256 | The chainID of the edge&#39;s LinkableTree
| _root | bytes32 | The merkle root of the edge&#39;s merkle tree
| _leafIndex | uint256 | The latest leaf insertion index of the edge&#39;s merkle tree

### verifier

```solidity
function verifier() external view returns (contract IAnchorVerifier)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAnchorVerifier | undefined

### withdrawAndUnwrap

```solidity
function withdrawAndUnwrap(address _tokenAddress, address _recipient, uint256 _minusExtAmount) external payable
```

Unwraps into a valid token for the `msg.sender`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The token to unwrap into
| _recipient | address | The address of the recipient for the unwrapped assets
| _minusExtAmount | uint256 | Negative external amount for the transaction

### wrapAndDeposit

```solidity
function wrapAndDeposit(address _tokenAddress, uint256 _extAmount) external payable
```

Wraps a token for the `msg.sender`



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to wrap
| _extAmount | uint256 | The external amount for the transaction

### wrapNative

```solidity
function wrapNative() external payable
```

Wrap the native token for the `msg.sender` into the TokenWrapper tokenThe amount is taken from `msg.value`




### wrapToken

```solidity
function wrapToken(address _tokenAddress, uint256 _amount) external nonpayable
```

Wraps a token for the `msg.sender` using the underlying FixedDepositAnchor&#39;s TokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to wrap
| _amount | uint256 | The amount of tokens to wrap

### zeros

```solidity
function zeros(uint256 i) external pure returns (bytes32)
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

### Insertion

```solidity
event Insertion(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| commitment `indexed` | bytes32 | undefined |
| leafIndex  | uint32 | undefined |
| timestamp  | uint256 | undefined |

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



