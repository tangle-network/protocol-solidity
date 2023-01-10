// Copyright 2022 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0

import ganache from 'ganache';

export type GanacheAccounts = {
  balance: string;
  secretKey: string;
};

export async function startGanacheServer(
  port: number,
  networkId: number,
  populatedAccounts: GanacheAccounts[],
  options: any = {}
) {
  const ganacheServer = ganache.server({
    accounts: populatedAccounts,
    chainId: networkId,
    network_id: networkId,
    quiet: true,
    ...options,
  });

  await ganacheServer.listen(port);
  console.log(`Ganache Started on http://127.0.0.1:${port} ..`);

  return ganacheServer;
}
