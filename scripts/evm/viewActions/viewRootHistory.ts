require('dotenv').config();
import { Anchor } from '@webb-tools/anchors'

export async function viewRootHistory(anchor: Anchor) {
  const numOfRoots = await anchor.contract.nextIndex();

  for (let i=0; i<numOfRoots; i++) {
    const root = await anchor.contract.roots(i);
    console.log(`root at ${i}: ${root}`);
  }
}
