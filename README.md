<h1 align="center">Webb Protocol Solidity</h1>

<p align="center">
    <strong>🕸️  Webb Protocol Solidity  ⧫</strong>
    <br />
    <sub> ⚠️ Beta Software ⚠️ </sub>
</p>

<br />

## Prerequisites

- This repository assumes the user has successfully installed Node, nvm, yarn.

- This repository assumes the user has successfully installed rust
## Installation

- Run `yarn` to install javascript dependencies.

- This repository requires the installation of circom 2.0 if generating fixtures. Install the circom 2.0 rust implementation [here](https://docs.circom.io/getting-started/installation/)

## Compiling

After cloning the project, populate the latest fixtures (large zero-knowledge files):

- `git submodule update --init`

If you are just attempting to run tests, the following command is suitable:

- `yarn compile`

If you require generation of new fixtures / updates have been made to circom circuits:

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

