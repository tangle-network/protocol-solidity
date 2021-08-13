const BN = require('bn.js');
const EIP712 = require('../helpers/EIP712');
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const helpers = require('../helpers');
const {
  address,
  encodeParameters,
  mineBlock,
  mergeInterface,
} = helpers;
const assert = require('assert');
const CompToken = artifacts.require('CompToken');
const GovernorBravoDelegateHarness = artifacts.require('GovernorBravoDelegateHarness');
const GovernorBravoDelegator = artifacts.require('GovernorBravoDelegator');

async function enfranchise(comp, actor, amount) {
  await comp.transfer(actor, amount);
  await comp.delegate(actor, { from: actor });
}

contract('governorBravo#castVote/2', (accounts) => {
  const name = 'Webb';
  const symbol = 'WEBB';
  let comp, gov, root, a1, govDelegate;
  let targets, values, signatures, callDatas, proposalId;

  before(async () => {
    await network.provider.send("evm_setAutomine", [false]);
    await network.provider.send("evm_setIntervalMining", [1000]);
    root = accounts[0];
    a1 = accounts[1];
    a2 = accounts[2];
    acc = accounts.slice(3);
    chainId = 31337; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    comp = await CompToken.new(name, symbol);
    await comp.mint(root, '10000000000000000000000000');

    govDelegate = await GovernorBravoDelegateHarness.new();
    gov = await GovernorBravoDelegator.new(
      address(0),
      comp.address,
      root,
      govDelegate.address,
      17280,
      1,
      '100000000000000000000000'
    );
    await network.provider.send("evm_mine")
    let compAddress =  await govDelegate.comp.call();
    console.log('Comp address from delegate', compAddress);
    await govDelegate._initiate();
    compAddress =  await govDelegate.comp();
    console.log(compAddress);
    
    targets = [a1];
    values = ['0'];
    signatures = ['getBalanceOf(address)'];
    callDatas = [encodeParameters(['address'], [a1])];
    await comp.delegate(root);
    await govDelegate.propose(targets, values, signatures, callDatas, 'do nothing');
    proposalId = await gov.latestProposalIds(root);
  });

  describe('We must revert if:', () => {
    it('There does not exist a proposal with matching proposal id where the current block number is between the proposal\'s start block (exclusive) and end block (inclusive)', async () => {
      await TruffleAssert.reverts(
        govDelegate.castVote(proposalId, 1),
        'GovernorBravo::castVoteInternal: voting is closed',
      );
    });

    // TODO: These tests require control over mining, i.e. manual mining.
    it.only('Such proposal already has an entry in its voters set matching the sender', async () => {
      await network.provider.send("evm_mine")
      await network.provider.send("evm_mine")

      let vote = await govDelegate.castVote(proposalId, 1, { from: accounts[4] });

      let vote2 = await govDelegate.castVoteWithReason(proposalId, 1, '', { from: accounts[3] });

      await TruffleAssert.reverts(
        govDelegate.castVote(proposalId, 1, { from: accounts[4] }),
        'GovernorBravo::castVoteInternal: sender already voted',
      );
    });
  });

  describe('Otherwise', () => {
    it('we add the sender to the proposal\'s voters set', async () => {
      assert.strictEqual(await govDelegate.getReceipt(proposalId, accounts[2]), { hasVoted: false });
      let vote = await govDelegate.castVote(proposalId, 1, { from: accounts[2] });
      assert.strictEqual(await govDelegate.getReceipt(proposalId, accounts[2]), { hasVoted: true });
    });

    describe('and we take the balance returned by GetPriorVotes for the given sender and the proposal\'s start block, which may be zero,', () => {
      let actor; // an account that will propose, receive tokens, delegate to self, and vote on own proposal

      it.only('and we add that ForVotes', async () => {
        actor = accounts[1];
        await enfranchise(comp, actor, 400001);

        await govDelegate.propose(targets, values, signatures, callDatas, 'do nothing', { from: actor });
        proposalId = await gov.latestProposalIds(actor);

        let beforeFors = (await gov.proposals(proposalId)).forVotes;
        await network.provider.send("evm_mine")
        await govDelegate.castVote(proposalId, 1, { from: actor });

        let afterFors = (await gov.proposals(proposalId)).forVotes;
        assert.strictEqual(afterFors, beforeFors + 400001);
      })

      it.only('or AgainstVotes corresponding to the caller\'s support flag.', async () => {
        actor = accounts[3];
        await enfranchise(comp, actor, 400001);

        await govDelegate.propose(targets, values, signatures, callDatas, 'do nothing', { from: actor });
        proposalId = await gov.latestProposalIds(actor);

        let beforeAgainsts = (await gov.proposals(proposalId)).againstVotes;
        await network.provider.send("evm_mine")
        await govDelegate.castVote(proposalId, 0, { from: actor });

        let afterAgainsts = (await gov.proposals(proposalId)).againstVotes;
        assert.strictEqual(afterAgainsts, beforeAgainsts + 400001);
      });
    });

    describe('castVoteBySig', () => {
      const Domain = (gov) => ({
        name: 'Compound Governor Bravo',
        chainId: 1, // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
        verifyingContract: gov._address
      });
      const Types = {
        Ballot: [
          { name: 'proposalId', type: 'uint256' },
          { name: 'support', type: 'uint8' },
        ]
      };

      it('reverts if the signatory is invalid', async () => {
        await TruffleAssert.reverts(
          govDelegate.castVoteBySig(proposalId, 0, 0, '0xbad', '0xbad'),
          'GovernorBravo::castVoteBySig: invalid signature',
        );
      });

      it.only('casts vote on behalf of the signatory', async () => {
        await enfranchise(comp, a1, 400001);
        await govDelegate.propose(targets, values, signatures, callDatas, 'do nothing', { from: a1 });
        proposalId = await gov.latestProposalIds(a1);

        const signers = await hre.ethers.getSigners()
        const msgParams = helpers.createBallotBySigMessage(gov.address, proposalId, 1, chainId, nonce);
        const result = await signers[1].provider.send('eth_signTypedData_v4', [signers[1].address, msgParams])
        let sig = ethers.utils.splitSignature(result);
        const { v, r, s } = sig;

        let beforeFors = (await gov.proposals(proposalId)).forVotes;
        await network.provider.send("evm_mine")
        const tx = await govDelegate.castVoteBySig(proposalId, 1, v, r, s);
        assert(tx.receipt.gasUsed < 80000);

        let afterFors = (await gov.proposals(proposalId)).forVotes;
        assert.strictEqual(afterFors.toString(), beforeFors.toNumber() + 400001 + '');
      });
    });
  });

  after(async () => {
    await network.provider.send("evm_setAutomine", [true]);
  });
});
