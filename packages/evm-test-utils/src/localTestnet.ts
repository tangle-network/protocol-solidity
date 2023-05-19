/*
 * Copyright 2022 Webb Technologies Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { getChainIdType } from '@webb-tools/utils';
import { ethers } from 'ethers';
import { GanacheAccounts, LocalEvmChain } from './';

// Describes chain info
type LocalChainOpts = {
  name: string;
  port: number;
  chainId: number;
  populatedAccounts: GanacheAccounts[];
  enableLogging?: boolean;
};

export class LocalChain {
  private localEvmChain: LocalEvmChain;
  public readonly endpoint: string;
  private constructor(private readonly opts: LocalChainOpts, localEvmChain: LocalEvmChain) {
    this.localEvmChain = localEvmChain;
    this.endpoint = `http://127.0.0.1:${opts.port}`;
  }

  public static async init(opts: LocalChainOpts) {
    const evmChain = await LocalEvmChain.init(opts.name, opts.chainId, opts.populatedAccounts);
    const localChain = new LocalChain(opts, evmChain);

    return localChain;
  }

  public get name(): string {
    return this.opts.name;
  }

  public get chainId(): number {
    return getChainIdType(this.opts.chainId);
  }

  public get underlyingChainId(): number {
    return this.opts.chainId;
  }

  public provider(): ethers.providers.WebSocketProvider {
    return new ethers.providers.WebSocketProvider(this.endpoint, {
      chainId: this.underlyingChainId,
      name: this.opts.name,
    });
  }

  public async stop() {
    await this.localEvmChain.stop();
  }
}
