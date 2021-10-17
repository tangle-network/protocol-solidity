require('dotenv').config();
import { ethers } from 'ethers';

import { WEBB__factory } from '../../../typechain/factories/WEBB__factory';
import { WEBBAnchor__factory } from '../../../typechain/factories/WEBBAnchor__factory';

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function run() {
  // @ts-ignore
  const WEBB = WEBB__factory.connect(process.env.WEBB, wallet.provider);
  // @ts-ignore
  const WEBBAnchor = WEBBAnchor__factory.connect(process.env.WEBBAnchor, wallet.provider);
  const root = await WEBBAnchor.getLastRoot();
  console.log(root);
}

run();
