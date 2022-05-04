require('dotenv').config();
import { getTokenBalance } from './getTokenBalance'
import { ethers } from 'ethers';
import { providerAthena, walletHermes, walletAthena } from '../ethersGovernorWallets';
import { viewEdgeList } from '../viewActions/viewEdgeList';
import { Anchor } from '@webb-tools/anchors';
import { fetchComponentsFromFilePaths } from '@webb-tools/utils';
const path = require('path');

async function run() { 
  const zkComponents = await fetchComponentsFromFilePaths(
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/poseidon_bridge_2.wasm'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/witness_calculator.js'),
    path.resolve(__dirname, '../../../protocol-solidity-fixtures/fixtures/bridge/2/circuit_final.zkey')
  );

  const anchorHermes = await Anchor.connect('0x510C6297cC30A058F41eb4AF1BFC9953EaD8b577', zkComponents, walletHermes);
  await anchorHermes.update();
  const anchorAthena = await Anchor.connect('0x7758F98C1c487E5653795470eEab6C4698bE541b', zkComponents, walletAthena);
  await anchorAthena.update();

  console.log('num of elements in hermes: ', anchorHermes.tree.number_of_elements());
  console.log('root of anchor hermes: ', anchorHermes.tree.root());
  console.log('Hermes elements: ', anchorHermes.tree.elements());
  console.log('Edge list of Athena on Hermes: ');
  await viewEdgeList(anchorHermes, 5002);

  console.log('num of elements in athena: ', anchorAthena.tree.number_of_elements());
  console.log('root of anchor athena: ', anchorAthena.tree.root());
  console.log('Athena elements: ', anchorAthena.tree.elements());
  console.log('Edge list of Hermes on Athena: ');
  await viewEdgeList(anchorAthena, 5001);
}

run();
