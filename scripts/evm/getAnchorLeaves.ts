import { ethers } from "ethers";

require("dotenv").config({ path: '../../../.env' });
import { AnchorBase2__factory } from '../../typechain/factories/AnchorBase2__factory';

export async function getAnchorLeaves(contractAddress: string, passedProvider: ethers.providers.Provider): Promise<string[]> {
  // Query the blockchain for all deposits that have happened
  const anchorInstance = AnchorBase2__factory.connect(contractAddress, passedProvider);

  const depositFilterResult = await anchorInstance.filters.Deposit();
  let startingBlock = 9100000;
  const currentBlock = await passedProvider.getBlockNumber();

  let logs: ethers.Event[] = [];

  const step = 20;
  try {
    logs = await anchorInstance.queryFilter(
      depositFilterResult,
      startingBlock,
      currentBlock,
    );
  } catch (e) {

    // If there is a timeout, query the logs in block increments.
    if (e.code == -32603) {
      for (let i = startingBlock; i < currentBlock; i += step) {
        const nextLogs = await anchorInstance.queryFilter(
          depositFilterResult,
          i,
          currentBlock - i > step ? i + step : currentBlock,
        );

        logs = [...logs, ...nextLogs];
      }
    } else {
      throw e;
    }
  }

  // Decode the logs for deposit events
  const decodedEvents = await logs.map(log => {
    return anchorInstance.interface.parseLog(log);
  })

  const leaves = decodedEvents
    .sort((a, b) => a.args.leafIndex - b.args.leafIndex) // Sort events in chronological order
    .map(e => e.args.commitment);

  return leaves;
}

