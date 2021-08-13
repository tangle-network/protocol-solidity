const BN = require('bn.js');
const EIP712 = require('../helpers/EIP712');
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const helpers = require('../helpers');
const {
  address,
  encodeParameters,
  etherMantissa,
} = helpers;
const assert = require('assert');
const CompToken = artifacts.require('CompToken');
const GovernorBravoDelegateHarness = artifacts.require('GovernorBravoDelegateHarness');
const GovernorBravoDelegator = artifacts.require('GovernorBravoDelegator');

async function enfranchise(comp, actor, amount) {
  await comp.transfer(actor, etherMantissa(amount));
  await comp.delegate(actor, { from: actor });
}

contract('governorBravo#castVote/2', (accounts) => {
  const name = 'Webb';
  const symbol = 'WEBB';
  let comp, gov, govImplementation, root, a1, govDelegate;
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
    govImplementation = await GovernorBravoDelegateHarness.at(gov.address);
    await govImplementation._initiate();
    
    targets = [a1];
    values = ['0'];
    signatures = ['getBalanceOf(address)'];
    callDatas = [encodeParameters(['address'], [a1])];
    await comp.delegate(root);
    await govImplementation.propose(targets, values, signatures, callDatas, 'do nothing');
    proposalId = await govImplementation.latestProposalIds(root);
  });

  it.only('Revert if there does not exist a proposal with matching proposal id where the current block number is between the proposal\'s start block (exclusive) and end block (inclusive)', async () => {
    await TruffleAssert.reverts(
      govImplementation.castVote(proposalId, 1),
      'GovernorBravo::castVoteInternal: voting is closed',
    );
  });

  it.only('Revert if such proposal already has an entry in its voters set matching the sender', async () => {
    await network.provider.send("evm_mine")
    await network.provider.send("evm_mine")

    let vote = await govImplementation.castVote(proposalId, 1, { from: accounts[4] });

    let vote2 = await govImplementation.castVoteWithReason(proposalId, 1, '', { from: accounts[3] });

    await TruffleAssert.reverts(
      govImplementation.castVote(proposalId, 1, { from: accounts[4] }),
      'GovernorBravo::castVoteInternal: voter already voted',
    );
  });

  it.only('Cast vote adds the sender to the proposal\'s voters set', async () => {
    assert.strictEqual(((await govImplementation.getReceipt(proposalId, accounts[2])))[0], false);
    let vote = await govImplementation.castVote(proposalId, 1, { from: accounts[2] });
    assert.strictEqual((await govImplementation.getReceipt(proposalId, accounts[2]))[0], true);
  });

  let actor; // an account that will propose, receive tokens, delegate to self, and vote on own proposal

  it.only('and we add that ForVotes', async () => {
    actor = accounts[1];
    await enfranchise(comp, actor, 400001);

    await TruffleAssert.passes(govImplementation.propose(targets, values, signatures, callDatas, 'do nothing', { from: actor }));
    proposalId = await govImplementation.latestProposalIds(actor);

    let beforeFors = (await govImplementation.proposals(proposalId)).forVotes;
    await network.provider.send("evm_mine")
    await govImplementation.castVote(proposalId, 1, { from: actor });

    let afterFors = (await govImplementation.proposals(proposalId)).forVotes;
    const temp = new BN(etherMantissa(400001).toFixed());
    let aFors = beforeFors.add(temp);
    assert.strictEqual(afterFors.toString(), aFors.toString());
  })

  it.only('or AgainstVotes corresponding to the caller\'s support flag.', async () => {
    actor = accounts[3];
    await enfranchise(comp, actor, 400001);

    await TruffleAssert.passes(govImplementation.propose(targets, values, signatures, callDatas, 'do nothing', { from: actor }));
    proposalId = await govImplementation.latestProposalIds(actor);

    let beforeAgainsts = (await govImplementation.proposals(proposalId)).againstVotes;
    await network.provider.send("evm_mine")
    await govImplementation.castVote(proposalId, 0, { from: actor });

    let afterAgainsts = (await govImplementation.proposals(proposalId)).againstVotes;
    const temp = new BN(etherMantissa(400001).toFixed());
    let aAgainsts = beforeAgainsts.add(temp);
    assert.strictEqual(afterAgainsts.toString(), aAgainsts.toString());
  });

  it.only('castVoteBySig  if the signatory is invalid', async () => {
    await TruffleAssert.reverts(
      govImplementation.castVoteBySig(proposalId, 0, 0, '0xbad', '0xbad'),
      'GovernorBravo::castVoteBySig: invalid signature',
    );
  });

  it.only('castVoteBySig casts vote on behalf of the signatory', async () => {
    await enfranchise(comp, acc[1], 400001);
    await govImplementation.propose(targets, values, signatures, callDatas, 'do nothing', { from: acc[1] });
    proposalId = await govImplementation.latestProposalIds(acc[1]);

    const signers = await hre.ethers.getSigners()
    const msgParams = helpers.createBallotBySigMessage(gov.address, proposalId, 1, chainId);
    const result = await signers[4].provider.send('eth_signTypedData_v4', [signers[4].address, msgParams])
    let sig = ethers.utils.splitSignature(result);
    const { v, r, s } = sig;

    let beforeFors = (await govImplementation.proposals(proposalId)).forVotes;
    await network.provider.send("evm_mine")
    const tx = await govImplementation.castVoteBySig(proposalId, 1, v, r, s);
    assert(tx.receipt.gasUsed < 100000);

    let afterFors = (await govImplementation.proposals(proposalId)).forVotes;
    console.log(afterFors, beforeFors);
    assert.strictEqual(afterFors.toString(), beforeFors.toNumber() + etherMantissa(400001) + '');
  });

  after(async () => {
    await network.provider.send("evm_setAutomine", [true]);
  });
});
