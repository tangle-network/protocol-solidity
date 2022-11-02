<h1 align="center">Webb Protocol Solidity</h1> 

<p align="center"> 
    <strong>🕸️  Webb Protocol Solidity  ⧫</strong>
    <br />
    <sub> ⚠️ Beta Software ⚠️ </sub>
</p>

<br />

## Compiling

- `yarn build`

This command will build the Solidity system, performing the following build steps:

1. Compile the smart contracts and generate appropriate typescript bindings in a folder `typechain` at the root directory.

2. Compile the circom circuits.

3. Compile the hashers. These hashers are provided to the merkle tree upon deployment.

4. Generate ptau. The ptau is needed for setup of zero knowledge proofs. This ptau is for test purposes / dev environment only!

## Testing 

## Interacting

This repository contains a variety of scripts to deploy and interact with the smart contracts in the `scripts` folder. To use these scripts, one will need to setup an `.env` file in the root directory:

```
# ENDPOINT=https://api.s0.b.hmny.io
ENDPOINT=https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e
PRIVATE_KEY=

# CHAIN 1 deployments
CHAIN_1_ENDPOINT=https://api.s0.b.hmny.io
CHAIN_1_WEBB=0x9d609F54536Cef34f5F612BD976ca632F1fa208E
CHAIN_1_Hasher=0xB039952e6A46b890e2a44835d97dE253482b2Ca2
CHAIN_1_Verifier=0x6f82483876ab96Dd948805Db93da675e920362ED
CHAIN_1_WEBBAnchor=0x64E9727C4a835D518C34d3A50A8157120CAeb32F
CHAIN_1_Bridge=0xD776C2CB8137f5cd2eE42601F02b9B3320220429
CHAIN_1_AnchorHandler=0x7BE9CCe0Ac490ec1E12417250c3AeeF4Dc15F5aF

# Chain 2 deployments
CHAIN_2_ENDPOINT=https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e
CHAIN_2_WEBB=0x7Cec2Bf7D9c4C3C96Da8a0BfeBAB1E84b8212394
CHAIN_2_Hasher=0x708D0657973933aDec4768F13884805fAD913eC7
CHAIN_2_Verifier=0x294E94Dc198FDB6CB2D779A41c112fB51C7b869D
CHAIN_2_WEBBAnchor=0xB42139fFcEF02dC85db12aC9416a19A12381167D
CHAIN_2_Bridge=0x4Dc953Ad1FfE7eD5d46C704C10162A55c543f902
CHAIN_2_AnchorHandler=0xF5DDce2770149Aa387857Dc03F05F86A5EEa6789
```

## License

<sup>
Licensed under <a href="LICENSE">GPLV3 license</a>.
</sup>

<br/>

<sub>
Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in this crate by you, as defined in the GPLV3 license, shall
be licensed as above, without any additional terms or conditions.
</sub>

