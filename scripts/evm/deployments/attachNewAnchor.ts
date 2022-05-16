require('dotenv').config();
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { SignatureBridge, SignatureBridgeSide } from "@webb-tools/bridges";
import { ethers } from "ethers";
import { Anchor, AnchorHandler } from "@webb-tools/anchors";
import { 
  chainIdTypeArbitrum,
  chainIdTypeGoerli,
  chainIdTypeOptimism,
  chainIdTypePolygon,
  chainIdTypeRopsten,
  chainIdTypeRinkeby,
  walletArbitrum,
  walletGoerli,
  walletOptimism,
  walletPolygon,
  walletRinkeby,
  walletRopsten
} from '../ethersGovernorWallets';

import path from "path";
import { GovernedTokenWrapper } from '@webb-tools/tokens';

async function main() {
  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/poseidon_anchor_6.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/circuit_final.zkey')
  );
  
  const getWalletByChainIdType = (chainIdType) => {
    switch (chainIdType) {
      case chainIdTypeRopsten:
        return walletRopsten;
      case chainIdTypeRinkeby:
        return walletRinkeby;
      case chainIdTypeGoerli:
        return walletGoerli;
      case chainIdTypePolygon:
        return walletPolygon;
      case chainIdTypeOptimism:
        return walletOptimism;
      case chainIdTypeArbitrum:
        return walletArbitrum;
    }
  }

  // Mapping of chainId to the desired webbWrapped token.
  const anchorTokens: Record<number, string> = {
    [chainIdTypeRopsten]: '0xb3532c9faae4a65e63c912734512b772a102e2e9',
    [chainIdTypeRinkeby]: '0xb3532c9faae4a65e63c912734512b772a102e2e9',
    [chainIdTypeGoerli]: '0xb3532c9faae4a65e63c912734512b772a102e2e9',
    [chainIdTypePolygon]: '0xb3532c9faae4a65e63c912734512b772a102e2e9',
    [chainIdTypeOptimism]: '0x04392b225e273266d867055fe7a075d488d8e05e',
    [chainIdTypeArbitrum]: '0xb30b0bf0cd3a73f97679c962424d4ef8dfe8e13d',
  };
  const bridgeSideAddresses: Record<number, string> = {
    [chainIdTypeRopsten]: '0xc11a9f2f42cedf687ec292231698a91dd6928d9a',
    [chainIdTypeRinkeby]: '0xc11a9f2f42cedf687ec292231698a91dd6928d9a',
    [chainIdTypeGoerli]: '0xc11a9f2f42cedf687ec292231698a91dd6928d9a',
    [chainIdTypePolygon]: '0xc11a9f2f42cedf687ec292231698a91dd6928d9a',
    [chainIdTypeOptimism]: '0xfbda54512c6aa9a6bc790f11585aff170d393ee9',
    [chainIdTypeArbitrum]: '0xffd2174417a81ea7ac8bea1b8e64f233eeb63084',
  };
  const anchorHashers: Record<number, string> = {
    [chainIdTypeRopsten]: '0x36243aD9e59566b7569CF6231F0767017Fcb031A',
    [chainIdTypeRinkeby]: '0x36243aD9e59566b7569CF6231F0767017Fcb031A',
    [chainIdTypeGoerli]: '0x36243aD9e59566b7569CF6231F0767017Fcb031A',
    [chainIdTypePolygon]: '0x36243aD9e59566b7569CF6231F0767017Fcb031A',
    [chainIdTypeOptimism]: '0xDd302F06295F885aec0de51Dd4fAA4d3FF5df881',
    [chainIdTypeArbitrum]: '0x09B81ABc1AA83B5BA6B721183405697ad44BD65b',
  };
  const anchorHandlers: Record<number, string> = {
    [chainIdTypeRopsten]: '0xa049Dec8FF867307733F4F7B766848C3FD69A67B',
    [chainIdTypeRinkeby]: '0xa049Dec8FF867307733F4F7B766848C3FD69A67B',
    [chainIdTypeGoerli]: '0xa049Dec8FF867307733F4F7B766848C3FD69A67B',
    [chainIdTypePolygon]: '0xa049Dec8FF867307733F4F7B766848C3FD69A67B',
    [chainIdTypeOptimism]: '0x0c5F4951f42EeC082bD1356B9b41928B4f0e7542',
    [chainIdTypeArbitrum]: '0x36243aD9e59566b7569CF6231F0767017Fcb031A',
  };
  const anchorVerifiers: Record<number, string> = {
    // [chainIdTypeRopsten]: '0x93447Fd245B940934B3133c7B6Ed89d98faAf8d7',
    // [chainIdTypeRinkeby]: '0x93447Fd245B940934B3133c7B6Ed89d98faAf8d7',
    // [chainIdTypeGoerli]: '0x93447Fd245B940934B3133c7B6Ed89d98faAf8d7',
    // [chainIdTypePolygon]: '0x93447Fd245B940934B3133c7B6Ed89d98faAf8d7',
    // [chainIdTypeOptimism]: '0xF70819727C883ea906FA48AD480F07A6b035B494',
    [chainIdTypeArbitrum]: '0xe075648d44443d932F86Ed8f2bAe928590B2365f',
  };
  const gasLimits: Record<number, string> = {
    [chainIdTypeRopsten]: '0x5B8D80',
    [chainIdTypeRinkeby]: '0x5B8D80',
    [chainIdTypeGoerli]: '0x5B8D80',
    [chainIdTypePolygon]: '0x5B8D80',
    [chainIdTypeOptimism]: '0x5B8D80',
    [chainIdTypeArbitrum]: '0x99999999',
  };

  for (let chainIdType of Object.keys(anchorVerifiers)) {
    const governor = getWalletByChainIdType(Number(chainIdType))

    const gasPrice = (await governor.getFeeData()).gasPrice;

    const gasLimit = gasPrice.mul(2);

    const newAnchor = await Anchor.createAnchor(
      anchorVerifiers[chainIdType],
      anchorHashers[chainIdType],
      '10000000000000000',
      30,
      anchorTokens[chainIdType],
      anchorHandlers[chainIdType],
      5,
      zkComponents,
      governor,
      { gasLimit: gasLimit }
    );

    const bridgeSide = await SignatureBridgeSide.connect(bridgeSideAddresses[chainIdType], governor, governor);
    const anchorHandler = await AnchorHandler.connect(anchorHandlers[chainIdType], governor);
    
    bridgeSide.setAnchorHandler(anchorHandler);

    await SignatureBridge.setPermissions(bridgeSide, [newAnchor], { gasLimit: gasLimits[chainIdType] });

    const tokenInstance = await GovernedTokenWrapper.connect(anchorTokens[chainIdType], governor);

    // grant minting rights to the anchor
    await tokenInstance.grantMinterRole(newAnchor.getAddress()); 

    console.log(`new anchor: ${newAnchor.getAddress()} on chain ${chainIdType}`)
  }
}

main();