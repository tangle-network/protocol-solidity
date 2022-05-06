require('dotenv').config();

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
import { GovernedTokenWrapper } from '@webb-tools/tokens';

async function main() {

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

  const anchorAddresses: Record<number, string> = {
    [chainIdTypeRopsten]: '0x12f2C4A1469B035e4459539E38ae68bC4DD5ba07',
    [chainIdTypeRinkeby]: '0x12f2C4A1469B035e4459539E38ae68bC4DD5ba07',
    [chainIdTypeGoerli]: '0x9c0B0e0Fb6dac561Ad4c947e6Db9abcf0f40B6Dc',
    [chainIdTypePolygon]: '0x84EbBB5F7884C6d71a45C298B1CEaed940E2334E',
    [chainIdTypeOptimism]: '0x9c0B0e0Fb6dac561Ad4c947e6Db9abcf0f40B6Dc',
    [chainIdTypeArbitrum]: '0x3dd2457c44e79aF992120E817FF4BE22B023e22a',
  };

  for (let chainIdType of Object.keys(anchorAddresses)) {

    const governor = getWalletByChainIdType(Number(chainIdType));

    const tokenInstance = await GovernedTokenWrapper.connect(anchorTokens[chainIdType], governor);

    // grant minting rights to the anchor
    await tokenInstance.grantMinterRole(anchorAddresses[chainIdType]); 
  }
}

main();