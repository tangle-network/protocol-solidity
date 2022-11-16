# MultiNftTokenManager

*Webb Technologies.*

> A MultiNftTokenManager manages NftTokenWrapper systems using an external `governor` address





## Methods

### getProposalNonce

```solidity
function getProposalNonce() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getWrappedTokens

```solidity
function getWrappedTokens() external view returns (address[])
```

Gets the currently available wrappable tokens by their addresses




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | address[] The currently available wrappable token addresses

### initialize

```solidity
function initialize(address _registry, address _feeRecipient) external nonpayable
```

Initialize the contract with the registry and fee recipient



#### Parameters

| Name | Type | Description |
|---|---|---|
| _registry | address | The address of the registry
| _feeRecipient | address | The address of the fee recipient

### initialized

```solidity
function initialized() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### masterFeeRecipient

```solidity
function masterFeeRecipient() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### proposalNonce

```solidity
function proposalNonce() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### registerNftToken

```solidity
function registerNftToken(address _handler, string _uri, bytes32 _salt) external nonpayable returns (address)
```

Registers a new NFT token and deploys the NftTokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _handler | address | The address of the token handler contract
| _uri | string | The uri for the wrapped ERC1155
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### registerToken

```solidity
function registerToken(address, string, string, bytes32, uint256, uint16, bool) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined
| _1 | string | undefined
| _2 | string | undefined
| _3 | bytes32 | undefined
| _4 | uint256 | undefined
| _5 | uint16 | undefined
| _6 | bool | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### registry

```solidity
function registry() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### setMasterFeeRecipient

```solidity
function setMasterFeeRecipient(address _feeRecipient) external nonpayable
```

Sets the master fee recipient



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeRecipient | address | undefined

### setRegistry

```solidity
function setRegistry(address _registry) external nonpayable
```

Sets the registry



#### Parameters

| Name | Type | Description |
|---|---|---|
| _registry | address | undefined

### wrappedTokens

```solidity
function wrappedTokens(uint256) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined




