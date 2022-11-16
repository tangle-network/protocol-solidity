# IdentityVAnchorEncodeInputs



> VAnchorEncodeInputs library for encoding inputs for VAnchor proofs





## Methods

### EVM_CHAIN_ID_TYPE

```solidity
function EVM_CHAIN_ID_TYPE() external view returns (bytes2)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes2 | undefined

### _encodeInputs16

```solidity
function _encodeInputs16(IdentityVAnchorEncodeInputs.Proof _args, uint8 _maxEdges) external view returns (bytes, bytes32[])
```

Encodes the proof into its public inputs and roots array for 16 input / 2 output txes



#### Parameters

| Name | Type | Description |
|---|---|---|
| _args | IdentityVAnchorEncodeInputs.Proof | The proof arguments
| _maxEdges | uint8 | The maximum # of edges supported by the underlying VAnchor

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | (bytes, bytes) The public inputs and roots array separated
| _1 | bytes32[] | undefined

### _encodeInputs2

```solidity
function _encodeInputs2(IdentityVAnchorEncodeInputs.Proof _args, uint8 _maxEdges) external view returns (bytes, bytes32[])
```

Encodes the proof into its public inputs and roots array for 2 input / 2 output txes



#### Parameters

| Name | Type | Description |
|---|---|---|
| _args | IdentityVAnchorEncodeInputs.Proof | The proof arguments
| _maxEdges | uint8 | The maximum # of edges supported by the underlying VAnchor

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes | (bytes, bytes) The public inputs and roots array separated
| _1 | bytes32[] | undefined

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




