import { VBridge } from "@webb-tools/vbridge";
import { FungibleTokenWrapper } from "@webb-tools/tokens";
import { fetchComponentsFromFilePaths } from "@webb-tools/utils";
import { DeployerConfig } from "@webb-tools/interfaces";
import path from "path";
import { ethers } from "ethers";
import {
  chainIdTypeGoerli,
  chainIdTypeOptimism,
  chainIdTypeArbitrum,
  chainIdTypePolygon,
  chainIdTypeMoonbase,
  walletGoerli,
  walletOptimism,
  walletArbitrum,
  walletPolygon,
  walletMoonbase,
  chainIdTypeHermes,
  chainIdTypeAthena,
  chainIdTypeDemeter,
  walletHermes,
  walletAthena,
  walletDemeter,
  chainIdTypeSepolia,
  walletSepolia,
} from "../ethersGovernorWallets";

async function deploySignatureVBridge(
  tokens: Record<number, string[]>,
  deployers: DeployerConfig
): Promise<VBridge> {
  let assetRecord: Record<number, string[]> = {};
  let chainIdsArray: number[] = [];
  let existingWebbTokens = new Map<number, FungibleTokenWrapper>();
  let governorConfig: Record<number, string> = {};

  for (const chainIdType of Object.keys(deployers)) {
    assetRecord[chainIdType] = tokens[chainIdType];
    chainIdsArray.push(Number(chainIdType));
    governorConfig[Number(chainIdType)] = await deployers[
      chainIdType
    ].getAddress();
    existingWebbTokens[chainIdType] = null;
    console.log(tokens[chainIdType]);
  }

  const bridgeInput = {
    vAnchorInputs: {
      asset: assetRecord,
    },
    chainIDs: chainIdsArray,
    webbTokens: existingWebbTokens,
  };

  console.log(bridgeInput);

  const zkComponentsSmall = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `../../../solidity-fixtures/solidity-fixtures/vanchor_2/8/poseidon_vanchor_2_8.wasm`
    ),
    path.resolve(
      __dirname,
      `../../../solidity-fixtures/solidity-fixtures/vanchor_2/8/witness_calculator.cjs`
    ),
    path.resolve(
      __dirname,
      `../../../solidity-fixtures/solidity-fixtures/vanchor_2/8/circuit_final.zkey`
    )
  );
  const zkComponentsLarge = await fetchComponentsFromFilePaths(
    path.resolve(
      __dirname,
      `../../../solidity-fixtures/solidity-fixtures/vanchor_16/8/poseidon_vanchor_16_8.wasm`
    ),
    path.resolve(
      __dirname,
      `../../../solidity-fixtures/solidity-fixtures/vanchor_16/8/witness_calculator.cjs`
    ),
    path.resolve(
      __dirname,
      `../../../solidity-fixtures/solidity-fixtures/vanchor_16/8/circuit_final.zkey`
    )
  );

  console.log(governorConfig);

  return VBridge.deployVariableAnchorBridge(
    bridgeInput,
    deployers,
    governorConfig,
    zkComponentsSmall,
    zkComponentsLarge
  );
}

async function run() {
  const deployers: DeployerConfig = {
    [chainIdTypeGoerli]: walletGoerli,
    [chainIdTypeSepolia]: walletSepolia,
    [chainIdTypeOptimism]: walletOptimism,
    [chainIdTypePolygon]: walletPolygon,
    [chainIdTypeMoonbase]: walletMoonbase,
    [chainIdTypeArbitrum]: walletArbitrum,
    // [chainIdTypeHermes]: walletHermes,
    // [chainIdTypeAthena]: walletAthena,
    // [chainIdTypeDemeter]: walletDemeter
  };

  const tokens: Record<number, string[]> = {
    [chainIdTypeGoerli]: ["0", "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"],
    [chainIdTypeSepolia]: ["0", "0xeD43f81C17976372Fcb5786Dd214572e7dbB92c7"],
    [chainIdTypeOptimism]: ["0", "0x4200000000000000000000000000000000000006"],
    [chainIdTypePolygon]: ["0x9c3C9283D3e44854697Cd22D3Faa240Cfb032889"],
    [chainIdTypeMoonbase]: ["0xD909178CC99d318e4D46e7E66a972955859670E1"],
    [chainIdTypeArbitrum]: ["0", "0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3"],
    // [chainIdTypeHermes]: ['0'],
    // [chainIdTypeAthena]: ['0'],
    // [chainIdTypeDemeter]: ['0']
  };

  const vbridge = await deploySignatureVBridge(tokens, deployers);

  // print out all the info for the addresses
  const bridgeConfig = await vbridge.exportConfig();

  for (const anchor of Array.from(bridgeConfig.vAnchors.values())) {
    const chainId = await anchor.signer.getChainId();
    console.log(
      `Anchor ${anchor.contract.address.toLowerCase()} for chain ${chainId}`
    );
  }

  for (const bridgeSide of Array.from(bridgeConfig.vBridgeSides.values())) {
    const chainId = await bridgeSide.admin.getChainId();
    console.log(
      `BridgeSide ${bridgeSide.contract.address.toLowerCase()} for chain ${chainId}`
    );
  }

  for (const webbToken of Array.from(
    bridgeConfig.webbTokenAddresses.entries()
  )) {
    console.log(
      `webbToken entry: ${webbToken[0]} + ${webbToken[1].toLowerCase()}`
    );
  }
}

run();
