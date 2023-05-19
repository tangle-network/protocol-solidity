import { IVariableAnchorExtData, IVariableAnchorPublicInputs } from '@webb-tools/interfaces';
import { VAnchor } from '@webb-tools/anchors';
import { CircomUtxo, Keypair, Utxo } from '@webb-tools/sdk-core';
import { MintableToken } from '@webb-tools/tokens';
import { getChainIdType, ZkComponents } from '@webb-tools/utils';
import { VBridge, VBridgeInput } from '@webb-tools/vbridge';
import { ethers } from 'ethers';
import { Server } from 'ganache';
import { LocalChain } from './localTestnet';

import { hexToU8a, u8aToHex } from '@polkadot/util';

import { GanacheAccounts, startGanacheServer } from './startGanacheServer.js';
import { VAnchorTree } from '@webb-tools/contracts';

export class LocalEvmChain {
  public readonly typedChainId: number;

  constructor(
    public readonly endpoint: string,
    public readonly evmId: number,
    private readonly server: Server<'ethereum'>
  ) {
    this.typedChainId = getChainIdType(evmId);
  }

  public static async init(
    name: string,
    evmId: number,
    initalBalances: GanacheAccounts[],
    options?: any
  ): Promise<LocalEvmChain> {
    const endpoint = `http://localhost:${evmId}`;
    const server = await startGanacheServer(evmId, evmId, initalBalances, {
      quiet: true,
      ...options,
    });
    const chain = new LocalEvmChain(endpoint, evmId, server);

    return chain;
  }

  public provider(): ethers.providers.WebSocketProvider {
    return new ethers.providers.WebSocketProvider(this.endpoint);
  }

  public async stop() {
    await this.server.close();
  }

  public async deployToken(
    name: string,
    symbol: string,
    wallet: ethers.Signer
  ): Promise<MintableToken> {
    return MintableToken.createToken(name, symbol, wallet);
  }

  // It is expected that parameters are passed with the same indices of arrays.
  public static async deployVBridge(
    chains: LocalEvmChain[],
    tokens: MintableToken[],
    wallets: ethers.Wallet[],
    zkComponentsSmall: ZkComponents,
    zkComponentsLarge: ZkComponents
  ): Promise<VBridge<VAnchorTree>> {
    const assetRecord: Record<number, string[]> = {};
    const deployers: Record<number, ethers.Wallet> = {};
    const governors: Record<number, string> = {};
    const chainIdsArray: number[] = [];

    for (let i = 0; i < chains.length; i++) {
      wallets[i].connect(chains[i].provider());
      assetRecord[chains[i].typedChainId] = [tokens[i].contract.address];
      deployers[chains[i].typedChainId] = wallets[i];
      governors[chains[i].typedChainId] = await wallets[i].getAddress();
      chainIdsArray.push(chains[i].typedChainId);
    }

    const bridgeInput: VBridgeInput = {
      chainIds: chainIdsArray,
      vAnchorInputs: {
        asset: assetRecord,
      },
      webbTokens: new Map(),
    };
    const deployerConfig = {
      ...deployers,
    };
    const governorConfig = {
      ...governors,
    };

    return VBridge.deployVariableAnchorBridge(
      bridgeInput,
      deployerConfig,
      governorConfig,
      zkComponentsSmall,
      zkComponentsLarge
    );
  }
}

/** Setup a vanchor withdraw transaction for an evm target.
    Generates extData and publicInputs to be used for a vanchor withdraw transaction.
    This function handles boilerplate such as leaf fetching and regenerates the utxo to set the appropriate
    index for proving.
    The `inputUtxo` should be spendable by the `spender`
 **/
export async function setupVanchorEvmWithdrawTx(
  inputUtxo: Utxo,
  srcChain: LocalChain,
  destChain: LocalChain,
  spender: Keypair,
  srcVanchor: VAnchor,
  destVAnchor: VAnchor,
  walletAddress: string,
  recipient: string
): Promise<{
  extData: IVariableAnchorExtData;
  publicInputs: IVariableAnchorPublicInputs;
}> {
  const extAmount = ethers.BigNumber.from(0).sub(inputUtxo.amount);

  const dummyOutput1 = await CircomUtxo.generateUtxo({
    amount: '0',
    backend: 'Circom',
    chainId: destChain.chainId.toString(),
    curve: 'Bn254',
    keypair: spender,
  });

  const dummyOutput2 = await CircomUtxo.generateUtxo({
    amount: '0',
    backend: 'Circom',
    chainId: destChain.chainId.toString(),
    curve: 'Bn254',
    keypair: spender,
  });

  const dummyInput = await CircomUtxo.generateUtxo({
    amount: '0',
    backend: 'Circom',
    chainId: destChain.chainId.toString(),
    curve: 'Bn254',
    keypair: spender,
    originChainId: destChain.chainId.toString(),
  });

  // Populate the leavesMap for generating the zkp against the source chain
  const leaves1 = srcVanchor.tree.elements().map((el) => hexToU8a(el.toHexString()));

  const leaves2 = destVAnchor.tree.elements().map((el) => hexToU8a(el.toHexString()));

  const depositUtxoIndex = srcVanchor.tree.getIndexByElement(u8aToHex(inputUtxo.commitment));

  inputUtxo.setIndex(depositUtxoIndex);

  const leavesMap = {
    [srcChain.chainId]: leaves1,
    [destChain.chainId]: leaves2,
  };

  const { extData, publicInputs } = await destVAnchor.setupTransaction(
    [inputUtxo, dummyInput],
    [dummyOutput1, dummyOutput2],
    0,
    0,
    walletAddress,
    recipient,
    '',
    leavesMap
  );

  return { extData, publicInputs };
}
