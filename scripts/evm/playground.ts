require('dotenv').config();
import { SignatureBridgeSide } from "@webb-tools/bridges";
import { Anchor } from "@webb-tools/anchors";
import { ethers } from "ethers";
import { fetchComponentsFromFilePaths } from "../../packages/utils";
import { providerArbitrum, walletArbitrum } from "./ethersGovernorWallets";

const path = require('path');

async function run() {

  const gasArbitrumResponse = await (await providerArbitrum.getFeeData()).gasPrice;

}

run();

