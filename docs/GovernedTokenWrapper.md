# GovernedTokenWrapper

*Webb Technologies.*

> A governed TokenWrapper system using an external `governor` address

Governs allowable ERC20s to deposit using a governable wrapping limit and sets fees for wrapping into itself. This contract is intended to be used with TokenHandler contract.



## Methods

### DEFAULT_ADMIN_ROLE

```solidity
function DEFAULT_ADMIN_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### MINTER_ROLE

```solidity
function MINTER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### PAUSER_ROLE

```solidity
function PAUSER_ROLE() external view returns (bytes32)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### add

```solidity
function add(address _tokenAddress, uint256 _nonce) external nonpayable
```

Adds a token at `_tokenAddress` to the GovernedTokenWrapper&#39;s wrapping listOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to be added
| _nonce | uint256 | The nonce tracking updates to this contract

### allowance

```solidity
function allowance(address owner, address spender) external view returns (uint256)
```



*See {IERC20-allowance}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| owner | address | undefined
| spender | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### approve

```solidity
function approve(address spender, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-approve}. Requirements: - `spender` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```



*See {IERC20-balanceOf}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### burn

```solidity
function burn(uint256 amount) external nonpayable
```



*Destroys `amount` tokens from the caller. See {ERC20-_burn}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint256 | undefined

### burnFrom

```solidity
function burnFrom(address account, uint256 amount) external nonpayable
```



*Destroys `amount` tokens from `account`, deducting from the caller&#39;s allowance. See {ERC20-_burn} and {ERC20-allowance}. Requirements: - the caller must have allowance for ``accounts``&#39;s tokens of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined
| amount | uint256 | undefined

### decimals

```solidity
function decimals() external view returns (uint8)
```



*Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless this function is overridden; NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external nonpayable returns (bool)
```



*Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined
| subtractedValue | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### feeRecipient

```solidity
function feeRecipient() external view returns (address payable)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address payable | undefined

### getAmountToWrap

```solidity
function getAmountToWrap(uint256 _deposit) external view returns (uint256)
```

Get the amount to wrap for a target `_deposit` amount



#### Parameters

| Name | Type | Description |
|---|---|---|
| _deposit | uint256 | The deposit amount

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | uint The amount to wrap conditioned on the deposit amount

### getFee

```solidity
function getFee() external view returns (uint8)
```

Gets the current fee percentage




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | uint8 The fee percentage

### getFeeFromAmount

```solidity
function getFeeFromAmount(uint256 _amountToWrap) external view returns (uint256)
```

Get the fee for a target amount to wrap



#### Parameters

| Name | Type | Description |
|---|---|---|
| _amountToWrap | uint256 | The amount to wrap

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | uint The fee amount of the token being wrapped

### getRoleAdmin

```solidity
function getRoleAdmin(bytes32 role) external view returns (bytes32)
```



*Returns the admin role that controls `role`. See {grantRole} and {revokeRole}. To change a role&#39;s admin, use {_setRoleAdmin}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### getRoleMember

```solidity
function getRoleMember(bytes32 role, uint256 index) external view returns (address)
```



*Returns one of the accounts that have `role`. `index` must be a value between 0 and {getRoleMemberCount}, non-inclusive. Role bearers are not sorted in any particular way, and their ordering may change at any point. WARNING: When using {getRoleMember} and {getRoleMemberCount}, make sure you perform all queries on the same block. See the following https://forum.openzeppelin.com/t/iterating-over-elements-on-enumerableset-in-openzeppelin-contracts/2296[forum post] for more information.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| index | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### getRoleMemberCount

```solidity
function getRoleMemberCount(bytes32 role) external view returns (uint256)
```



*Returns the number of accounts that have `role`. Can be used together with {getRoleMember} to enumerate all bearers of a role.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getTokens

```solidity
function getTokens() external view returns (address[])
```

Gets the currently available wrappable tokens by their addresses




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | address[] The currently available wrappable token addresses

### governor

```solidity
function governor() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### grantRole

```solidity
function grantRole(bytes32 role, address account) external nonpayable
```



*Overload {grantRole} to track enumerable memberships*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

### hasRole

```solidity
function hasRole(bytes32 role, address account) external view returns (bool)
```



*Returns `true` if `account` has been granted `role`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### historicalTokens

```solidity
function historicalTokens(uint256) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external nonpayable returns (bool)
```



*Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| spender | address | undefined
| addedValue | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isNativeAllowed

```solidity
function isNativeAllowed() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### mint

```solidity
function mint(address to, uint256 amount) external nonpayable
```



*Creates `amount` new tokens for `to`. See {ERC20-_mint}. Requirements: - the caller must have the `MINTER_ROLE`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| to | address | undefined
| amount | uint256 | undefined

### name

```solidity
function name() external view returns (string)
```



*Returns the name of the token.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined

### pause

```solidity
function pause() external nonpayable
```



*Pauses all token transfers. See {ERC20Pausable} and {Pausable-_pause}. Requirements: - the caller must have the `PAUSER_ROLE`.*


### paused

```solidity
function paused() external view returns (bool)
```



*Returns true if the contract is paused, and false otherwise.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### proposalNonce

```solidity
function proposalNonce() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### remove

```solidity
function remove(address _tokenAddress, uint256 _nonce) external nonpayable
```

Removes a token at `_tokenAddress` from the GovernedTokenWrapper&#39;s wrapping listOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _tokenAddress | address | The address of the token to be removed
| _nonce | uint256 | The nonce tracking updates to this contract

### renounceRole

```solidity
function renounceRole(bytes32 role, address account) external nonpayable
```



