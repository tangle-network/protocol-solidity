require('dotenv').config();
import { Anchor } from '@webb-tools/anchors'
import { getChainIdType } from '@webb-tools/utils';


export async function viewEdgeList(anchor: Anchor, edgeEvmId: number) {
  const edgeChainId = getChainIdType(edgeEvmId);
  const edgeListIndex = await anchor.contract.edgeIndex(edgeChainId);
  const edgeListEntry = await anchor.contract.edgeList(edgeListIndex);
  console.log(edgeListEntry);
  return edgeListEntry;
}

