require('dotenv').config();
import { Anchor } from '@webb-tools/fixed-bridge';

export async function viewEdgeList(anchor: Anchor, edgeChainId: number) {
  const edgeListIndex = await anchor.contract.edgeIndex(edgeChainId);
  const edgeListEntry = await anchor.contract.edgeList(edgeListIndex);
  console.log(edgeListEntry);
  return edgeListEntry;
}

