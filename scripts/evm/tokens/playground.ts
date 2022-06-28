require('dotenv').config();
import { getTokenBalance } from './getTokenBalance'
import { ethers } from 'ethers';
import { walletHermes, walletAthena, providerHermes } from '../ethersGovernorWallets';
import { viewEdgeList } from '../viewActions/viewEdgeList';
import { Anchor } from '@webb-tools/anchors';
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { viewTokensInWrapper } from './viewTokensInWrapper';
import { mintTokensToAddress } from './mintTokensToAddress';
const path = require('path');

async function run() { 
  // const token = await MintableToken.tokenFromAddress('0x4ddcaefad4cd01f6de911c33777100b1c530a85e', walletHermes);
  // await token.mintTokens('0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF', '100000000000000000000');

  // await viewTokensInWrapper('0x510C6297cC30A058F41eb4AF1BFC9953EaD8b577', providerHermes);
  await mintTokensToAddress('0xF2E246BB76DF876Cef8b38ae84130F4F55De395b', '0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF', walletHermes);
}

run();
