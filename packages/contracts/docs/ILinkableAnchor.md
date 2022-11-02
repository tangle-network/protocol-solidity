# ILinkableAnchor



> ILinkableAnchor Interface

The interface supports updating edges for a graph-like functionality. It also supports setting handlers and verifiers for handling updates to the edge data of a LinkableAnchor as well as the verifier used in verifying proofs of knowledge of leaves in one-of-many merkle trees. The ILinkableAnchor interface can also be used with the VAnchor system to control the minimal and maximum withdrawal and deposit limits respectively.



## Methods

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

### setVerifier

```solidity
function setVerifier(address verifier, uint32 nonce) external nonpayable
```

Sets the verifier for zkSNARKs



#### Parameters

| Name | Type | Description |
|---|---|---|
| verifier | address | The new verifier address
| nonce | uint32 | The nonce for tracking update counts

### updateEdge

```solidity
function updateEdge(bytes32 root, uint32 latestLeafIndex, bytes32 target) external payable
```

The function is used to update the edge data of a LinkableAnchor



#### Parameters

| Name | Type | Description |
|---|---|---|
| root | bytes32 | The merkle root of the linked anchor on the  `sourceChainID`&#39;s chain
| latestLeafIndex | uint32 | The index of the leaf updating the merkle tree with root `root`
| target | bytes32 | The target resource ID of the linked anchor




