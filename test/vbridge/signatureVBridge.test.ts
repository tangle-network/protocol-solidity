/**
 * Copyright 2021 Webb Technologies
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
const TruffleAssert = require('truffle-assertions');
const assert = require('assert');
import { ethers } from 'hardhat';

// Convenience wrapper classes for contract classes
import { VBridge, VBridgeInput } from '../../packages/vbridge/src';
import { VAnchor } from '../../packages/anchors/src';
import { MintableToken, GovernedTokenWrapper } from '../../packages/tokens/src';
import { BigNumber } from 'ethers';
import { getChainIdType, Utxo } from '../../packages/utils/src';
import { startGanacheServer } from '../helpers/startGanacheServer';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('multichain tests for signature vbridge', () => {
  const chainID1 = getChainIdType(31337);
  const chainID2 = getChainIdType(1337);
  const chainID3 = getChainIdType(9999);
  const chainID4 = getChainIdType(4444);
  // setup ganache networks
  let ganacheServer2: any;
  let ganacheServer3: any;
  let ganacheServer4: any;

  before('setup networks', async () => {
    ganacheServer2 = await startGanacheServer(1337, 1337, 'congress island collect purity dentist team gas unlock nuclear pig combine sight');
    ganacheServer3 = await startGanacheServer(9999, 9999, 'aspect biology suit thought bottom popular custom rebuild recall sauce endless local');
    ganacheServer4 = await startGanacheServer(4444, 4444, 'harvest useful giraffe swim rail ostrich public awful provide amazing tank weapon');
  });

  describe('BridgeConstruction', () => {
    let bridge2WebbEthInput: VBridgeInput;
    let bridge3WebbEthInput: VBridgeInput;
    let tokenName: string = 'existingERC20';
    let tokenAbbreviation: string = 'EXIST';
    let tokenInstance1: MintableToken;
    let tokenInstance2: MintableToken;
    let tokenInstance3: MintableToken;

    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:1337');
    ganacheProvider2.pollingInterval = 1;
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
    let ganacheProvider3 = new ethers.providers.JsonRpcProvider('http://localhost:9999');
    ganacheProvider3.pollingInterval = 1;
    let ganacheWallet3 = new ethers.Wallet('745ee040ef2b087f075dc7d314fa06797ed2ffd4ab59a4cc35c0a33e8d2b7791', ganacheProvider3);

    before('construction-tests', async () => {
      const signers = await ethers.getSigners();

      await ganacheProvider2.ready;

      // Create a token to test bridge construction support for existing tokens
      tokenInstance1 = await MintableToken.createToken(tokenName, tokenAbbreviation, signers[7]);
      tokenInstance2 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet2);
      tokenInstance3 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet3);

      await tokenInstance1.mintTokens(signers[2].address, '100000000000000000000000000');
    });

    it.only('create 2 side bridge for one token', async () => {
      let webbTokens1 = new Map<number, GovernedTokenWrapper | undefined>();
      webbTokens1.set(chainID1, null!);
      webbTokens1.set(chainID2, null!);
      bridge2WebbEthInput = {
        vAnchorInputs: {
          asset: {
            [chainID1]: [tokenInstance1.contract.address],
            [chainID2]: [tokenInstance2.contract.address],
          }
      },
        chainIDs: [chainID1, chainID2],
        webbTokens: webbTokens1
      };
      const signers = await ethers.getSigners();

      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
      };
      const vBridge = await VBridge.deployVariableAnchorBridge(bridge2WebbEthInput, deploymentConfig);
      // Should be able to retrieve individual anchors
      const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
      const vAnchor2: VAnchor = vBridge.getVAnchor(chainID2)! as VAnchor;
      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      const webbTokenAddress = vBridge.getWebbTokenAddress(chainID1);
      const webbToken = await MintableToken.tokenFromAddress(webbTokenAddress!, signers[1]);
      const tx = await webbToken.mintTokens(signers[2].address, '100000000000000000000000');
      // Get the state of anchors before deposit
      const sourceAnchorRootBefore = await vAnchor1.contract.getLastRoot();
      //console.log(sourceAnchorRootBefore);
      // Define inputs/outputs for transact function
      const depositUtxo = new Utxo({
        amount: BigNumber.from(1e7),
        originChainId: BigNumber.from(chainID1),
        chainId: BigNumber.from(chainID1)
      });
      // Transact on the bridge
      await vBridge.transact([], [depositUtxo], 0, '0', '0', signers[2]); 
      // Check the state of anchors after deposit
      let edgeIndex = await vAnchor2.contract.edgeIndex(chainID1);

      const sourceAnchorRootAfter = await vAnchor1.contract.getLastRoot();
      const destAnchorEdgeAfter = await vAnchor2.contract.edgeList(edgeIndex);

      // make sure the roots / anchors state have changed
      assert.notEqual(sourceAnchorRootAfter, sourceAnchorRootBefore);
      assert.deepEqual(ethers.BigNumber.from(1), destAnchorEdgeAfter.latestLeafIndex);

      const transferUtxo = new Utxo({
        originChainId: BigNumber.from(chainID1),
        amount: BigNumber.from(1e7),
        keypair: depositUtxo.keypair
      });

      await vBridge.transact([depositUtxo], [transferUtxo], 0, '0', '0', signers[2]);
    });
  });

  describe('2 sided bridge existing token use', () => {
    // ERC20 compliant contracts that can easily create balances for test
    let existingToken1: MintableToken;
    let existingToken2: MintableToken;

    let vBridge: VBridge;
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:1337');
    ganacheProvider2.pollingInterval = 1;
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    before(async () => {
      const signers = await ethers.getSigners();

      existingToken1 = await MintableToken.createToken('existingERC20', 'EXIST', signers[1]);
      // Use some other signer with provider on other chain
      existingToken2 = await MintableToken.createToken('existingERC20', 'EXIST', ganacheWallet2);

      // mint some tokens to the user of the bridge
      await existingToken1.mintTokens(signers[1].address, '100000000000000000000000000');
      await existingToken2.mintTokens(ganacheWallet2.address, '100000000000000000000000000');
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      let webbTokens1 = new Map<number, GovernedTokenWrapper | undefined>();
      webbTokens1.set(chainID1, null!);
      webbTokens1.set(chainID2, null!);
      // create the config for the bridge
      const vBridgeInput = {
        vAnchorInputs: {
          asset: {
            [chainID1]: [existingToken1.contract.address],
            [chainID2]: [existingToken2.contract.address],
          }
        },
        chainIDs: [chainID1, chainID2],
        webbTokens: webbTokens1
      }

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
      }

      // deploy the bridge
      vBridge = await VBridge.deployVariableAnchorBridge(vBridgeInput, deploymentConfig);

      // make one deposit so the  edge exists
      const depositUtxo1 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID2)})
      const depositUtxo2 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)})

      // Should be able to retrieve the token address (so we can mint tokens for test scenario)
      const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
      const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
      const tx1 = await webbToken1.mintTokens(signers[1].address, '100000000000000000000000');

      const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainID2);
      const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
      const tx2 = await webbToken2.mintTokens(ganacheWallet2.address, '100000000000000000000000');

      //Transact on the bridge
      await vBridge.transact([], [depositUtxo1], 0, '0', '0', signers[1]); 
      await vBridge.transact([], [depositUtxo2], 0, '0', '0', ganacheWallet2); 
      //Now there is a bidirectional edge between chain1 and chain2
    })

    describe('#bridging', () => {
      it.only('basic ganache deposit should withdraw on hardhat', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        const vAnchor1Address = vAnchor1.contract.address;
        let edgeIndex = await vAnchor1.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
        const signers2BalanceBefore = await webbToken1.getBalance(await signers[2].getAddress());
        
        //ganacheWallet2 makes a deposit with dest chain chainID1
        const ganacheDepositUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        await vBridge.transact([], [ganacheDepositUtxo], 0, '0', '0', ganacheWallet2);

        //check latest leaf index is incremented
        const destAnchorEdge2After = await vAnchor1.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

        //withdraw ganacheWallet2 deposit on chainID1 to signers[2] address
        const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(5e6), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)})
        await vBridge.transact([ganacheDepositUtxo], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[2]); 
        const signers2BalanceAfter = await webbToken1.getBalance(await signers[2].getAddress());
        assert.strictEqual(signers2BalanceBefore.add(5e6).toString(), signers2BalanceAfter.toString());
      }).timeout(40000)

      it.only('join and split ganache deposits and withdraw on hardhat', async () => {
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        let edgeIndex = await vAnchor1.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
        const signers2BalanceBefore = await webbToken1.getBalance(await signers[2].getAddress());

        //ganacheWallet2 makes a deposit with dest chain chainID1
        const ganacheDepositUtxo1 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});
        const ganacheDepositUtxo2 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1), keypair: ganacheDepositUtxo1.keypair});

        await vBridge.transact([], [ganacheDepositUtxo1], 0, '0', '0', ganacheWallet2);
        await vBridge.transact([], [ganacheDepositUtxo2], 0, '0', '0', ganacheWallet2);

        //check latest leaf index is incremented
        const destAnchorEdge2After = await vAnchor1.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(4), destAnchorEdge2After.latestLeafIndex);
        
        //withdraw ganacheWallet2 deposit on chainID1 to signers[2] address
        const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(5e6), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)})
        await vBridge.transact([ganacheDepositUtxo1, ganacheDepositUtxo2], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[2]); 
        
        const signers2BalanceAfter = await webbToken1.getBalance(await signers[2].getAddress());
        assert.strictEqual(signers2BalanceBefore.add(1.5e7).toString(), signers2BalanceAfter.toString());
      })

      it.only('should update multiple deposits and withdraw historic deposit from ganache', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        let edgeIndex = await vAnchor1.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
        const startingBalanceDest = await webbToken1.getBalance(signers[1].address);

        //ganacheWallet2 makes a deposit with dest chain chainID1
        const ganacheDepositUtxo1 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        const ganacheDepositUtxo2 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        await vBridge.transact([], [ganacheDepositUtxo1], 0, '0', '0', ganacheWallet2);
        await vBridge.transact([], [ganacheDepositUtxo2], 0, '0', '0', ganacheWallet2);

        // Check the leaf index is incremented by two
        const destAnchorEdge2After = await vAnchor1.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(4), destAnchorEdge2After.latestLeafIndex);

        //withdraw ganacheWallet2 deposit on chainID1 to signers[2] address
        const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(5e6), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)})
        await vBridge.transact([ganacheDepositUtxo1], [hardhatWithdrawUtxo], 0, await signers[1].getAddress(), '0', signers[2]); 

        // // Check balances
        const endingBalanceDest = await webbToken1.getBalance(signers[1].address);
        assert.deepStrictEqual(endingBalanceDest, startingBalanceDest.add(5e6));
      })

      it.only('prevent cross-chain double spending', async () => {
        const signers = await ethers.getSigners();

        //ganacheWallet2 makes a deposit with dest chain chainID1
        const ganacheDepositUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        const hardhatUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)});

        await vBridge.transact([], [ganacheDepositUtxo], 0, '0', '0', ganacheWallet2);
        await vBridge.transact([ganacheDepositUtxo], [hardhatUtxo], 0, '0', '0', signers[2]);
        await TruffleAssert.reverts(
          vBridge.transact([ganacheDepositUtxo], [hardhatUtxo], 0, '0', '0', signers[2]),
          'Input is already spent'
        );
      })

      it.only('mintable token task test', async () => {
        // Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        const vAnchor1Address = vAnchor1.contract.address;
        let edgeIndex = await vAnchor1.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
        const signers2BalanceBefore = await webbToken1.getBalance(await signers[2].getAddress());
        
        //ganacheWallet2 makes a deposit with dest chain chainID1
        const ganacheDepositUtxo = new Utxo({amount: BigNumber.from(5e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        await vBridge.transact([], [ganacheDepositUtxo], 0, '0', '0', ganacheWallet2);

        //Check that deposit went through
        const vAnchor2: VAnchor = vBridge.getVAnchor(chainID2)! as VAnchor;
        const vAnchor2Address = vAnchor2.contract.address;
        const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainID2);
        const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
        assert.strictEqual((await webbToken2.getBalance(vAnchor2Address)).toString(), BigNumber.from(6e7).toString());

        //Balance in VAnchor1 is 1e7
        assert.strictEqual((await webbToken1.getBalance(vAnchor1Address)).toString(), BigNumber.from(1e7).toString());

        //check latest leaf index is incremented
        const destAnchorEdge2After = await vAnchor1.contract.edgeList(edgeIndex);
        assert.deepStrictEqual(destAnchorEdge2Before.latestLeafIndex.add(2), destAnchorEdge2After.latestLeafIndex);

        //withdrawing 3e7 from ganacheWallet2 deposit on chainID1 should work despite vanchor1 only having 1e7 webb tokens...this indicates that it minted 2e7 webb tokens to make up the balance
        const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(2e7), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)})
        await vBridge.transact([ganacheDepositUtxo], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[2]); 
        const signers2BalanceAfter = await webbToken1.getBalance(await signers[2].getAddress());
        assert.strictEqual(signers2BalanceBefore.add(3e7).toString(), signers2BalanceAfter.toString());
        assert.strictEqual((await webbToken1.getBalance(vAnchor1Address)).toString(), BigNumber.from(1e7).toString());
      })
    })
  })

  describe('2 sided bridge existing token test wrapping functionality', () => {
    // ERC20 compliant contracts that can easily create balances for test
    let existingToken1: MintableToken;
    let existingToken2: MintableToken;

    let vBridge: VBridge;
    let ganacheProvider2 = new ethers.providers.JsonRpcProvider('http://localhost:chainID2');
    ganacheProvider2.pollingInterval = 1;
    let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);

    before(async () => {
      const signers = await ethers.getSigners();

      existingToken1 = await MintableToken.createToken('existingERC20', 'EXIST', signers[1]);
      // Use some other signer with provider on other chain
      existingToken2 = await MintableToken.createToken('existingERC20', 'EXIST', ganacheWallet2);

      // mint some tokens to the user of the bridge
      await existingToken1.mintTokens(signers[1].address, '100000000000000000000000000');
      await existingToken2.mintTokens(ganacheWallet2.address, '100000000000000000000000000');
    })

    beforeEach(async () => {
      const signers = await ethers.getSigners();
      let webbTokens1 = new Map<number, GovernedTokenWrapper | undefined>();
      webbTokens1.set(chainID1, null!);
      webbTokens1.set(chainID2, null!);
      // create the config for the bridge
      const vBridgeInput = {
        vAnchorInputs: {
          asset: {
            [chainID1]: [existingToken1.contract.address],
            [chainID2]: [existingToken2.contract.address],
          }
        },
        chainIDs: [chainID1, chainID2],
        webbTokens: webbTokens1
    }

      // setup the config for deployers of contracts (admins)
      const deploymentConfig = {
        [chainID1]: signers[1],
        [chainID2]: ganacheWallet2,
      }

      // deploy the bridge
      vBridge = await VBridge.deployVariableAnchorBridge(vBridgeInput, deploymentConfig);
    
      // make one deposit so the  edge exists
      const depositUtxo1 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID2)});
      const depositUtxo2 = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

      //Transact on the bridge
      await vBridge.transactWrap(existingToken1.contract.address, [], [depositUtxo1], 0, '0', '0', signers[1]); 
      await vBridge.transactWrap(existingToken2.contract.address, [], [depositUtxo2], 0, '0', '0', ganacheWallet2); 
      //Now there is a bidirectional edge between chain1 and chain2
    })

    describe('#bridging wrapping/unwrapping', () => {
      it.only('check there is a bidirectional bridge between the two chains', async () => {
        //Fetch information about the anchor to be updated.
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        const vAnchor1Address = vAnchor1.contract.address;
        const vAnchor2: VAnchor = vBridge.getVAnchor(chainID2)! as VAnchor;
        const vAnchor2Address = vAnchor2.contract.address;
        let edgeIndex12 = await vAnchor1.contract.edgeIndex(chainID2);
        const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex12);
        assert.strictEqual(destAnchorEdge2Before.root.toString(), (await vAnchor2.contract.getLastRoot()).toString());
        let edgeIndex21 = await vAnchor2.contract.edgeIndex(chainID1);
        const destAnchorEdge1Before = await vAnchor2.contract.edgeList(edgeIndex21);
        assert.strictEqual(destAnchorEdge1Before.root.toString(), (await vAnchor1.contract.getLastRoot()).toString());

        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);

        const vAnchor1Balance = await webbToken1.getBalance(vAnchor1Address);
        assert.strictEqual(vAnchor1Balance.toString(), BigNumber.from(1e7).toString());

        const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainID2);
        const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);

        const vAnchor2Balance = await webbToken2.getBalance(vAnchor2Address);
        assert.strictEqual(vAnchor2Balance.toString(), BigNumber.from(1e7).toString());
      })
      it.only('wrap and deposit, withdraw and unwrap works join split via transactWrap', async () => {
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        const vAnchor1Address = vAnchor1.contract.address;
        const vAnchor2: VAnchor = vBridge.getVAnchor(chainID2)! as VAnchor;
        const vAnchor2Address = vAnchor2.contract.address;
        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);

        //Deposit UTXO
        const ganacheDepositUtxo1 = new Utxo({amount: BigNumber.from(2.5e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});
        const ganacheDepositUtxo2 = new Utxo({amount: BigNumber.from(2.5e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        await vBridge.transactWrap(existingToken2.contract.address, [], [ganacheDepositUtxo1, ganacheDepositUtxo2], 0, '0', '0', ganacheWallet2); 

        const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainID2);
        const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
        assert.strictEqual((await webbToken2.getBalance(vAnchor2Address)).toString(), BigNumber.from(6e7).toString());


        //Withdraw UTXO 
        const vAnchor1TokenAddr = await vAnchor1.contract.token()
        await existingToken1.mintTokens(vAnchor1TokenAddr, '100000000');
        const balWrapper1UnwrappedBefore = await existingToken1.contract.balanceOf(vAnchor1TokenAddr);
        const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)})
        await vBridge.transactWrap(existingToken1.contract.address, [ganacheDepositUtxo1, ganacheDepositUtxo2], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[1]);

        //Check relevant balances
        //Unwrapped Balance of signers[2] should be 3e7
        const balSigners2Unwrapped = await existingToken1.contract.balanceOf(await signers[2].getAddress());
        assert.strictEqual(balSigners2Unwrapped.toString(), BigNumber.from(4e7).toString());
        //Unwrapped balance of vanchor1tokenaddr should be
        const balWrapper1UnwrappedAfter = await existingToken1.contract.balanceOf(vAnchor1TokenAddr);
        assert.strictEqual(balWrapper1UnwrappedBefore.sub(BigNumber.from(4e7)).toString(), balWrapper1UnwrappedAfter.toString());
        //wrapped balance of vanchor1 should be 1e7
        const balVAnchor1Wrapped = await webbToken1.getBalance(vAnchor1.contract.address);
        assert.strictEqual(balVAnchor1Wrapped.toString(), BigNumber.from(1e7).toString());
      });

      it.only('wrap and deposit, withdraw and unwrap works join split 16 input via transactWrap', async () => {
        const signers = await ethers.getSigners();

        const vAnchor1: VAnchor = vBridge.getVAnchor(chainID1)! as VAnchor;
        const vAnchor1Address = vAnchor1.contract.address;
        const vAnchor2: VAnchor = vBridge.getVAnchor(chainID2)! as VAnchor;
        const vAnchor2Address = vAnchor2.contract.address;
        const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
        const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);

        //Deposit UTXO
        const ganacheDepositUtxo1 = new Utxo({amount: BigNumber.from(2e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});
        const ganacheDepositUtxo2 = new Utxo({amount: BigNumber.from(2e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});
        const ganacheDepositUtxo3 = new Utxo({amount: BigNumber.from(2e7), originChainId: BigNumber.from(chainID2), chainId: BigNumber.from(chainID1)});

        await vBridge.transactWrap(existingToken2.contract.address, [], [ganacheDepositUtxo1], 0, '0', '0', ganacheWallet2); 

        await vBridge.transactWrap(existingToken2.contract.address, [], [ganacheDepositUtxo2], 0, '0', '0', ganacheWallet2); 

        await vBridge.transactWrap(existingToken2.contract.address, [], [ganacheDepositUtxo3], 0, '0', '0', ganacheWallet2); 

        const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainID2);
        const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
        assert.strictEqual((await webbToken2.getBalance(vAnchor2Address)).toString(), BigNumber.from(7e7).toString());

        const balSigners2UnwrappedBefore = await existingToken1.contract.balanceOf(await signers[2].getAddress());

        //Withdraw UTXO 
        const vAnchor1TokenAddr = await vAnchor1.contract.token()
        await existingToken1.mintTokens(vAnchor1TokenAddr, '100000000');
        const balWrapper1UnwrappedBefore = await existingToken1.contract.balanceOf(vAnchor1TokenAddr);
        const hardhatWithdrawUtxo = new Utxo({amount: BigNumber.from(1e7), originChainId: BigNumber.from(chainID1), chainId: BigNumber.from(chainID1)})
        await vBridge.transactWrap(existingToken1.contract.address, [ganacheDepositUtxo1, ganacheDepositUtxo2, ganacheDepositUtxo3], [hardhatWithdrawUtxo], 0, await signers[2].getAddress(), '0', signers[1]);

        //Check relevant balances
        //Unwrapped Balance of signers[2] should be 3e7
        const balSigners2UnwrappedAfter = await existingToken1.contract.balanceOf(await signers[2].getAddress());
        assert.strictEqual(balSigners2UnwrappedAfter.sub(balSigners2UnwrappedBefore).toString(), BigNumber.from(5e7).toString());
        //Unwrapped balance of vanchor1tokenaddr should be
        const balWrapper1UnwrappedAfter = await existingToken1.contract.balanceOf(vAnchor1TokenAddr);
        assert.strictEqual(balWrapper1UnwrappedBefore.sub(BigNumber.from(5e7)).toString(), balWrapper1UnwrappedAfter.toString());
        //wrapped balance of vanchor1 should be 1e7
        const balVAnchor1Wrapped = await webbToken1.getBalance(vAnchor1.contract.address);
        assert.strictEqual(balVAnchor1Wrapped.toString(), BigNumber.from(1e7).toString());
      }).timeout(40000);
    });
  });

  after('terminate networks', async () => {
    await ganacheServer2.close();
    await ganacheServer3.close();
    await ganacheServer4.close();
  });
});