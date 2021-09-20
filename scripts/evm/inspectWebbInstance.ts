require('dotenv').config();
const helpers = require('../../test/helpers');
import { ethers } from 'ethers';

import { WEBB__factory } from '../../typechain/factories/WEBB__factory';
import { WEBBAnchor2__factory } from '../../typechain/factories/WEBBAnchor2__factory';

let provider = new ethers.providers.JsonRpcProvider(`${process.env.ENDPOINT}`);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

async function run() {
  const denomination = ethers.BigNumber.from('100000000000000000');
  // WARNING: ENSURE THIS MATCHES CIRCUIT HEIGHT
  const merkleTreeHeight = 30;

  const chainId = await wallet.getChainId();
  // @ts-ignore
  const WEBB = WEBB__factory.connect(process.env.WEBB, wallet.provider);
  // @ts-ignore
  const WEBBAnchor = WEBBAnchor2__factory.connect(process.env.WEBBAnchor, wallet.provider);
  console.log(process.env.WEBBAnchor);
  const root = await WEBBAnchor.getLastRoot();
  console.log(root);
}

run();
