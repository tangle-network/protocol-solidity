require('dotenv').config();
const path = require('path');
import { ethers } from 'ethers';
import Anchor from '../../lib/fixed-bridge/Anchor';
import { bridgedWithdrawErc20Token } from './withdrawals/bridgedWithdrawErc20Token';
import { depositAndBridgedWithdraw } from './bridgeActions/depositAndBridgedWithdraw';
import { fetchComponentsFromFilePaths } from '../../lib/utils';

const providerRinkeby = new ethers.providers.JsonRpcProvider(`https://rinkeby.infura.io/v3/fff68ca474dd4764a8d54dd14fa5519e`);
const walletRinkeby = new ethers.Wallet(process.env.PRIVATE_KEY!, providerRinkeby);
const providerKovan = new ethers.providers.JsonRpcProvider(`https://kovan.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletKovan = new ethers.Wallet(process.env.PRIVATE_KEY!, providerKovan);
// const providerHarmonyTestnet0 = new ethers.providers.JsonRpcProvider(`https://api.s0.b.hmny.io`);
// const walletHarmonyTestnet0 = new ethers.Wallet(process.env.PRIVATE_KEY!, providerHarmonyTestnet0);
const providerGoerli = new ethers.providers.JsonRpcProvider(`https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`);
const walletGoerli = new ethers.Wallet(process.env.PRIVATE_KEY!, providerGoerli);

// rinkeby handler:  0xDcb8f44aE2B7FcC3A517444820011C14A53B4fa1
// harmony handler:  0x011e55803AE2aDF158a6F4be28e2E4ca35646362

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {

  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
    path.resolve(__dirname, '../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
  );

  // const mintableToken = await GovernedTokenWrapper.connect('0xD81F2Fdad6ef7Dc5951de7724C0aaCF097c39A27', walletRinkeby);

  // await mintableToken.contract.mint('0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E', '1000000000000000000000000');

  // const anchorHandler = await AnchorHandler.connect('0x011e55803AE2aDF158a6F4be28e2E4ca35646362', walletHarmonyTestnet0);
  // const tokenBalance = await getTokenBalance('0xD81F2Fdad6ef7Dc5951de7724C0aaCF097c39A27', '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E', providerRinkeby);
  // console.log(tokenBalance);
  // const bridgeSide = await BridgeSide.connect('0xC349c02095328e77f086A6425cFd644CfCC49852', walletHarmonyTestnet0);
  // await bridgeSide.setAnchorHandler(anchorHandler);
  // const anchorRinkeby = await Anchor.connect('0x585C837947Db546Aeb6FfEC1676Ef77B589aC06f', walletRinkeby);
  // await anchorRinkeby.update(9606420);

  // await bridgeSide.voteProposal(anchorRinkeby, anchor);
  // await bridgeSide.executeProposal(anchorRinkeby, anchor);


  // const anchorRinkeby = await Anchor.connect('0x585C837947Db546Aeb6FfEC1676Ef77B589aC06f', walletRinkeby);
  // await anchorRinkeby.update(9606420);
  // const deposit = await depositErc20TokenAnchor(anchorRinkeby, '0x2dda9D44078cc48FF6B91170C3C853104B026573', 1666700000, walletRinkeby);

  // await sleep(150000);
  // const proof = anchorRinkeby.tree.path(deposit.index);
  
  // const anchorHarmony = await Anchor.connect('0x829B0e33F9FC6EAadE34784cA3589F9d7035F93B', walletHarmonyTestnet0);
  // await anchorHarmony.update(17287173);
  // const withdraw = await bridgedWithdrawErc20Token(anchorHarmony, proof, deposit, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');
  // console.log('withdraw: ', withdraw);


  // const anchorHarmony = await Anchor.connect('0x30a9e294b1fc166194d2d1af936cddff0e86a47b', walletHarmonyTestnet0);
  // await anchorHarmony.update(17000000);

  // const anchorRinkeby = await Anchor.connect('0x6244cf3d15ae8d9f973f080af561b99c501e5e9d', walletRinkeby);
  // await anchorRinkeby.update(9569482);

  // depositAndBridgedWithdraw(anchorHarmony, anchorRinkeby, walletHarmonyTestnet0, walletRinkeby, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');
  // depositAndBridgedWithdraw(anchorRinkeby, anchorHarmony, walletRinkeby, walletHarmonyTestnet0, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');


  const anchorGoerli = await Anchor.connect('0xD24Eea4f4e17f7a708b2b156D3B90C921659BE80', zkComponents, walletGoerli);
  await anchorGoerli.update(5825165);

  const anchorRinkeby = await Anchor.connect('0x8431fDec940555becED3f4C04374c1D60b4ac07e', zkComponents, walletRinkeby);
  await anchorRinkeby.update(9617980);

  await depositAndBridgedWithdraw(anchorGoerli, anchorRinkeby, walletGoerli, walletRinkeby, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');
  // await depositAndBridgedWithdraw(anchorRinkeby, anchorGoerli, walletRinkeby, walletGoerli, '0x7Bb1Af8D06495E85DDC1e0c49111C9E0Ab50266E');
}

run();

