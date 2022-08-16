require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import { toFixedHex } from '@webb-tools/sdk-core';
import { walletRinkeby, walletGoerli, walletArbitrum, walletMoonbase } from '../ethersGovernorWallets';
import { viewRootAcrossBridge } from './viewRootAcrossBridge';
import { VAnchor } from '@webb-tools/anchors';
import { VAnchor__factory } from '@webb-tools/contracts';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const anchorGoerli = VAnchor__factory.connect('0xE24A63Ebb690d0d6C241FDd4aA8ad90421f91D8a', walletGoerli);
}

run();
