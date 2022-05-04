require('dotenv').config();
import { ethers } from 'ethers';
import { Anchor } from '@webb-tools/anchors';
import { toFixedHex } from '@webb-tools/utils';

export async function viewRootAcrossBridge(merkleRootAnchor: Anchor, edgeListAnchor: Anchor) {
  const lastMerkleRoot = await merkleRootAnchor.contract.getLastRoot();
  const merkleChainId = await merkleRootAnchor.signer.getChainId();

  console.log('Latest merkle root in local tree: ', toFixedHex(merkleRootAnchor.tree.root()));
  console.log('Latest merkle root on chain: ', lastMerkleRoot);
  console.log('Latest merkle root index: ', merkleRootAnchor.tree.number_of_elements() - 1);
  const merkleRootIndex = await edgeListAnchor.contract.edgeIndex(merkleChainId);
  const edgeListEntry = await edgeListAnchor.contract.edgeList(merkleRootIndex);
  console.log('edge list entry: ', edgeListEntry)
}

