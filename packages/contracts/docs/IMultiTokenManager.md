# IMultiTokenManager

*Webb Technologies.*

> A MultiTokenManager manages FungibleTokenWrapper systems using an external `governor` address





## Methods

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
function registerToken(address _handler, string _name, string _symbol, bytes32 _salt, uint256 _limit, uint16 _feePercentage, bool _isNativeAllowed) external nonpayable returns (address)
```

Registers a new token and deploys the FungibleTokenWrapperInitializable contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _handler | address | The address of the token handler contract
| _name | string | The name of the ERC20
| _symbol | string | The symbol of the ERC20
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2
| _limit | uint256 | The maximum amount of tokens that can be wrapped
| _feePercentage | uint16 | The fee percentage for wrapping
| _isNativeAllowed | bool | Whether or not native tokens are allowed to be wrapped

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined




