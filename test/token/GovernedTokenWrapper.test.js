const TruffleAssert = require('truffle-assertions');

const helpers = require('../helpers');
const {
  address,
  encodeParameters,
  etherUnsigned
} = helpers;
const assert = require('assert');
const { network, ethers } = require('hardhat');
const CompToken = artifacts.require('CompToken');
const TimelockHarness = artifacts.require('TimelockHarness');
const GovernorBravoImmutable = artifacts.require('GovernorBravoImmutable');
const GovernedTokenWrapper = artifacts.require('GovernedTokenWrapper');
const MintableToken = artifacts.require('ERC20PresetMinterPauser');

const path = require('path');
const solparse = require('solparse');

const governorBravoPath = path.join(__dirname, '../../', 'contracts', 'governance/GovernorBravoInterfaces.sol');
const statesInverted = solparse
  .parseFile(governorBravoPath)
  .body
  .find(k => k.name === 'GovernorBravoDelegateStorageV1')
  .body
  .find(k => k.name == 'ProposalState')
  .members

const states = Object.entries(statesInverted).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});

contract('GovernedTokenWrapper', (accounts) => {
  const name = 'Webb';
  const symbol = 'WEBB';
  let gov, root, acct;
  let targets, values, signatures, callDatas;

  beforeEach(async () => {
    root = accounts[0];
    acct = accounts[1];
    acc = accounts.slice(2);
    chainId = 31337; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    comp = await CompToken.new(name, symbol);
    delay = etherUnsigned(2 * 24 * 60 * 60).multipliedBy(2)
    timelock = await TimelockHarness.new(root, delay);

    gov = await GovernorBravoImmutable.new(timelock.address, comp.address, root, 10, 1, "100000000000000000000000");
    await gov._initiate();
    await timelock.harnessSetAdmin(gov.address);

    await comp.mint(root, '10000000000000000000000000');
    await comp.delegate(root);
  });

  it('should instantiate the contracts', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, gov.address, '1000000000000000000000000', false);
    assert.strictEqual((await wrappedToken.name()), name);
    assert.strictEqual((await wrappedToken.symbol()), symbol);
    assert.strictEqual((await wrappedToken.governor()), gov.address);
    assert.strictEqual((await wrappedToken.wrappingLimit()).toString(), '1000000000000000000000000');
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '0');
  });

  it('should not allow adding a token from a non-governor', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, gov.address, '1000000000000000000000000', false);
    await TruffleAssert.reverts(
      wrappedToken.add(address(0), { from: accounts[0] }),
      'Only governor can call this function',
    );
  });

  it('should allow adding a token as governor', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, timelock.address, '1000000000000000000000000', false);
    const token = await CompToken.new('Token', 'TKN');
    targets = [wrappedToken.address];
    values = ['0'];
    signatures = ["add(address)"];
    callDatas = [encodeParameters(['address'], [token.address])];
    await gov.propose(targets, values, signatures, callDatas, 'do nothing');
    await network.provider.send("evm_mine")

    proposalId = await gov.latestProposalIds(root);
    await gov.castVote(proposalId, 1, { from: root });
    for (let i = 0; i < 10; i++) {
      await network.provider.send("evm_mine")
    }

    const prop = await gov.proposals(proposalId);
    let state = await gov.state(proposalId);
    assert.strictEqual(state.toString(), states['Succeeded']);

    await gov.queue(proposalId);
    state = await gov.state(proposalId);
    assert.strictEqual(state.toString(), states['Queued']);

    await network.provider.send("evm_increaseTime", [2 * 2 * 24 * 60 * 60])
    await network.provider.send("evm_mine")

    let res = await wrappedToken.getTokens();
    assert.strictEqual(res.length, 0);

    await gov.execute(proposalId);
    state = await gov.state(proposalId);
    assert.strictEqual(state.toString(), states['Executed']);
    assert.strictEqual((await wrappedToken.getTokens())[0], token.address);
  });

  it('should not allow adding the same token', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, timelock.address, '1000000000000000000000000', false);
    const token = await CompToken.new('Token', 'TKN');
    await helpers.addTokenToWrapper(gov, wrappedToken, token, root, states);
    await TruffleAssert.reverts(
      helpers.addTokenToWrapper(gov, wrappedToken, token, root, states),
    );
  });

  it('should fail to wrap with no limit', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, timelock.address, '0', false);
    const token = await CompToken.new('Token', 'TKN');

    await token.mint(root, '10000000000000000000000000');
    await token.approve(wrappedToken.address, '1000000000000000000000000');
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, '1000000000000000000000000'),
      'Invalid token address',
    );

    await helpers.addTokenToWrapper(gov, wrappedToken, token, root, states);
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, '1000000000000000000000000'),
      'Invalid token amount',
    );
  });

  it('should wrap only after token has been whitelisted', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, timelock.address, '1000000000000000000000000', false);
    const token = await CompToken.new('Token', 'TKN');

    await token.mint(root, '10000000000000000000000000');
    await token.approve(wrappedToken.address, '1000000000000000000000000');
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, '1000000000000000000000000'),
      'Invalid token address',
    );

    await helpers.addTokenToWrapper(gov, wrappedToken, token, root, states);
    await TruffleAssert.passes(wrappedToken.wrapFor(root, token.address, '1000000000000000000000000'));
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, '1000000000000000000000000'),
      'Invalid token amount',
    );
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '1000000000000000000000000');
  });

  it('should be able to wrap directly', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, timelock.address, '1000000000000000000000000', false, {from: accounts[9]});
    const token = await CompToken.new('Token', 'TKN');

    await token.mint(acct, '10000000000000000000000000');
    await token.approve(wrappedToken.address, '1000000000000000000000000', { from: acct });
    await helpers.addTokenToWrapper(gov, wrappedToken, token, root, states);
    await TruffleAssert.passes(wrappedToken.wrap(token.address, '1000000000000000000000000', { from: acct }));
  });

  it('should wrap after increasing limit', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, timelock.address, '0', false);
    const token = await CompToken.new('Token', 'TKN');
    const amount = '1000000000000000000000000';
    await token.mint(root, '10000000000000000000000000');
    await token.approve(wrappedToken.address, amount);
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, amount),
      'Invalid token address',
    );

    await helpers.addTokenToWrapper(gov, wrappedToken, token, root, states);
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, amount),
      'Invalid token amount',
    );

    await helpers.increaseWrappingLimit(gov, wrappedToken, amount, root, states);
    await TruffleAssert.passes(wrappedToken.wrapFor(root, token.address, amount));
    await TruffleAssert.reverts(
      wrappedToken.wrapFor(root, token.address, '1000000000000000000000000'),
      'Invalid token amount',
    );
  });

  it.only('should be able to wrap & unwrap both a native token', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, accounts[0], '1000000000000000000000000', true);
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '0');

    await TruffleAssert.passes(wrappedToken.wrap('0x0000000000000000000000000000000000000000', '0', { from: acct, value: '1000000000000000000' }));
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '1000000000000000000');
    assert.strictEqual((await wrappedToken.balanceOf(acct)).toString(), '1000000000000000000');
    assert.strictEqual((await web3.eth.getBalance(wrappedToken.address)).toString(), '1000000000000000000');

    // unwrap both assets
    await TruffleAssert.passes(wrappedToken.unwrap('0x0000000000000000000000000000000000000000', '1000000000000000000', { from: acct }));
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '0');
    assert.strictEqual((await web3.eth.getBalance(wrappedToken.address)).toString(), '0');
  });

  it('should fail to wrap a native token if not configued', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, accounts[0], '1000000000000000000000000', false);
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '0');

    await TruffleAssert.reverts(
      wrappedToken.wrap('0x0000000000000000000000000000000000000000', '0', { from: acct, value: '1000000000000000000' }),
      "Native wrapping is not allowed for this token wrapper",
    );
  });

  it.only('should be able to wrap & unwrap both a native and non-native token', async () => {
    const wrappedToken = await GovernedTokenWrapper.new(name, symbol, accounts[0], '1000000000000000000000000', true);
    const token = await MintableToken.new('Token', 'TKN');
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '0');
    await token.mint(acct, '10000000000000000000000000');
    await token.approve(wrappedToken.address, '1000000000000000000', { from: acct });
    await TruffleAssert.passes(wrappedToken.add(token.address));

    // wrap both native and non-native assets
    await TruffleAssert.passes(wrappedToken.wrap(token.address, '1000000000000000000', { from: acct }));
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '1000000000000000000');
    assert.strictEqual((await wrappedToken.balanceOf(acct)).toString(), '1000000000000000000');
    assert.strictEqual((await web3.eth.getBalance(wrappedToken.address)).toString(), '0');

    await TruffleAssert.passes(wrappedToken.wrap('0x0000000000000000000000000000000000000000', '0', { from: acct, value: '1000000000000000000' }));
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '2000000000000000000');
    assert.strictEqual((await wrappedToken.balanceOf(acct)).toString(), '2000000000000000000');
    assert.strictEqual((await web3.eth.getBalance(wrappedToken.address)).toString(), '1000000000000000000');

    // unwrap both assets
    await TruffleAssert.passes(wrappedToken.unwrap(token.address, '1000000000000000000', { from: acct }));
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '1000000000000000000');
    assert.strictEqual((await web3.eth.getBalance(wrappedToken.address)).toString(), '1000000000000000000');
    await TruffleAssert.passes(wrappedToken.unwrap('0x0000000000000000000000000000000000000000', '1000000000000000000', { from: acct }));
    assert.strictEqual((await web3.eth.getBalance(wrappedToken.address)).toString(), '0');
    assert.strictEqual((await wrappedToken.totalSupply()).toString(), '0');
  });
});
