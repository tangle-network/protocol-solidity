require('dotenv').config();
import { ethers } from 'ethers';
import Anchor from '../../../lib/darkwebb/Anchor';
import AnchorHandler from '../../../lib/darkwebb/AnchorHandler';
import BridgeSide from '../../../lib/darkwebb/BridgeSide';
import { toFixedHex } from '../../../lib/darkwebb/utils'

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);

const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

async function run() { 
  const goerliBridgeSide = await BridgeSide.connect('0x626FEc5Ffa7Bf1EE8CEd7daBdE545630473E3ABb', walletGoerli);
  const rinkebyAnchor = await Anchor.connect('0x626Bd0a80a55293252d50976ec2f93CbAF0945C8', walletRinkeby);

  await rinkebyAnchor.update(9544900);
  const rinkebyLastRoot = await rinkebyAnchor.contract.getLastRoot();

  console.log('Rinkeby anchor latest root in local tree: ', toFixedHex(rinkebyAnchor.tree.get_root()));
  console.log('Rinkeby anchor latest root on chain: ', rinkebyLastRoot);

  const goerliAnchor = await Anchor.connect('0x67fB9B056a991Bc9a37DB4355cF5cc2C4Aa9CB2D', walletGoerli);
  const goerliHandler = await AnchorHandler.connect('0x8d2e2Aa87307E99151b970759D38ca24e6Cf85e8', walletGoerli);

  await goerliBridgeSide.setAnchorHandler(goerliHandler);
  await goerliBridgeSide.voteProposal(rinkebyAnchor, goerliAnchor);
  await goerliBridgeSide.executeProposal(rinkebyAnchor, goerliAnchor);
}

run();
