# Registry

*Webb Technologies.*

> A Registry for registering different assets ERC20 / ERC721 / ERC1155 tokens on the bridge





## Methods

### bytes32ToString

```solidity
function bytes32ToString(bytes32 _bytes32) external pure returns (string)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _bytes32 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined

### fungibleTokenManager

```solidity
function fungibleTokenManager() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### getAssetAddress

```solidity
function getAssetAddress(uint256 _assetId) external view returns (address)
```

Fetches the address for an asset ID



#### Parameters

| Name | Type | Description |
|---|---|---|
| _assetId | uint256 | The asset ID

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### getAssetId

```solidity
function getAssetId(address _address) external view returns (uint256)
```

Fetches the asset ID for an address



#### Parameters

| Name | Type | Description |
|---|---|---|
| _address | address | The address

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### idToWrappedAsset

```solidity
function idToWrappedAsset(uint256) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### initialize

```solidity
function initialize() external nonpayable
```






### initialized

```solidity
function initialized() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### maspVAnchor

```solidity
function maspVAnchor() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### masterFeeRecipient

```solidity
function masterFeeRecipient() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### nonFungibleTokenManager

```solidity
function nonFungibleTokenManager() external view returns (address)
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
function registerNftToken(uint32 _nonce, address _tokenHandler, uint256 _assetIdentifier, bytes _uri, bytes32 _salt) external nonpayable
```

Registers a new NFT token and deploys the NftTokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _nonce | uint32 | The nonce of the proposal
| _tokenHandler | address | The address of the token handler contract
| _assetIdentifier | uint256 | The identifier of the asset for the MASP
| _uri | bytes | The uri for the wrapped NFT
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2

### registerToken

```solidity
function registerToken(uint32 _nonce, address _tokenHandler, uint256 _assetIdentifier, bytes32 _name, bytes32 _symbol, bytes32 _salt, uint256 _limit, bool _isNativeAllowed) external nonpayable
```

Registers a new token and deploys the FungibleTokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _nonce | uint32 | The nonce of the proposal
| _tokenHandler | address | The address of the token handler contract
| _assetIdentifier | uint256 | The identifier of the asset for the MASP
| _name | bytes32 | The name of the ERC20
| _symbol | bytes32 | The symbol of the ERC20
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2
| _limit | uint256 | The maximum amount of tokens that can be wrapped
| _isNativeAllowed | bool | Whether or not native tokens are allowed to be wrapped

### registryHandler

```solidity
function registryHandler() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### wrappedAssetToId

```solidity
function wrappedAssetToId(address) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined



## Events

### TokenRegistered

```solidity
event TokenRegistered(address indexed token, address indexed handler, uint256 indexed assetId)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token `indexed` | address | undefined |
| handler `indexed` | address | undefined |
| assetId `indexed` | uint256 | undefined |



