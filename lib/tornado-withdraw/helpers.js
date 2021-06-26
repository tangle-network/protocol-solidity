// This module is used only for tests
export function send(method, params = []) {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef
    web3.currentProvider.send({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }, (err, res) => {
      return err ? reject(err) : resolve(res)
    })
  })
}

export const takeSnapshot = async () => {
  return await send('evm_snapshot')
}

export const traceTransaction = async (tx) => {
  return await send('debug_traceTransaction', [tx, {}])
}

export const revertSnapshot = async (id) => {
  await send('evm_revert', [id])
}

export const mineBlock = async (timestamp) => {
  await send('evm_mine', [timestamp])
}

export const increaseTime = async (seconds) => {
  await send('evm_increaseTime', [seconds])
}

export const minerStop = async () => {
  await send('miner_stop', [])
}

export const minerStart = async () => {
  await send('miner_start', [])
}
