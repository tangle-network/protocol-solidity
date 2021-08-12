const BN = require('bn.js');
const EIP712 = require('../helpers/EIP712');
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const helpers = require('../helpers');
const {
  address,
  encodeParameters,
  mineBlock
} = helpers;
const assert = require('assert');
const CompToken = artifacts.require('CompToken');
const GovernorBravoImmutable = artifacts.require('GovernorBravoImmutable');

contract('GovernorBravo#propose/5', (accounts) => {
  const name = 'Webb';
  const symbol = 'WEBB';
  let gov, root, acct;

  before(async () => {
    root = accounts[0];
    acct = accounts[1];
    acc = accounts.slice(2);
    chainId = 31337; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    comp = await CompToken.new(name, symbol);
    gov = await GovernorBravoImmutable.new(address(0), comp.address, root, 17280, 1, "100000000000000000000000");
    await gov._initiate();
  });

  let trivialProposal, targets, values, signatures, callDatas;
  let proposalBlock;
  before(async () => {
    await comp.mint(root, '10000000000000000000000000');
    targets = [root];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    callDatas = [encodeParameters(['address'], [acct])];
    await comp.delegate(root);
    await gov.propose(targets, values, signatures, callDatas, 'do nothing');
    proposalBlock = +(await web3.eth.getBlockNumber());
    proposalId = await gov.latestProposalIds(root);
    trivialProposal = await gov.proposals(proposalId);
  });

  it("Given the sender's GetPriorVotes for the immediately previous block is above the Proposal Threshold (e.g. 2%), the given proposal is added to all proposals, given the following settings", async () => {
    // TODO: depends on get prior votes and delegation and voting 
  });

  describe("simple initialization", () => {
    it("ID is set to a globally unique identifier", async () => {
      assert.strictEqual(trivialProposal.id, proposalId);
    });

    it("Proposer is set to the sender", async () => {
      assert.strictEqual(trivialProposal.proposer, root);
    });

    it("Start block is set to the current block number plus vote delay", async () => {
      assert.strictEqual(trivialProposal.startBlock, proposalBlock + 1 + "");
    });

    it("End block is set to the current block number plus the sum of vote delay and vote period", async () => {
      assert.strictEqual(trivialProposal.endBlock, proposalBlock + 1 + 17280 + "");
    });

    it("ForVotes and AgainstVotes are initialized to zero", async () => {
      assert.strictEqual(trivialProposal.forVotes, "0");
      assert.strictEqual(trivialProposal.againstVotes, "0");
    });

    it("Executed and Canceled flags are initialized to false", async () => {
      assert.strictEqual(trivialProposal.canceled, false);
      assert.strictEqual(trivialProposal.executed, false);
    });

    it("ETA is initialized to zero", async () => {
      assert.strictEqual(trivialProposal.eta, "0");
    });

    it("Targets, Values, Signatures, Calldatas are set according to parameters", async () => {
      let dynamicFields = await call(gov, 'getActions', [trivialProposal.id]);
      assert.strictEqual(dynamicFields.targets, targets);
      assert.strictEqual(dynamicFields.values, values);
      assert.strictEqual(dynamicFields.signatures, signatures);
      assert.strictEqual(dynamicFields.calldatas, callDatas);
    });

    describe("This function must revert if", () => {
      it("the length of the values, signatures or calldatas arrays are not the same length,", async () => {
        await TruffleAssert.reverts(
          gov.propose(targets.concat(root), values, signatures, callDatas, 'do nothing'),
          "GovernorBravo::propose: proposal function information arity mismatch",
        );
        
        await TruffleAssert.reverts(
          gov.propose(targets, values.concat(["0"]), signatures, callDatas, 'do nothing'),
          "GovernorBravo::propose: proposal function information arity mismatch",
        );

        await TruffleAssert.reverts(
          gov.propose(targets, values, signatures.concat(signatures), callDatas, 'do nothing'),
          "GovernorBravo::propose: proposal function information arity mismatch",
        );

        await TruffleAssert.reverts(
          gov.propose(targets, values, signatures, callDatas.concat(callDatas), 'do nothing'),
          "GovernorBravo::propose: proposal function information arity mismatch",
        );
      });

      it("or if that length is zero or greater than Max Operations.", async () => {
        await TruffleAssert.reverts(
          gov.propose([], [], [], [], 'do nothing'),
          "GovernorBravo::propose: must provide actions",
        );
      });

      describe("Additionally, if there exists a pending or active proposal from the same proposer, we must revert.", () => {
        it("reverts with pending", async () => {
          await TruffleAssert.reverts(
            gov.propose(targets, values, signatures, callDatas, 'do nothing'),
            "GovernorBravo::propose: one live proposal per proposer, found an already pending proposal",
          );
        });

        it.skip("reverts with active", async () => {
          await mineBlock();
          await mineBlock();

          await TruffleAssert.reverts(
            gov.propose(targets, values, signatures, callDatas, 'do nothing'),
            "GovernorBravo::propose: one live proposal per proposer, found an already active proposal",
          );
        });
      });
    });

    it("This function returns the id of the newly created proposal. # proposalId(n) = succ(proposalId(n-1))", async () => {
      await comp.transfer(accounts[2], 400001);
      await comp.delegate(accounts[2], { from: accounts[2] });

      await mineBlock();
      let nextProposalId = await gov.methods['propose'](targets, values, signatures, callDatas, "yoot").call({ from: accounts[2] });
      // let nextProposalId = await call(gov, 'propose', [targets, values, signatures, callDatas, "second proposal"], { from: accounts[2] });

      assert.strictEqual(+nextProposalId, +trivialProposal.id + 1);
    });

    it("emits log with id and description", async () => {
      await comp.transfer(accounts[3], 400001);
      await comp.delegate(accounts[3], { from: accounts[3] });
      await mineBlock();
      let nextProposalId = await gov.methods['propose'](targets, values, signatures, callDatas, "yoot").call({ from: accounts[3] });

      const tx = gov.propose(targets, values, signatures, callDatas, "second proposal", { from: accounts[3] });
      const log = tx.receipt.logs[0];
      console.log(log);

      // expect(
      //   await send(gov, 'propose', [targets, values, signatures, callDatas, "second proposal"], { from: accounts[3] })
      // ).toHaveLog("ProposalCreated", {
      //   id: nextProposalId,
      //   targets: targets,
      //   values: values,
      //   signatures: signatures,
      //   calldatas: callDatas,
      //   startBlock: 15,
      //   endBlock: 17295,
      //   description: "second proposal",
      //   proposer: accounts[3]
      // });
    });
  });
});