*Overload {renounceRole} to track enumerable memberships*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

### revokeRole

```solidity
function revokeRole(bytes32 role, address account) external nonpayable
```



*Overload {revokeRole} to track enumerable memberships*

#### Parameters

| Name | Type | Description |
|---|---|---|
| role | bytes32 | undefined
| account | address | undefined

### setFee

```solidity
function setFee(uint8 _feePercentage, uint256 _nonce) external nonpayable
```

Sets a new `_feePercentage` for the GovernedTokenWrapperOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feePercentage | uint8 | The new fee percentage
| _nonce | uint256 | The nonce tracking updates to this contract

### setFeeRecipient

```solidity
function setFeeRecipient(address payable _feeRecipient, uint256 _nonce) external nonpayable
```

Sets a new `_feeRecipient` for the GovernedTokenWrapperOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _feeRecipient | address payable | The new fee recipient
| _nonce | uint256 | The nonce tracking updates to this contract

### setGovernor

```solidity
function setGovernor(address _governor) external nonpayable
```

Sets the governor of the GovernedTokenWrapper contractOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _governor | address | The address of the new governor

### setNativeAllowed

```solidity
function setNativeAllowed(bool _isNativeAllowed) external nonpayable
```

Sets whether native tokens are allowed to be wrappedOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _isNativeAllowed | bool | Whether or not native tokens are allowed to be wrapped

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) external view returns (bool)
```



*See {IERC165-supportsInterface}.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| interfaceId | bytes4 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### symbol

```solidity
function symbol() external view returns (string)
```



*Returns the symbol of the token, usually a shorter version of the name.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined

### tokens

```solidity
function tokens(uint256) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```



*See {IERC20-totalSupply}.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### transfer

```solidity
function transfer(address recipient, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-transfer}. Requirements: - `recipient` cannot be the zero address. - the caller must have a balance of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external nonpayable returns (bool)
```



*See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}. Requirements: - `sender` and `recipient` cannot be the zero address. - `sender` must have a balance of at least `amount`. - the caller must have allowance for ``sender``&#39;s tokens of at least `amount`.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | undefined
| recipient | address | undefined
| amount | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### unpause

```solidity
function unpause() external nonpayable
```



*Unpauses all token transfers. See {ERC20Pausable} and {Pausable-_unpause}. Requirements: - the caller must have the `PAUSER_ROLE`.*


### unwrap

```solidity
function unwrap(address tokenAddress, uint256 amount) external nonpayable
```

Used to unwrap/burn the wrapper token on behalf of a sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | Address of ERC20 to unwrap into.
| amount | uint256 | Amount of tokens to burn.

### unwrapAndSendTo

```solidity
function unwrapAndSendTo(address tokenAddress, uint256 amount, address recipient) external nonpayable
```

Used to unwrap/burn the wrapper token on behalf of a sender.



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | Address of ERC20 to unwrap into.
| amount | uint256 | Amount of tokens to burn.
| recipient | address | undefined

### unwrapFor

```solidity
function unwrapFor(address sender, address tokenAddress, uint256 amount) external nonpayable
```

Used to unwrap/burn the wrapper token.



#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | The address that the caller is unwrapping for
| tokenAddress | address | Address of ERC20 to unwrap into.
| amount | uint256 | Amount of tokens to burn.

### updateLimit

```solidity
function updateLimit(uint256 _limit) external nonpayable
```

Updates the `_limit` of tokens that can be wrappedOnly the governor can call this function



#### Parameters

| Name | Type | Description |
|---|---|---|
| _limit | uint256 | The new limit of tokens that can be wrapped

### wrap

```solidity
function wrap(address tokenAddress, uint256 amount) external payable
```

Used to wrap tokens on behalf of a sender. Must be called by a minter role.



#### Parameters

| Name | Type | Description |
|---|---|---|
| tokenAddress | address | Address of ERC20 to transfer.
| amount | uint256 | Amount of tokens to transfer.

### wrapFor

```solidity
function wrapFor(address sender, address tokenAddress, uint256 amount) external payable
```

Used to wrap tokens on behalf of a sender



#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | Address of sender where assets are sent from.
| tokenAddress | address | Address of ERC20 to transfer.
| amount | uint256 | Amount of tokens to transfer.

### wrapForAndSendTo

```solidity
function wrapForAndSendTo(address sender, address tokenAddress, uint256 amount, address recipient) external payable
```

Used to wrap tokens on behalf of a sender and mint to a potentially different address



#### Parameters

| Name | Type | Description |
|---|---|---|
| sender | address | Address of sender where assets are sent from.
| tokenAddress | address | Address of ERC20 to transfer.
| amount | uint256 | Amount of tokens to transfer.
| recipient | address | Recipient of the wrapped tokens.

### wrappingLimit

```solidity
function wrappingLimit() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined



## Events

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| owner `indexed` | address | undefined |
| spender `indexed` | address | undefined |
| value  | uint256 | undefined |

### Paused

```solidity
event Paused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |

### RoleAdminChanged

```solidity
event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| previousAdminRole `indexed` | bytes32 | undefined |
| newAdminRole `indexed` | bytes32 | undefined |

### RoleGranted

```solidity
event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### RoleRevoked

```solidity
event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| role `indexed` | bytes32 | undefined |
| account `indexed` | address | undefined |
| sender `indexed` | address | undefined |

### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| from `indexed` | address | undefined |
| to `indexed` | address | undefined |
| value  | uint256 | undefined |

### Unpaused

```solidity
event Unpaused(address account)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account  | address | undefined |



