require('dotenv').config();
import { Anchor, AnchorDeposit } from '@webb-tools/fixed-bridge';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { bridgedWithdrawWebbToken } from './withdrawals/bridgedWithdrawWebbToken';
import { ethers } from 'ethers';
import path from 'path';

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
const providerRopsten = new ethers.providers.JsonRpcProvider(`https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletRopsten = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRopsten);

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/poseidon_bridge_6.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/6/circuit_final.zkey')
  );
  const anchorRopsten = await Anchor.connect('0x8DB24d0Df8cc4CEbF275528f7725E560F50329bf', zkComponents, walletRopsten);
  await anchorRopsten.checkKnownRoot();
  const rinkebyAnchor = await Anchor.connect('0x99285189A0DA76dce5D3Da6Cf71aD3f2b498DC88', zkComponents, walletRinkeby);
  await rinkebyAnchor.checkKnownRoot();

  const deposit: AnchorDeposit = {
    deposit: {
      chainID: BigInt('3'),
      secret: BigInt('258184269436466595295225821889154157490996666771610972208388184578865400451'),
      nullifier: BigInt('211459413344056408435458030711647996838053522484286534076361288616800339714'),
      commitment: '21065731237680224951789180651990933177268944393107388599198950690899589767409',
      nullifierHash: '1278438764990080629530056418669967532917809075480309143572694799848607086460'
    },
    index: 2,
    originChainId: 4
  };

  const merkleProof = rinkebyAnchor.tree.path(deposit.index);
  
  const event = await bridgedWithdrawWebbToken(anchorRopsten, merkleProof, deposit, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');
  console.log(event);
}

run();
