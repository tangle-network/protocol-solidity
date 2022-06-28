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
import { GovernedTokenWrapper__factory } from "@webb-tools/contracts";

async function main() {
  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/poseidon_anchor_6.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/circuit_final.zkey')
  );
  
  const getWalletByChainIdType = (chainIdType: number) => {
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
    // [chainIdTypePolygon]: '0xb3532c9faae4a65e63c912734512b772a102e2e9',
    [chainIdTypeOptimism]: '0x04392b225e273266d867055fe7a075d488d8e05e',
    [chainIdTypeArbitrum]: '0xb30b0bf0cd3a73f97679c962424d4ef8dfe8e13d',
  };
  const gasLimits: Record<number, string> = {
    [chainIdTypeRopsten]: '0x5B8D80',
    [chainIdTypeRinkeby]: '0x5B8D80',
    [chainIdTypeGoerli]: '0x5B8D80',
    [chainIdTypePolygon]: '0x5B8D80',
    [chainIdTypeOptimism]: '0x5B8D80',
    [chainIdTypeArbitrum]: '0x99999999',
  };

  for (let chainIdType of Object.keys(anchorTokens)) {

    const tokenContractInstance = GovernedTokenWrapper__factory.connect(anchorTokens[chainIdType], getWalletByChainIdType(Number(chainIdType)))

    console.log(tokenContractInstance.signer);

    let tx = await tokenContractInstance.setNativeAllowed(true, { gasLimit: gasLimits[chainIdType] });
    await tx.wait();

    console.log(`Allow the use of native wrapping on: ${tokenContractInstance.address} on chain ${chainIdType}`)
  }
}

main();
