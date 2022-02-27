import { PoseidonHasher, toFixedHex } from "../../packages/utils/src";
import { expect } from "chai";

describe('Utils tests', () => {

  it.only('PoseidonHasher3 should hash correctly', async () => {
    const hasher = new PoseidonHasher();
    const hash = hasher.hash3([
      Number('0x010000001389'),
      '0x00477813f91a08f1e59866d3889c9b60ec551a3994a71ed7c0edc494cc4179ab',
      '0x00c334244498169c8c7f3427bb45a86f4193337e442cc2963bf042413fbfaa34'
    ]);

    expect(toFixedHex(hash)).equals('0x2e32c161d2bb624721fb64fec6ac48aeeb9072028609099013a086fe9050466f', 'unexpected hash');
  })

})
