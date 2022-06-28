require('dotenv').config();
import { ethers } from 'ethers';
import { walletHermes, walletAthena, walletDemeter } from '../ethersGovernorWallets';
import { GovernedTokenWrapper, MintableToken } from '@webb-tools/tokens';
const path = require('path');

async function run() {
  let tokenA = await MintableToken.createToken(
    'testToken',
    'TEST',
    walletHermes
  );
  console.log(tokenA.contract.address);
  let tokenB = await MintableToken.createToken(
    'testToken',
    'TEST',
    walletAthena
  );
  console.log(tokenB.contract.address);
  let tokenC = await MintableToken.createToken(
    'testToken',
    'TEST',
    walletDemeter
  );
  console.log(tokenC.contract.address);
  // let webbTokenA = await GovernedTokenWrapper.createGovernedTokenWrapper(
  //   'webb TEST token',
  //   'webbTEST',
  //   '0x0000000000000000000000000000000000000000',
  //   walletHermes.address,
  //   '1000000000000000000000',
  //   true,
  //   walletHermes
  // );
  // console.log(webbTokenA.contract.address);
  // let tx = await webbTokenA.contract.add(tokenA.contract.address, 1);
  // await tx.wait();

  // let webbTokenB = await GovernedTokenWrapper.createGovernedTokenWrapper(
  //   'webb TEST token',
  //   'webbTEST',
  //   '0x0000000000000000000000000000000000000000',
  //   walletAthena.address,
  //   '1000000000000000000000',
  //   true,
  //   walletAthena
  // );
  // console.log(webbTokenB.contract.address);
  // tx = await webbTokenB.contract.add(tokenB.contract.address, 1);
  // await tx.wait();

  // let webbTokenC = await GovernedTokenWrapper.createGovernedTokenWrapper(
  //   'webb TEST token',
  //   'webbTEST',
  //   '0x0000000000000000000000000000000000000000',
  //   walletDemeter.address,
  //   '1000000000000000000000',
  //   true,
  //   walletDemeter
  // );
  // console.log(webbTokenC.contract.address);
  // tx = await webbTokenC.contract.add(tokenC.contract.address, 1);
  // await tx.wait();
}

run();
