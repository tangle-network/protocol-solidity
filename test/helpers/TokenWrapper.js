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

  let proposalId = await gov.latestProposalIds(caller);
  await gov.castVote(proposalId, 1, { from: caller });
  for (let i = 0; i < 10; i++) {
    await network.provider.send("evm_mine")
  }

  await gov.queue(proposalId);
  await network.provider.send("evm_increaseTime", [2 * 2 * 24 * 60 * 60])
  await network.provider.send("evm_mine")

  await gov.execute(proposalId);
  state = await gov.state(proposalId);
  assert.strictEqual(state.toString(), states['Executed']);
  assert.strictEqual((await wrapper.getTokens())[0], token.address);
};

module.exports = {
  addTokenToWrapper,
};
