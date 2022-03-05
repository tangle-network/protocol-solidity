import ganache from 'ganache';
 
export async function startGanacheServer(port: number, networkId: number, mnemonic: string) {
  const ganacheServer = ganache.server({
    network_id: networkId,
    instamine: 'strict',
    chainId: networkId,
    quiet: true,
    mnemonic:
      mnemonic,
  });

  await ganacheServer.listen(port);

  return ganacheServer;
}
