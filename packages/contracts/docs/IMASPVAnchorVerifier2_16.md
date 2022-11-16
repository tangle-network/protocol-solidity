# IMASPVAnchorVerifier2_16



> IMASPVAnchorVerifier join/split verifier interface with 2 edges and 16 inputs to 2 outputs. The X_Y (2_16) identifiers designate the following: - X is the # of edges supported on this VAnchor (i.e. 2) - Y is the # of inputs to the join/split transaction (i.e. 16)





## Methods

### verifyProof

```solidity
function verifyProof(uint256[2] a, uint256[2][2] b, uint256[2] c, uint256[24] input) external view returns (bool r)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| a | uint256[2] | undefined
| b | uint256[2][2] | undefined
| c | uint256[2] | undefined
| input | uint256[24] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| r | bool | undefined




