require('dotenv').config();
import { SignatureBridgeSide } from "@webb-tools/bridges";
import { ethers } from "ethers";
import { fetchComponentsFromFilePaths } from "../../packages/utils";
import { providerArbitrum, providerMoonbase, walletArbitrum, walletHermes } from "./ethersGovernorWallets";
import { transactWrapNative } from "./bridgeActions/transactWrapNative";

const path = require('path');

async function run() {
  // const gasArbitrumResponse = await (await providerArbitrum.getFeeData()).gasPrice;
  // console.log('arbitrum gas: ', gasArbitrumResponse);
  const gasMoonbaseResponse = await (await providerMoonbase.getFeeData()).gasPrice;
  console.log('moonbase gas: ', gasMoonbaseResponse);

  // await transactWrapNative('0xcbd945e77adb65651f503723ac322591f3435cc5', walletHermes);
}

run();
