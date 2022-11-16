# IRegistry

*Webb Technologies.*

> A MultiTokenManager manages FungibleTokenWrapper systems using an external `governor` address





## Methods

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

### registerNftToken

```solidity
function registerNftToken(uint32 _nonce, address _handler, uint256 _assetIdentifier, bytes _uri, bytes32 _salt) external nonpayable
```

Registers a new NFT token and deploys the NftTokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _nonce | uint32 | The nonce of the proposal
| _handler | address | The address of the token handler contract
| _assetIdentifier | uint256 | The identifier of the asset for the MASP
| _uri | bytes | The uri for the wrapped NFT
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2

### registerToken

```solidity
function registerToken(uint32 _nonce, address _handler, uint256 _assetIdentifier, bytes32 _name, bytes32 _symbol, bytes32 _salt, uint256 _limit, uint16 _feePercentage, bool _isNativeAllowed) external nonpayable
```

Registers a new token and deploys the FungibleTokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _nonce | uint32 | The nonce of the proposal
| _handler | address | The address of the token handler contract
| _assetIdentifier | uint256 | The identifier of the asset for the MASP
| _name | bytes32 | The name of the ERC20
| _symbol | bytes32 | The symbol of the ERC20
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2
| _limit | uint256 | The maximum amount of tokens that can be wrapped
| _feePercentage | uint16 | The fee percentage for wrapping
| _isNativeAllowed | bool | Whether or not native tokens are allowed to be wrapped




