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
    it('reverts if the signatory is invalid', async () => {
      const delegatee = root, nonce = 0, expiry = 0;
      await TruffleAssert.reverts(
        comp.delegateBySig(delegatee, nonce, expiry, 0, '0xbad', '0xbad'),
        'Comp::delegateBySig: invalid signature',
      );
    });

    it('reverts if the nonce is bad ', async () => {
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

    it('reverts if the signature has expired', async () => {
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

    it('delegates on behalf of the signatory', async () => {
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
    it('returns the number of checkpoints for a delegate', async () => {
      let guy = acc[0];
      await comp.mint(root, '10000000000000000000000000');
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

    // TODO: Original test requires starting and stopping mining
    // TODO: In Hardhat, every tx advances a block
    it.skip('does not add more than one checkpoint in a block', async () => {
      let guy = acc[0];
      await comp.mint(root, '10000000000000000000000000');
      await TruffleAssert.passes(comp.transfer(guy, 100));
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '0');

      
      let t1 = comp.delegate(a1, { from: guy });
      let t2 = comp.transfer(a2, 10, { from: guy });
      let t3 = comp.transfer(a2, 10, { from: guy });

      t1 = await t1;
      t2 = await t2;
      t3 = await t3;

      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '1');

      let c1 = await comp.checkpoints(a1, 0);
      assert.strictEqual(c1.fromBlock.toString(), t1.receipt.blockNumber.toString());
      assert.strictEqual(c1.votes.toString(), '80');
      
      let c2 = await comp.checkpoints(a1, 1);
      assert.strictEqual(c2.fromBlock.toString(), '0');
      assert.strictEqual(c2.votes.toString(), '0');

      let c3 = await comp.checkpoints(a1, 2);
      assert.strictEqual(c3.fromBlock.toString(), '0');
      assert.strictEqual(c3.votes.toString(), '0');


      const t4 = await comp.transfer(guy, 20, { from: root });
      assert.strictEqual((await comp.numCheckpoints(a1)).toString(), '2');
      let c4 = await comp.checkpoints(a1, 3);
      assert.strictEqual(c4.fromBlock.toString(), t4.receipt.blockNumber.toString());
      assert.strictEqual(c4.votes.toString(), '100');
    });
  });

  describe('getPriorVotes', () => {
    it('reverts if block number >= current block', async () => {
      await TruffleAssert.reverts(
        comp.getPriorVotes(a1, 5e10),
        'Comp::getPriorVotes: not yet determined',
      );
    });

    it('returns 0 if there are no checkpoints', async () => {
      assert.strictEqual((await comp.getPriorVotes(a1, 0)).toString(), '0');
    });

    it.skip('returns the latest block if >= last checkpoint block', async () => {
      await comp.mint(root, '10000000000000000000000000');

      const t1 = await comp.delegate(a1, { from: root });   
      await mineBlock();
      await mineBlock();

      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber)).toString(), '10000000000000000000000000');
      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber + 1)).toString(), '10000000000000000000000000');
    });

    it.skip('returns zero if < first checkpoint block', async () => {
      await comp.mint(root, '10000000000000000000000000');
      await mineBlock();
      const t1 = await comp.delegate(a1, { from: root });
      await mineBlock();
      await mineBlock();

      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber - 1)).toString(), '0');
      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber + 1)).toString(), '10000000000000000000000000');
    });

    it.skip('generally returns the voting balance at the appropriate checkpoint', async () => {
      await comp.mint(root, '10000000000000000000000000');

      const t1 = await comp.delegate(a1, { from: root });
      await mineBlock();
      await mineBlock();
      const t2 = await comp.transfer(a2, 10, { from: root });
      await mineBlock();
      await mineBlock();
      const t3 = await comp.transfer(a2, 10, { from: root });
      await mineBlock();
      await mineBlock();
      const t4 = await comp.transfer(root, 20, { from: a2 });
      await mineBlock();
      await mineBlock();

      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber - 1)).toString(), '0');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber)).toString(), '10000000000000000000000000');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t1.receipt.blockNumber + 1)).toString(), '9999999999999999999999990');
    
      assert.strictEqual((await comp.getPriorVotes(a1, t2.receipt.blockNumber)).toString(), '9999999999999999999999990');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t2.receipt.blockNumber + 1)).toString(), '9999999999999999999999980');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t3.receipt.blockNumber)).toString(), '9999999999999999999999980');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t3.receipt.blockNumber + 1)).toString(), '9999999999999999999999980');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t4.receipt.blockNumber)).toString(), '10000000000000000000000000');
      
      assert.strictEqual((await comp.getPriorVotes(a1, t4.receipt.blockNumber + 1)).toString(), '10000000000000000000000000');
    });
  });
});
