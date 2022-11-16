# MultiFungibleTokenManager

*Webb Technologies.*

> A MultiFungibleTokenManager manages FungibleTokenWrapper systems using an external `handler` address.





## Methods

### getWrappedTokens

```solidity
function getWrappedTokens() external view returns (address[])
```

Gets the currently available wrappable tokens by their addresses




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | address[] The currently available wrappable token addresses

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
function registerNftToken(address, string, bytes32) external view returns (address)
```

Registers an NFT token



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined
| _1 | string | undefined
| _2 | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### registerToken

```solidity
function registerToken(address _handler, string _name, string _symbol, bytes32 _salt, uint256 _limit, bool _isNativeAllowed) external nonpayable returns (address)
```

Registers a new token and deploys the FungibleTokenWrapper contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _handler | address | The address of the token handler contract
| _name | string | The name of the ERC20
| _symbol | string | The symbol of the ERC20
| _salt | bytes32 | Salt used for matching addresses across chain using CREATE2
| _limit | uint256 | The maximum amount of tokens that can be wrapped
| _isNativeAllowed | bool | Whether or not native tokens are allowed to be wrapped

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




