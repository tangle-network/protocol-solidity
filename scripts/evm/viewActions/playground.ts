require('dotenv').config();
import { ethers } from 'ethers';
import { providerAthena, walletHermes, walletAthena, walletRinkeby, walletGoerli, walletOptimism } from '../ethersGovernorWallets';
import { viewEdgeList } from './viewEdgeList';
import { viewRootHistory } from './viewRootHistory';
import { Anchor } from '@webb-tools/anchors';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
const path = require('path');

async function run() { 
  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/poseidon_anchor_6.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/anchor/6/circuit_final.zkey')
  );

  const anchorOptimism = await Anchor.connect('0xf2f7bc0bED36d94c19C337b6E114caD2bC218819', zkComponents, walletOptimism);
  await anchorOptimism.update();
  const anchorGoerli = await Anchor.connect('0x3e8B7e3B498eA9375172f4d4bd181C21f18A4381', zkComponents, walletGoerli);
  await anchorGoerli.update();

  console.log('num of elements in hermes: ', anchorOptimism.tree.number_of_elements());
  console.log('root of anchor hermes: ', anchorOptimism.tree.root());
  console.log('Hermes elements: ', anchorOptimism.tree.elements());
  console.log('Edge list of Athena on Hermes: ');
  await viewEdgeList(anchorOptimism, 5);
  await viewRootHistory(anchorOptimism);

  console.log('num of elements in athena: ', anchorGoerli.tree.number_of_elements());
  console.log('root of anchor athena: ', anchorGoerli.tree.root()); 
  console.log('Athena elements: ', anchorGoerli.tree.elements());
  console.log('Edge list of Hermes on Athena: ');
  await viewEdgeList(anchorGoerli, 69);
  await viewRootHistory(anchorGoerli);
}

run();
