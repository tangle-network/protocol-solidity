require('dotenv').config();
import { getChainIdType } from "@webb-tools/utils";
import { ethers } from "ethers";

export const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
export const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
export const chainIdTypeRinkeby = getChainIdType(4);

export const providerPolygon = new ethers.providers.JsonRpcProvider(process.env.POLYGON_KEY!);
export const walletPolygon = new ethers.Wallet(process.env.PRIVATE_KEY!, providerPolygon);
export const chainIdTypePolygon = getChainIdType(80001);

export const providerKovan = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
export const walletKovan = new ethers.Wallet(process.env.PRIVATE_KEY!, providerKovan);
export const chainIdTypeKovan = getChainIdType(42);

export const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
export const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);
export const chainIdTypeRopsten = getChainIdType(3);

export const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
export const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);
export const chainIdTypeGoerli = getChainIdType(5);

export const providerOptimism = new ethers.providers.JsonRpcProvider(process.env.OPTIMISM_KEY!);
export const walletOptimism = new ethers.Wallet(process.env.PRIVATE_KEY!, providerOptimism);
export const chainIdTypeOptimism = getChainIdType(69);

export const providerArbitrum = new ethers.providers.JsonRpcProvider(process.env.ARBITRUM_KEY!);
export const walletArbitrum = new ethers.Wallet(process.env.PRIVATE_KEY!, providerArbitrum);
export const chainIdTypeArbitrum = getChainIdType(421613);

export const providerMoonbase = new ethers.providers.JsonRpcProvider('https://moonbeam-alpha.api.onfinality.io/public');
export const walletMoonbase = new ethers.Wallet(process.env.PRIVATE_KEY!, providerMoonbase);
export const chainIdTypeMoonbase = getChainIdType(1287);

export const providerAvalanche = new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_KEY!);
export const walletAvalanche = new ethers.Wallet(process.env.PRIVATE_KEY!, providerAvalanche);
export const chainIdTypeAvalanche = getChainIdType(43113);

export const providerAurora = new ethers.providers.JsonRpcProvider(process.env.AURORA_KEY!);
export const walletAurora = new ethers.Wallet(process.env.PRIVATE_KEY!, providerAurora);
export const chainIdTypeAurora = getChainIdType(1313161555);

export const providerHarmony = new ethers.providers.JsonRpcProvider(process.env.HARMONY_KEY!);
export const walletHarmony = new ethers.Wallet(process.env.PRIVATE_KEY!, providerHarmony);
export const chainIdTypeHarmony = getChainIdType(1666700000);

export const providerAthena = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5002`);
export const walletAthena = new ethers.Wallet("0x0000000000000000000000000000000000000000000000000000000000000001", providerAthena);
export const chainIdTypeAthena = getChainIdType(5002);

export const providerHermes = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5001`);
export const walletHermes = new ethers.Wallet("0x0000000000000000000000000000000000000000000000000000000000000001", providerHermes);
export const chainIdTypeHermes = getChainIdType(5001);

export const providerDemeter = new ethers.providers.JsonRpcProvider(`http://127.0.0.1:5003`);
export const walletDemeter = new ethers.Wallet("0x0000000000000000000000000000000000000000000000000000000000000001", providerDemeter);
export const chainIdTypeDemeter = getChainIdType(5003);
