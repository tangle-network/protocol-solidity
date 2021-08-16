const ethereum = require('./Ethereum');
const {
  encodeParameters,
} = ethereum;

const addTokenToWrapper = async (gov, wrapper, token, caller, states) => {
  let state;
  let targets = [wrapper.address];
  let values = ['0'];
  let signatures = ["add(address)"];
  let callDatas = [encodeParameters(['address'], [token.address])];
  await gov.propose(targets, values, signatures, callDatas, 'do nothing');
  await network.provider.send("evm_mine")

  proposalId = await gov.latestProposalIds(caller);
  await gov.castVote(proposalId, 1, { from: caller });
  for (let i = 0; i < 10; i++) {
    await network.provider.send("evm_mine")
  }

  const prop = await gov.proposals(proposalId);
  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Succeeded']);

  await gov.queue(proposalId);
  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Queued']);

  await network.provider.send("evm_increaseTime", [2 * 2 * 24 * 60 * 60])
  await network.provider.send("evm_mine")

  await gov.execute(proposalId);
  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Executed']);
  assert.strictEqual((await wrapper.getTokens())[0], token.address);
};

const increaseWrappingLimit = async (gov, wrapper, amount, caller, states) => {
  let state;
  let targets = [wrapper.address];
  let values = ['0'];
  let signatures = ["updateLimit(uint256)"];
  let callDatas = [encodeParameters(['uint256'], [amount])];
  await gov.propose(targets, values, signatures, callDatas, 'do nothing');
  await network.provider.send("evm_mine")

  proposalId = await gov.latestProposalIds(caller);
  await gov.castVote(proposalId, 1, { from: caller });
  for (let i = 0; i < 10; i++) {
    await network.provider.send("evm_mine")
  }

  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Succeeded']);

  await gov.queue(proposalId);
  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Queued']);

  await network.provider.send("evm_increaseTime", [10 * 24 * 60 * 60])
  await network.provider.send("evm_mine")
  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Queued']);

  await gov.execute(proposalId);
  state = await gov.state(proposalId);

  assert.strictEqual(state.toString(), states['Executed']);
  assert.strictEqual((await wrapper.wrappingLimit()).toString(), amount);
};

module.exports = {
  addTokenToWrapper,
  increaseWrappingLimit,
};
