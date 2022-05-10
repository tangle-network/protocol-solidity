require('dotenv').config();
import { ethers } from 'ethers';
import { providerAthena, walletHermes, walletAthena, walletRinkeby, walletGoerli, walletOptimism } from '../ethersGovernorWallets';
import { viewEdgeList } from './viewEdgeList';
import { viewRootHistory } from './viewRootHistory';
import { Anchor } from '@webb-tools/anchors';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
import { viewRootAcrossBridge } from './viewRootAcrossBridge';
import { viewGovernor } from './viewGovernor';
const path = require('path');

async function run() { 
  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/poseidon_anchor_6.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/circuit_final.zkey')
  );

  const anchorGoerli = await Anchor.connect('0xf2f7bc0bED36d94c19C337b6E114caD2bC218819', zkComponents, walletGoerli);
  await anchorGoerli.update();
  const anchorRinkeby = await Anchor.connect('0xf2f7bc0bED36d94c19C337b6E114caD2bC218819', zkComponents, walletRinkeby);
  await anchorRinkeby.update();

  console.log('SDK: num of elements in optimism: ', anchorGoerli.tree.number_of_elements());
  console.log('SDK: root of anchor optimism: ', anchorGoerli.tree.root());
  console.log('SDK: optimism elements: ', anchorGoerli.tree.elements());
  console.log('CHAIN: Edge list of rinkeby on optimism: ');
  await viewGovernor('', walletGoerli)
  await viewEdgeList(anchorGoerli, 4);
  await viewRootHistory(anchorGoerli);

  console.log('SDK: num of elements in rinkeby: ', anchorRinkeby.tree.number_of_elements());
  console.log('SDK: root of anchor rinkeby: ', anchorRinkeby.tree.root()); 
  console.log('SDK: Rinkeby elements: ', anchorRinkeby.tree.elements());
  console.log('CHAIN: Edge list of optimism on rinkeby: ');
  await viewEdgeList(anchorRinkeby, 5);
  await viewRootHistory(anchorRinkeby);
}

run();
