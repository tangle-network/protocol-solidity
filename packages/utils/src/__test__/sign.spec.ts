import { signMessage } from '../utils';
import { Wallet } from 'ethers';

describe.only('signMessage constructor tests', () => {
  it('Should sign a message without throwing an error', async function () {
    const testPrivateKey = '0x0000000000000000000000000000000000000000000000000000000000000001';
    const wallet = new Wallet(testPrivateKey);
    // Signing this messages trigger an error
    // that forces the code to execute the fallback in the catch block.
    // which is what we want to test.
    const message =
      '0x02f87684e78946d5148459682f0084648944a482520894f39fd6e51aad88f6f4ce6ab8827279cfffb92266880d96f6e53a4cdfd580c080a0ca72e1f12c44f0aa05c27993b9f03ac8f071497c4fb3f6f7bc68d21261b5f858a0552bfa27994327f777aa2ee496b3dd6a26ed6d980ce2fce849cdb6b2c08fe950';
    signMessage(wallet, message);
  });
});
