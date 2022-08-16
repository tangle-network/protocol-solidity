require('dotenv').config();
import { ethers } from 'ethers';
import { VAnchor } from '@webb-tools/contracts';

export async function viewRootAcrossBridge(merkleRootAnchor: VAnchor, edgeListAnchor: VAnchor) {
  const lastMerkleRoot = await merkleRootAnchor.getLastRoot();
  const merkleChainId = await merkleRootAnchor.signer.getChainId();

  console.log('Latest merkle root on chain: ', lastMerkleRoot);
  const merkleRootIndex = await edgeListAnchor.edgeIndex(merkleChainId);
  const edgeListEntry = await edgeListAnchor.edgeList(merkleRootIndex);
  console.log('edge list entry: ', edgeListEntry);
}

