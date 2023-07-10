import { signMessage } from '../utils';
import { BigNumber, Wallet } from 'ethers';

describe.only('signMessage constructor tests', () => {
  it('Should sign a message without throwing an error', async function() {
    const testPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const wallet = new Wallet(testPrivateKey);
    const message = BigNumber.from(
      '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
    ).toHexString();
    signMessage(wallet, message);
  });
});
