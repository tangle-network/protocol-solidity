require('dotenv').config();
import { ethers } from 'ethers';
import { providerAthena, walletHermes, walletAthena, walletRinkeby, walletGoerli } from '../ethersGovernorWallets';
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

  const anchorRinkeby = await Anchor.connect('0x12f2C4A1469B035e4459539E38ae68bC4DD5ba07', zkComponents, walletRinkeby);
  await anchorRinkeby.update();
  const anchorGoerli = await Anchor.connect('0x9c0B0e0Fb6dac561Ad4c947e6Db9abcf0f40B6Dc', zkComponents, walletGoerli);
  await anchorGoerli.update();

  console.log('num of elements in hermes: ', anchorRinkeby.tree.number_of_elements());
  console.log('root of anchor hermes: ', anchorRinkeby.tree.root());
  console.log('Hermes elements: ', anchorRinkeby.tree.elements());
  console.log('Edge list of Athena on Hermes: ');
  await viewEdgeList(anchorRinkeby, 5);
  await viewRootHistory(anchorRinkeby);

  console.log('num of elements in athena: ', anchorGoerli.tree.number_of_elements());
  console.log('root of anchor athena: ', anchorGoerli.tree.root()); 
  console.log('Athena elements: ', anchorGoerli.tree.elements());
  console.log('Edge list of Hermes on Athena: ');
  await viewEdgeList(anchorGoerli, 4);
  await viewRootHistory(anchorGoerli);
}

run();
