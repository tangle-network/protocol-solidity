import { BigNumber, BigNumberish, ethers } from 'ethers';
import {
  Keypair,
  toFixedHex,
  Utxo,
  randomBN,
  CircomUtxo,
} from '@webb-tools/sdk-core';
import { hexToU8a, getChainIdType } from '@webb-tools/utils';

export class VAnchorBase {
  public static createRootsBytes(rootArray: string[]) {
    let rootsBytes = '0x';
    for (let i = 0; i < rootArray.length; i++) {
      rootsBytes += toFixedHex(rootArray[i]).substr(2);
    }
    return rootsBytes; // root byte string (32 * array.length bytes)
  }

  // Convert a hex string to a byte array
  public static hexStringToByte(str: string) {
    if (!str) {
      return new Uint8Array();
    }

    var a = [];
    for (var i = 0, len = str.length; i < len; i += 2) {
      a.push(parseInt(str.substr(i, 2), 16));
    }

    return new Uint8Array(a);
  }

  public async padUtxos(utxos: Utxo[], maxUtxos: number, signer: ethers.Signer): Promise<Utxo[]> {
    const evmId = await signer.getChainId();
    const chainId = getChainIdType(evmId);
    const randomKeypair = new Keypair();

    while (utxos.length !== 2 && utxos.length < maxUtxos) {
      utxos.push(
        await CircomUtxo.generateUtxo({
          curve: 'Bn254',
          backend: 'Circom',
          chainId: chainId.toString(),
          originChainId: chainId.toString(),
          amount: '0',
          blinding: hexToU8a(randomBN(31).toHexString()),
          keypair: randomKeypair,
        })
      );
    }
    return utxos;
  }

  public async getExtAmount(inputs: Utxo[], outputs: Utxo[], fee: BigNumberish): Promise<BigNumber> {
    return BigNumber.from(fee)
      .add(outputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
      .sub(inputs.reduce((sum, x) => sum.add(x.amount), BigNumber.from(0)))
  }

}

export default VAnchorBase;

