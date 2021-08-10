const EIP712 = require('../helpers/EIP712');
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const Helpers = require('../helpers');
const assert = require('assert');
const CompToken = artifacts.require('CompToken');

contract('Comp-like Token', (accounts) => {
  const name = 'Webb';
  const symbol = 'WEBB';
  const version = '1';
  let root, a1, a2, acc, chainId;
  let comp;

  beforeEach(async () => {
    root = accounts[0];
    a1 = accounts[1];
    a2 = accounts[2];
    acc = accounts.slice(3);
    chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    comp = await CompToken.new(name, symbol);
  });

  describe('metadata', () => {
    it.only('has given name', async () => {
      assert.strictEqual(await comp.name(), name);
    });

    it.only('has given symbol', async () => {
      assert.strictEqual(await comp.symbol(), symbol);
    });
  });

  describe('balanceOf', () => {
    it.only('grants nothing to initial account', async () => {
      assert.strictEqual((await comp.balanceOf(root)).toString(), '0');
    });
  });

  describe('delegateBySig', () => {
    const TypedDataUtils = require('ethers-eip712').TypedDataUtils;
    const Domain = (comp) => ({ name, version, chainId, verifyingContract: comp.address });
    const Types = {
      Delegation: [
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' }
      ]
    };

    it.only('reverts if the signatory is invalid', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      await TruffleAssert.reverts(
        comp.delegateBySig(delegatee, nonce, expiry, 0, '0xbad', '0xbad'),
        'Comp::delegateBySig: invalid signature',
      );
    });

    it.only('reverts if the nonce is bad ', async () => {
      const signers = await hre.ethers.getSigners()
      const delegatee = root, nonce = 1, expiry = 0;
      const TypedData = {
        types: {
          EIP712Domain: [
            {name: "name", type: "string"},
            {name: "version", type: "string"},
            {name: "chainId", type: "uint256"},
            {name: "verifyingContract", type: "address"},
          ],
          ...Types,
        },
        primaryType: 'Delegation',
        domain: Domain(comp),
        message: {
          delegatee,
          nonce,
          expiry
        },
      };
      const digest = TypedDataUtils.encodeDigest(TypedData)
      const digestHex = ethers.utils.hexlify(digest)
      const signature = await signers[0].signMessage(digestHex)
      let sig = ethers.utils.splitSignature(signature);
      const { v, r, s } = sig;
      await TruffleAssert.reverts(
        comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
        'Comp::delegateBySig: invalid nonce',
      );
    });

    it('reverts if the signature has expired', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, privateKey);
      await expect(send(comp, 'delegateBySig', [delegatee, nonce, expiry, v, r, s])).rejects.toRevert('revert Comp::delegateBySig: signature expired');
    });

    it('delegates on behalf of the signatory', async () => {
      const delegatee = root, nonce = 0, expiry = 10e9;
      const { v, r, s } = EIP712.sign(Domain(comp), 'Delegation', { delegatee, nonce, expiry }, Types, privateKey);
      expect(await call(comp, 'delegates', [a1])).toEqual(address(0));
      const tx = await send(comp, 'delegateBySig', [delegatee, nonce, expiry, v, r, s]);
      expect(tx.gasUsed < 80000);
      expect(await call(comp, 'delegates', [a1])).toEqual(root);
    });
  });

  describe('numCheckpoints', () => {
    it('returns the number of checkpoints for a delegate', async () => {
      let guy = acc[0];
      await send(comp, 'transfer', [guy, '100']); //give an account a few tokens for readability
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('0');

      const t1 = await send(comp, 'delegate', [a1], { from: guy });
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('1');

      const t2 = await send(comp, 'transfer', [a2, 10], { from: guy });
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('2');

      const t3 = await send(comp, 'transfer', [a2, 10], { from: guy });
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('3');

      const t4 = await send(comp, 'transfer', [guy, 20], { from: root });
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('4');

      await expect(call(comp, 'checkpoints', [a1, 0])).resolves.toEqual(expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: '100' }));
      await expect(call(comp, 'checkpoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ fromBlock: t2.blockNumber.toString(), votes: '90' }));
      await expect(call(comp, 'checkpoints', [a1, 2])).resolves.toEqual(expect.objectContaining({ fromBlock: t3.blockNumber.toString(), votes: '80' }));
      await expect(call(comp, 'checkpoints', [a1, 3])).resolves.toEqual(expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: '100' }));
    });

    it('does not add more than one checkpoint in a block', async () => {
      let guy = acc[0];

      await send(comp, 'transfer', [guy, '100']); //give an account a few tokens for readability
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('0');
      await minerStop();

      let t1 = send(comp, 'delegate', [a1], { from: guy });
      let t2 = send(comp, 'transfer', [a2, 10], { from: guy });
      let t3 = send(comp, 'transfer', [a2, 10], { from: guy });

      await minerStart();
      t1 = await t1;
      t2 = await t2;
      t3 = await t3;

      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('1');

      await expect(call(comp, 'checkpoints', [a1, 0])).resolves.toEqual(expect.objectContaining({ fromBlock: t1.blockNumber.toString(), votes: '80' }));
      await expect(call(comp, 'checkpoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ fromBlock: '0', votes: '0' }));
      await expect(call(comp, 'checkpoints', [a1, 2])).resolves.toEqual(expect.objectContaining({ fromBlock: '0', votes: '0' }));

      const t4 = await send(comp, 'transfer', [guy, 20], { from: root });
      await expect(call(comp, 'numCheckpoints', [a1])).resolves.toEqual('2');
      await expect(call(comp, 'checkpoints', [a1, 1])).resolves.toEqual(expect.objectContaining({ fromBlock: t4.blockNumber.toString(), votes: '100' }));
    });
  });

  describe('getPriorVotes', () => {
    it('reverts if block number >= current block', async () => {
      await expect(call(comp, 'getPriorVotes', [a1, 5e10])).rejects.toRevert('revert Comp::getPriorVotes: not yet determined');
    });

    it('returns 0 if there are no checkpoints', async () => {
      expect(await call(comp, 'getPriorVotes', [a1, 0])).toEqual('0');
    });

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await send(comp, 'delegate', [a1], { from: root });
      await mineBlock();
      await mineBlock();

      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber])).toEqual('10000000000000000000000000');
      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber + 1])).toEqual('10000000000000000000000000');
    });

    it('returns zero if < first checkpoint block', async () => {
      await mineBlock();
      const t1 = await send(comp, 'delegate', [a1], { from: root });
      await mineBlock();
      await mineBlock();

      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber - 1])).toEqual('0');
      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber + 1])).toEqual('10000000000000000000000000');
    });

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const t1 = await send(comp, 'delegate', [a1], { from: root });
      await mineBlock();
      await mineBlock();
      const t2 = await send(comp, 'transfer', [a2, 10], { from: root });
      await mineBlock();
      await mineBlock();
      const t3 = await send(comp, 'transfer', [a2, 10], { from: root });
      await mineBlock();
      await mineBlock();
      const t4 = await send(comp, 'transfer', [root, 20], { from: a2 });
      await mineBlock();
      await mineBlock();

      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber - 1])).toEqual('0');
      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber])).toEqual('10000000000000000000000000');
      expect(await call(comp, 'getPriorVotes', [a1, t1.blockNumber + 1])).toEqual('10000000000000000000000000');
      expect(await call(comp, 'getPriorVotes', [a1, t2.blockNumber])).toEqual('9999999999999999999999990');
      expect(await call(comp, 'getPriorVotes', [a1, t2.blockNumber + 1])).toEqual('9999999999999999999999990');
      expect(await call(comp, 'getPriorVotes', [a1, t3.blockNumber])).toEqual('9999999999999999999999980');
      expect(await call(comp, 'getPriorVotes', [a1, t3.blockNumber + 1])).toEqual('9999999999999999999999980');
      expect(await call(comp, 'getPriorVotes', [a1, t4.blockNumber])).toEqual('10000000000000000000000000');
      expect(await call(comp, 'getPriorVotes', [a1, t4.blockNumber + 1])).toEqual('10000000000000000000000000');
    });
  });
});
