const BN = require('bn.js');
const EIP712 = require('../helpers/EIP712');
const TruffleAssert = require('truffle-assertions');
const Ethers = require('ethers');

const helpers = require('../helpers');
const {
  address,
  encodeParameters,
  mineBlock,
  etherMantissa,
} = helpers;
const assert = require('assert');
const { network, ethers } = require('hardhat');
const CompToken = artifacts.require('CompToken');
const GovernorBravoImmutable = artifacts.require('GovernorBravoImmutable');

contract('GovernorBravo#propose/5', (accounts) => {
  const name = 'Webb';
  const symbol = 'WEBB';
  let gov, root, acct;

  before(async () => {
    await network.provider.send("evm_setAutomine", [false]);
    await network.provider.send("evm_setIntervalMining", [1000]);
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
    values = ['0'];
    signatures = ["getBalanceOf(address)"];
    callDatas = [encodeParameters(['address'], [acct])];
    await comp.delegate(root);
    await gov.propose(targets, values, signatures, callDatas, 'do nothing');
    proposalBlock = +(await web3.eth.getBlockNumber());
    proposalId = await gov.latestProposalIds(root);
    trivialProposal = await gov.proposals(proposalId);
  });

  describe("simple initialization", () => {
    it("ID is set to a globally unique identifier", async () => {
      assert.strictEqual(trivialProposal.id.toString(), proposalId.toString());
    });

    it("Proposer is set to the sender", async () => {
      assert.strictEqual(trivialProposal.proposer, root);
    });

    it("Start block is set to the current block number plus vote delay", async () => {
      assert.strictEqual(trivialProposal.startBlock.toString(), proposalBlock + 1 + "");
    });

    it("End block is set to the current block number plus the sum of vote delay and vote period", async () => {
      assert.strictEqual(trivialProposal.endBlock.toString(), proposalBlock + 1 + 17280 + "");
    });

    it("ForVotes and AgainstVotes are initialized to zero", async () => {
      assert.strictEqual(trivialProposal.forVotes.toString(), '0');
      assert.strictEqual(trivialProposal.againstVotes.toString(), '0');
    });

    it("Executed and Canceled flags are initialized to false", async () => {
      assert.strictEqual(trivialProposal.canceled, false);
      assert.strictEqual(trivialProposal.executed, false);
    });

    it("ETA is initialized to zero", async () => {
      assert.strictEqual(trivialProposal.eta.toString(), '0');
    });

    it("Targets, Values, Signatures, Calldatas are set according to parameters", async () => {
      let dynamicFields = await gov.getActions(trivialProposal.id);
      assert.strictEqual(dynamicFields.targets.length, targets.length);
      for (var i = 0; i < targets.length; i++) {
        assert.strictEqual(dynamicFields.targets[i].toString(), targets[i].toString());
      }
      assert.strictEqual(dynamicFields.values.length, values.length);
      for (var i = 0; i < values.length; i++) {
        assert.strictEqual(dynamicFields.values[i].toString(), values[i].toString());
      }
      assert.strictEqual(dynamicFields.signatures.length, signatures.length);
      for (var i = 0; i < signatures.length; i++) {
        assert.strictEqual(dynamicFields.signatures[i].toString(), signatures[i].toString());
      }
      assert.strictEqual(dynamicFields.calldatas.length, callDatas.length);
      for (var i = 0; i < callDatas.length; i++) {
        assert.strictEqual(dynamicFields.calldatas[i].toString(), callDatas[i].toString());
      }
    });

    describe("This function must revert if", () => {
      it.skip("the length of the values, signatures or calldatas arrays are not the same length, - NEEDS TO USE LOCALHOST", async () => {
        await TruffleAssert.reverts(
          gov.propose(targets.concat(root), values, signatures, callDatas, 'do nothing'),
          "GovernorBravo::propose: proposal function information arity mismatch",
        );
        
        await TruffleAssert.reverts(
          gov.propose(targets, values.concat(['0']), signatures, callDatas, 'do nothing'),
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

      it.skip("or if that length is zero or greater than Max Operations. - NEEDS TO USE LOCALHOST", async () => {
        await network.provider.send("evm_setAutomine", [false]);
        await network.provider.send("evm_setIntervalMining", [1000]);
        await TruffleAssert.reverts(
          gov.propose([], [], [], [], 'do nothing'),
          "GovernorBravo::propose: must provide actions",
        );
      });

      // TODO: These tests require control over mining, i.e. manual mining.
      describe("Additionally, if there exists a pending or active proposal from the same proposer, we must revert.", () => {
        it.skip("reverts with pending - NEEDS TO USE LOCALHOST", async () => {
          await network.provider.send("evm_setAutomine", [false]);
          await network.provider.send("evm_setIntervalMining", [1000]);
          await TruffleAssert.reverts(
            gov.propose(targets, values, signatures, callDatas, 'do nothing'),
            "GovernorBravo::propose: one live proposal per proposer, found an already pending proposal",
          );
        });

        it.skip("reverts with active  - NEEDS TO USE LOCALHOST", async () => {
          await network.provider.send("evm_setAutomine", [false]);
          await network.provider.send("evm_setIntervalMining", [1000]);
          await network.provider.send("evm_mine")
          await network.provider.send("evm_mine")

          await TruffleAssert.reverts(
            gov.propose(targets, values, signatures, callDatas, 'do nothing'),
            "GovernorBravo::propose: one live proposal per proposer, found an already active proposal",
          );
        });
      });
    });

    it("This function returns the id of the newly created proposal. # proposalId(n) = succ(proposalId(n-1))", async () => {
      await network.provider.send("evm_setAutomine", [false]);
      await network.provider.send("evm_setIntervalMining", [1000]);

      await comp.transfer(accounts[2], etherMantissa(400001));
      await comp.delegate(accounts[2], { from: accounts[2] });
      await network.provider.send("evm_mine")

      let nextProposalId = await gov.propose.call(targets, values, signatures, callDatas, "yoot", { from: accounts[2] });
      // let nextProposalId = await call(gov, 'propose', [targets, values, signatures, callDatas, "second proposal"], { from: accounts[2] });
      await network.provider.send("evm_mine")

      assert.strictEqual(+nextProposalId, +trivialProposal.id + 1);
    });

    it("emits log with id and description", async () => {
      await network.provider.send("evm_setAutomine", [false]);
      await network.provider.send("evm_setIntervalMining", [1000]);

      await comp.transfer(accounts[3], etherMantissa(400001));
      await comp.delegate(accounts[3], { from: accounts[3] });
      await network.provider.send("evm_mine")
      let nextProposalId = await gov.propose.call(targets, values, signatures, callDatas, "yoot", { from: accounts[3] });

      const tx = await gov.propose(targets, values, signatures, callDatas, "second proposal", { from: accounts[3] });
      const log = tx.receipt.logs[0];
      assert.strictEqual(log.event, "ProposalCreated");
      assert.strictEqual(log.args.id.toString(), nextProposalId.toString());
      assert.strictEqual(log.args.description, "second proposal");
      assert.strictEqual(log.args.proposer, accounts[3]);
      assert.strictEqual(log.args.targets.length, targets.length);
      for (var i = 0; i < targets.length; i++) {
        assert.strictEqual(log.args.targets[i].toString(), targets[i].toString());
      }
      assert.strictEqual(log.args.values.length, values.length);
      for (var i = 0; i < values.length; i++) {
        assert.strictEqual(log.args.values[i].toString(), values[i].toString());
      }
      assert.strictEqual(log.args.signatures.length, signatures.length);
      for (var i = 0; i < signatures.length; i++) {
        assert.strictEqual(log.args.signatures[i].toString(), signatures[i].toString());
      }
      assert.strictEqual(log.args.calldatas.length, callDatas.length);
      for (var i = 0; i < callDatas.length; i++) {
        assert.strictEqual(log.args.calldatas[i].toString(), callDatas[i].toString());
      }
    });
  });

  after(async () => {
    await network.provider.send("evm_setAutomine", [true]);
  });
});
