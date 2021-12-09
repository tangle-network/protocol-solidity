# AnchorPoseidon









## Methods

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

### currentRootIndex

```solidity
function currentRootIndex() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

### denomination

```solidity
function denomination() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### deposit

```solidity
function deposit(bytes32 _commitment) external payable
```



*Deposit funds into the contract. The caller must send (for ETH) or approve (for ERC20) value equal to or `denomination` of this instance.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _commitment | bytes32 | the note commitment, which is PedersenHash(nullifier + secret)

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

### handler

```solidity
function handler() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

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

### isSpentArray

```solidity
function isSpentArray(bytes32[] _nullifierHashes) external view returns (bool[] spent)
```



*whether an array of notes is already spent *

#### Parameters

| Name | Type | Description |
|---|---|---|
| _nullifierHashes | bytes32[] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| spent | bool[] | undefined

### levels

```solidity
function levels() external view returns (uint32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

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

### verifier

```solidity
function verifier() external view returns (contract IVerifier)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IVerifier | undefined

### withdraw

```solidity
function withdraw(bytes _proof, bytes32 _root, bytes32 _nullifierHash, address payable _recipient, address payable _relayer, uint256 _fee, uint256 _refund) external payable
```



*Withdraw a deposit from the contract. `proof` is a zkSNARK proof data, and input is an array of circuit public inputs `input` array consists of: - merkle root of all deposits in the contract - hash of unique deposit nullifier to prevent double spends - the recipient of funds - optional fee that goes to the transaction sender (usually a relay)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _proof | bytes | undefined
| _root | bytes32 | undefined
| _nullifierHash | bytes32 | undefined
| _recipient | address payable | undefined
| _relayer | address payable | undefined
| _fee | uint256 | undefined
| _refund | uint256 | undefined

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

### Deposit

```solidity
event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| commitment `indexed` | bytes32 | undefined |
| leafIndex  | uint32 | undefined |
| timestamp  | uint256 | undefined |

### Withdrawal

```solidity
event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| to  | address | undefined |
| nullifierHash  | bytes32 | undefined |
| relayer `indexed` | address | undefined |
| fee  | uint256 | undefined |



