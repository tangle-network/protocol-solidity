const EIP712 = require('../helpers/EIP712');
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const helpers = require('../helpers');
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
    chainId = 31337; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    comp = await CompToken.new(name, symbol);
  });

  describe('metadata', () => {
    it('has given name', async () => {
      assert.strictEqual(await comp.name(), name);
    });

    it('has given symbol', async () => {
      assert.strictEqual(await comp.symbol(), symbol);
    });
  });

  describe('balanceOf', () => {
    it('grants nothing to initial account', async () => {
      assert.strictEqual((await comp.balanceOf(root)).toString(), '0');
    });
  });

  describe('delegateBySig', () => {
    const TypedDataUtils = require('ethers-eip712').TypedDataUtils;
    const Domain = (comp) => ({ name, version, chainId, verifyingContract: comp.address });
    const Types = {
      EIP712Domain: [
        {name: "name", type: "string"},
        {name: "version", type: "string"},
        {name: "chainId", type: "uint256"},
        {name: "verifyingContract", type: "address"},
      ],
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
      const delegatee = root, nonce = 1, expiry = 0;
      const signers = await hre.ethers.getSigners()
      const msgParams = helpers.createDelegateBySigMessage(comp.address, delegatee, expiry, chainId, nonce);
      const result = await signers[1].provider.send('eth_signTypedData_v4', [signers[1].address, msgParams])
      let sig = ethers.utils.splitSignature(result);
      const { v, r, s } = sig;
      await TruffleAssert.reverts(
        comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
        'Comp::delegateBySig: invalid nonce',
      );
    });

    it.only('reverts if the signature has expired', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      const signers = await hre.ethers.getSigners()
      const msgParams = helpers.createDelegateBySigMessage(comp.address, delegatee, expiry, chainId, nonce);
      const result = await signers[1].provider.send('eth_signTypedData_v4', [signers[1].address, msgParams])
      let sig = ethers.utils.splitSignature(result);
      const { v, r, s } = sig;
      await TruffleAssert.reverts(
        comp.delegateBySig(delegatee, nonce, expiry, v, r, s),
        'Comp::delegateBySig: signature expired',
      );
    });

    it.only('delegates on behalf of the signatory', async () => {
      const delegatee = root, nonce = 0, expiry = 10e9;
      const signers = await hre.ethers.getSigners()
      const msgParams = helpers.createDelegateBySigMessage(comp.address, delegatee, expiry, chainId, nonce);
      const result = await signers[1].provider.send('eth_signTypedData_v4', [signers[1].address, msgParams])
      let sig = ethers.utils.splitSignature(result);
      const { v, r, s } = sig;
      assert.strictEqual(await comp.delegates(a1), '0x0000000000000000000000000000000000000000');
      const tx = await comp.delegateBySig(delegatee, nonce, expiry, v, r, s, { from: root });
      assert(tx.receipt.gasUsed < 90000);
      assert.strictEqual(await comp.delegates(a1), root);
    });
  });

  describe('numCheckpoints', () => {
    it.only('returns the number of checkpoints for a delegate', async () => {
      let guy = acc[0];
      await comp.mint(root, 1000000);
      await TruffleAssert.passes(comp.transfer(guy, 100));
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '0');
      
      const t1 = await comp.delegate(a1, { from: guy });
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '1');

      const t2 = await comp.transfer(a2, 10, { from: guy });
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '2');

      const t3 = await comp.transfer(a2, 10, { from: guy });
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '3');

      const t4 = await comp.transfer(guy, 20, { from: root });
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '4');

      const c1 = await comp.checkpoints(a1, 0);
      assert.strictEqual(c1.fromBlock.toString(), t1.receipt.blockNumber.toString());
      assert.strictEqual(c1.votes.toString(), '100');

      const c2 = await comp.checkpoints(a1, 1);
      assert.strictEqual(c2.fromBlock.toString(), t2.receipt.blockNumber.toString());
      assert.strictEqual(c2.votes.toString(), '90');

      const c3 = await comp.checkpoints(a1, 2);
      assert.strictEqual(c3.fromBlock.toString(), t3.receipt.blockNumber.toString());
      assert.strictEqual(c3.votes.toString(), '80');

      const c4 = await comp.checkpoints(a1, 3);
      assert.strictEqual(c4.fromBlock.toString(), t4.receipt.blockNumber.toString());
      assert.strictEqual(c4.votes.toString(), '100');
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
