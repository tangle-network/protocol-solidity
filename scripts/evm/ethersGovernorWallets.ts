require("dotenv").config();
import { getChainIdType } from "@webb-tools/utils";
import { ethers } from "ethers";

export const providerPolygon = new ethers.providers.JsonRpcProvider(
  process.env.POLYGON_RPC!
);
export const walletPolygon = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerPolygon
);
export const chainIdTypePolygon = getChainIdType(80001);

export const providerGoerli = new ethers.providers.JsonRpcProvider(
  process.env.GOERLI_RPC
);
export const walletGoerli = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerGoerli
);
export const chainIdTypeGoerli = getChainIdType(5);

export const providerSepolia = new ethers.providers.JsonRpcProvider(
  process.env.SEPOLIA_RPC
);
export const walletSepolia = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerSepolia
);
export const chainIdTypeSepolia = getChainIdType(11155111);

export const providerOptimism = new ethers.providers.JsonRpcProvider(
  process.env.OPTIMISM_RPC!
);
export const walletOptimism = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerOptimism
);
export const chainIdTypeOptimism = getChainIdType(420);

export const providerArbitrum = new ethers.providers.JsonRpcProvider(
  process.env.ARBITRUM_RPC!
);
export const walletArbitrum = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerArbitrum
);
export const chainIdTypeArbitrum = getChainIdType(421613);

export const providerMoonbase = new ethers.providers.JsonRpcProvider(
  process.env.MOONBEAM_RPC
);
export const walletMoonbase = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerMoonbase
);
export const chainIdTypeMoonbase = getChainIdType(1287);

export const providerAvalanche = new ethers.providers.JsonRpcProvider(
  process.env.AVALANCHE_RPC!
);
export const walletAvalanche = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerAvalanche
);
export const chainIdTypeAvalanche = getChainIdType(43113);

export const providerAurora = new ethers.providers.JsonRpcProvider(
  process.env.AURORA_RPC!
);
export const walletAurora = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerAurora
);
export const chainIdTypeAurora = getChainIdType(1313161555);

export const providerHarmony = new ethers.providers.JsonRpcProvider(
  process.env.HARMONY_RPC!
);
export const walletHarmony = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerHarmony
);

export const chainIdTypeBinance = getChainIdType(97);
export const providerBinance = new ethers.providers.JsonRpcProvider(
  process.env.BINANCE_RPC!
);
export const walletBinance = new ethers.Wallet(
  process.env.PRIVATE_KEY!,
  providerBinance
);
export const chainIdTypeHarmony = getChainIdType(1666700000);

export const providerAthena = new ethers.providers.JsonRpcProvider(
  `http://127.0.0.1:5002`
);
export const walletAthena = new ethers.Wallet(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  providerAthena
);
export const chainIdTypeAthena = getChainIdType(5002);

export const providerHermes = new ethers.providers.JsonRpcProvider(
  `http://127.0.0.1:5001`
);
export const walletHermes = new ethers.Wallet(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  providerHermes
);
export const chainIdTypeHermes = getChainIdType(5001);

export const providerDemeter = new ethers.providers.JsonRpcProvider(
  `http://127.0.0.1:5003`
);
export const walletDemeter = new ethers.Wallet(
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  providerDemeter
);
export const chainIdTypeDemeter = getChainIdType(5003);
