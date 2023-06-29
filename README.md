<div align="center">
<a href="https://www.webb.tools/">

  ![Webb Logo](./.github/assets/webb_banner_light.png#gh-light-mode-only)
  ![Webb Logo](./.github/assets/webb_banner_dark.png#gh-dark-mode-only)
  </a>
</div>
<p align="left">
    <strong>🚀 Webb's Solidity Smart Contract Implementation 🚀</strong>
</p>

[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/webb-tools/protocol-solidity/check.yml?branch=main&style=flat-square)](https://github.com/webb-tools/protocol-solidity/actions) [![License Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](https://www.apache.org/licenses/LICENSE-2.0) [![Twitter](https://img.shields.io/twitter/follow/webbprotocol.svg?style=flat-square&label=Twitter&color=1DA1F2)](https://twitter.com/webbprotocol) [![Telegram](https://img.shields.io/badge/Telegram-gray?logo=telegram)](https://t.me/webbprotocol) [![Discord](https://img.shields.io/discord/833784453251596298.svg?style=flat-square&label=Discord&logo=discord)](https://discord.gg/cv8EfJu3Tn)


<!-- TABLE OF CONTENTS -->
<h2 id="table-of-contents" style=border:0!important> 📖 Table of Contents</h2>

<details open="open">
  <summary>Table of Contents</summary>
  <ul>
    <li><a href="#start"> Getting Started</a></li>
    <li><a href="#compile">Install and Compile</a></li>
    <li><a href="#nix">Using Nix with Flakes</a></li>
    <li><a href="#test">Testing</a></li>
    <li><a href="#fixtures">Fixtures</a></li>
    <li><a href="#contribute">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ul>  
</details>

<h2 id="start"> Getting Started  🎉 </h2>

This repository contains the Solidity smart contracts for Webb's Anchor System and single asset shielded pool protocols. The Anchor System is a bridging protocol for connecting cryptographic accumulators between chains and can be used, as is implemented in this repo, to build interoperable shielded pool protocols. These shielded pool protocols enable cross-chain private asset transfers and liquidity pools.

For additional information, please refer to the official [Webb docs site](http://docs.webb.tools/) 📝. Have feedback on how to improve protocol-solidity? Or have a specific question to ask? Checkout the [Anchor System Feedback Discussion](https://github.com/webb-tools/feedback/discussions/categories/anchor-protocol) 💬.


<h2 id="compile"> Installation & Compile 💻 </h2>

Install dependencies: 

```
yarn install 
```

Update submodules:

```
git submodule update --init --recursive
```

To populate fixtures from the submodules, you'll need to install DVC: https://dvc.org/doc/install. Then run:

```
yarn fetch:fixtures
```

To compile contracts and build typescript interfaces

```
yarn build
```

To run the test suite:

```
yarn test
```

To fix the formatting:

```
yarn format
```

To run TypeScript checks:

```
yarn ts-check
```

**Note:** If you push new fixtures to remote storage

```
cd solidity-fixtures
dvc add solidity-fixtures
dvc push --remote aws
```
<h2 id="nix"> Using Nix with Flakes ❄️ </h2>

1. Install [Nix](https://nixos.org/download.html)
2. Enable Flakes (if you are not already see here: [Flakes](https://nixos.wiki/wiki/Flakes))
3. If you have [`direnv`](https://github.com/nix-community/nix-direnv#installation) installed, everything should work out of the box.
4. Alternatively, you can run `nix develop` in the root of this repo to get a shell with all the dependencies installed.
5. Happy hacking!

<h2 id="fixtures"> Generating Fixtures </h2>

If you need to generate fixtures you will need Circom 2.0 and snarkjs installations. You can find installation instructions below. 

This repository makes use of node.js, yarn, Rust, and requires version 16. To install node.js binaries, installers, and source tarballs, please visit https://nodejs.org/en/download/. Once node.js is installed you may proceed to install [`yarn`](https://classic.yarnpkg.com/en/docs/install):

```
npm install --global yarn
```

Great! Now your **Node** environment is ready! 🚀🚀

You must also have Rust installed. This guide uses <https://rustup.rs> installer and the `rustup` tool to manage the Rust toolchain.

First install and configure `rustup`:

```bash
# Install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Configure
source ~/.cargo/env
```

Configure the Rust toolchain to default to the latest nightly version, and add the nightly wasm target:

```bash
rustup default nightly
rustup update
rustup update nightly
rustup target add wasm32-unknown-unknown
```

### Generating Fixtures Prerequisites

> NOTE: This is only required for testing / dev purposes and not required to compile or interact with smart contracts. 

To generate fixtures you will need Circom 2.0 and snarkjs installed. To install from source, clone the circom repository:

```
git clone https://github.com/iden3/circom.git
```

Enter the circom directory and use the cargo build to compile:
```
cargo build --release
```

The installation takes around 3 minutes to be completed. When the command successfully finishes, it generates the circom binary in the directory `target/release`. You can install this binary as follows:
```
cargo install --path circom
```
The previous command will install the circom binary in the directory `$HOME/.cargo/bin`.

#### Installing snarkjs

snarkjs is a npm package that contains code to generate and validate ZK proofs from the artifacts produced by circom.

You can install snarkjs with the following command:
```
npm install -g snarkjs
```

<h2 id="contribute"> Contributing </h2>

Interested in contributing to the Webb Relayer Network? Thank you so much for your interest! We are always appreciative for contributions from the open-source community!

If you have a contribution in mind, please check out our [Contribution Guide](./.github/CONTRIBUTING.md) for information on how to do so. We are excited for your first contribution!

<h2 id="license"> License </h2>

Licensed under <a href="LICENSE">Apache 2.0 / MIT license</a>.

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this crate by you, as defined in the MIT OR Apache 2.0 license, shall be licensed as above, without any additional terms or conditions.
