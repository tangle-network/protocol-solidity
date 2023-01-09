<h1 align="center">Webb EVM-Localnet 🕸️ </h1>
<div align="center">
<a href="https://www.webb.tools/">
    <img alt="Webb Logo" src="./.github/assets/webb-icon.svg" width="15%" height="30%" />
  </a>
  </div>
<p align="center">
    <strong> A local ganache network for testing evm interactions in development </strong>
    <br />
</p>

<div align="center" >

[![License Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](https://opensource.org/licenses/Apache-2.0)
[![Twitter](https://img.shields.io/twitter/follow/webbprotocol.svg?style=flat-square&label=Twitter&color=1DA1F2)](https://twitter.com/webbprotocol)
[![Telegram](https://img.shields.io/badge/Telegram-gray?logo=telegram)](https://t.me/webbprotocol)
[![Discord](https://img.shields.io/discord/833784453251596298.svg?style=flat-square&label=Discord&logo=discord)](https://discord.gg/cv8EfJu3Tn)

</div>

<!-- TABLE OF CONTENTS -->
<h2 id="table-of-contents"> 📖 Table of Contents</h2>

<details open="open">
  <summary>Table of Contents</summary>
  <ul>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#start">Start</a></li>
    <li><a href="#usage">Usage</a></li>
  </ul>  
</details>


<h1 id="overview"> Overview </h1>

This Repository is meant to support a development environment for the anchor protocol over EVM networks.  In its current state, it starts up two networks and deploys a FixedAnchor bridge over these networks for a freshly created erc20 token.

- Hermes: chainId 5001, 'chain a'
- Athena: chainId 5002, 'chain b'
- Demeter: chainId 5003, 'chain c'

<h1 id="start"> Start </h1>

1. Clone the local testnet: 
```bash
git clone https://github.com/webb-tools/evm-localnet
```

2. Populate fixed zero knowledge keys by running:
```bash
git submodule update --init
```
3. Install dependencies:
```bash
  yarn install
``` 
4. Start the local testnet with:
```
yarn start
```
Great! Now you have a local EVM node running!


<h1 id="usage"> Usage </h1>

The deployer is the oracle signer for this bridge. As such, a CLI is supported for actions which require the bridge to sign messages, acting as the DKG.  These commands are as follows:

    - 'deposit on chain a': Using the deployer account, deposit into the fixed anchor on chain a. The deposit is stored in this local testnet memory for use by the withdraw command later.
    - 'relay from a to b': Using the deployer account, look at the latest deposit on chain a and update chain b's root. This simulates the work of the Webb Relayer network interacting with a dkg and submitting the signed transaction on the other side of the bridge.
    - 'withdraw on chain b': Using the deployer account, withdraw from the chain. It takes the latest deposit done through the CLI for a withdraw.
    - 'root on chain a': Print the current root of the merkle tree for chain a.


For full E2E integration testing with the dapp, deposits and withdrawals can be done through the DApp UI.
Simply call the 'relay from <a> to <b>' command after a deposit through the dapp to relay the roots before initiating the withdrawal through the dapp.