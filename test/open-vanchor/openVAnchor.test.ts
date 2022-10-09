const assert = require('assert');
const TruffleAssert = require('truffle-assertions');
import { ethers, network } from 'hardhat';
import { toFixedHex, toHex, MerkleTree, MerkleProof } from '@webb-tools/sdk-core';
import { BigNumber, BigNumberish } from 'ethers';
import { solidityPack } from 'ethers/lib/utils';
import { getChainIdType } from '@webb-tools/utils';
import { OpenVAnchor } from '@webb-tools/anchors';
import { ERC20PresetMinterPauser__factory, KeccakHasher__factory } from '@webb-tools/contracts';
import { startGanacheServer } from '@webb-tools/test-utils';
import { CircomUtxo } from '@webb-tools/sdk-core';
import { DeployerConfig, GovernorConfig } from '@webb-tools/interfaces';
import { HARDHAT_PK_1 } from '../../hardhatAccounts.js';
import { OpenVBridge, VBridgeInput } from '../../packages/vbridge/src';
import { MintableToken, GovernedTokenWrapper } from '../../packages/tokens/src';
import { isCommaListExpression } from 'typescript';
import { VBridge } from 'packages/protocol-solidity/lib/index.js';

function sha3Hash (left: BigNumberish, right: BigNumberish) {
  const packed = solidityPack([ "bytes32", "bytes32"], [toFixedHex(left), toFixedHex(right)]);
  return BigNumber.from(ethers.utils.keccak256(ethers.utils.arrayify(packed)));
}

describe('Open VAnchor Contract', () => {
    let sender;
    let openVAnchor;
    let token;
    let tokenDenomination = '1000000000000000000' // 1 ether
    let chainId;
    let recipient;
    beforeEach(async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      sender = wallet;
      recipient = signers[1];
      chainId = getChainIdType(await sender.getChainId());
      // create token
      let tokenName: string = 'existingERC20';
      let tokenAbbreviation: string = 'EXIST';
      const token = await MintableToken.createToken(tokenName, tokenAbbreviation, signers[7]);
      await token.grantMinterRole(await sender.getAddress());
      const hasherFactory = new KeccakHasher__factory(wallet);
      const hasher = await hasherFactory.deploy();
      await hasher.deployed();

      const webbToken = await GovernedTokenWrapper.createGovernedTokenWrapper("WEBB", "WEBB", await sender.getAddress(), await sender.getAddress(), '1000000000000000', false, sender);
      
      await webbToken.contract.add(token.contract.address, 1);

      openVAnchor = await OpenVAnchor.createOpenVAnchor(
        30,
        hasher.address,
        sender.address,
        webbToken.contract.address,
        sender
      )

      await webbToken.grantMinterRole(openVAnchor.contract.address);

      await openVAnchor.contract.configureMaximumDepositLimit(BigNumber.from(10000000000),0,);
      await openVAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(tokenDenomination).mul(1_000_000),
      0,);
    });

    it.only('should deposit and withdraw', async () => {
      let blinding = BigNumber.from(1010101010);
      // Deposit
      const delegatedCalldata = '0x00'

      await openVAnchor.wrapAndDeposit(
        BigNumber.from(10000),
        chainId,
        await recipient.getAddress(),
        delegatedCalldata,
        blinding
      );

      // Merkle Proof Generation
      const delHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'));
      const prehashed = solidityPack([ "uint48", "uint256", "address", "bytes32", "uint256" ], [ chainId, 10000, await recipient.getAddress(), delHash, blinding]);

      // Step 1: Get Commitment
      let commitment = ethers.utils.keccak256(ethers.utils.arrayify(prehashed));

      // Step 2: Insert into Merkle Tree
      let mt = new MerkleTree(30, [], {hashFunction: sha3Hash},);
      // Step 3: Get Merkle Proof and leaf Index of commitment
      mt.insert(commitment);
      let commitmentIndex = mt.indexOf(commitment);
      let merkleProof = mt.path(commitmentIndex);
      // let merkleProof = merkleProofData.pathElements;
      // let root = merkleProofData.merkleRoot;
      // Withdraw
      await openVAnchor.contract.withdrawAndUnwrap(token.contract.address, await recipient.getAddress(), BigNumber.from(10000), delegatedCalldata, blinding, merkleProof, commitmentIndex);
    });

    it('should not withdraw with wrong chain id', async () => {
      // Deposit
      let blinding = BigNumber.from(1010101010);
      const delegatedCalldata = '0x00'
      // Deposit
      //Wrong chain id
      chainId = getChainIdType(31338);
      await openVAnchor.wrapAndDeposit(10000, chainId, await recipient.getAddress(), delegatedCalldata, token.address, blinding);

      // Merkle Proof Generation
      const delHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'));
      const prehashed = solidityPack([ "uint48", "uint256", "address", "bytes32", "uint256" ], [ chainId, 10000, await recipient.getAddress(), delHash, blinding]);

      // Step 1: Get Commitment
      let commitment = ethers.utils.keccak256(ethers.utils.arrayify(prehashed));

      // Step 2: Insert into Merkle Tree
      let mt = new MerkleTree(30, [], {hashFunction: sha3Hash},);
      // Step 3: Get Merkle Proof and leaf Index of commitment
      mt.insert(commitment);
      let commitmentIndex = mt.indexOf(commitment);
      let merkleProof = mt.path(commitmentIndex);

      // Withdraw
      await TruffleAssert.reverts(openVAnchor.withdraw(await recipient.getAddress(), 10000, delegatedCalldata, blinding, merkleProof, commitmentIndex), "Invalid root");
    });
});

describe('Open VAnchor Contract', () => {
  let sender;
  let openVAnchor;
  let token;
  let tokenDenomination = '1000000000000000000' // 1 ether
  let recipient;
  const FIRST_CHAIN_ID = 31337;
  let hardhatWallet1 = new ethers.Wallet(HARDHAT_PK_1, ethers.provider);
  let tokenInstance1;
  let tokenInstance2;
  let tokenName: string = 'existingERC20';
  let tokenAbbreviation: string = 'EXIST';
  let bridge2WebbEthInput: VBridgeInput;

  const SECOND_CHAIN_ID = 10000;
  let ganacheProvider2 = new ethers.providers.JsonRpcProvider(`http://localhost:${SECOND_CHAIN_ID}`);
  ganacheProvider2.pollingInterval = 1;
  let ganacheWallet2 = new ethers.Wallet('c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e', ganacheProvider2);
  const chainID1 = getChainIdType(FIRST_CHAIN_ID);
  const chainID2 = getChainIdType(SECOND_CHAIN_ID);
  // setup ganache networks
  let ganacheServer2: any;
  before(async () => {
    ganacheServer2 = await startGanacheServer(SECOND_CHAIN_ID, SECOND_CHAIN_ID, [
      {
        balance: '0x1000000000000000000000',
        secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e'
      }
    ]);
    const signers = await ethers.getSigners();
      await ganacheProvider2.ready;
      // Create a token to test bridge construction support for existing tokens
      tokenInstance1 = await MintableToken.createToken(tokenName, tokenAbbreviation, signers[7]);
      tokenInstance2 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet2);
      await tokenInstance1.mintTokens(signers[1].address, '100000000000000000000000000');
      await tokenInstance2.mintTokens(signers[1].address, '100000000000000000000000000');
      const blinding = 101010;
  });
  it ('should deposit and withdraw cross chain', async () => {
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

    const deploymentConfig: DeployerConfig = {
      [chainID1]: hardhatWallet1,
      [chainID2]: ganacheWallet2,
    };

    const initialGovernorsConfig: GovernorConfig = {
      [chainID1]: await hardhatWallet1.getAddress(),
      [chainID2]: await ganacheWallet2.getAddress(),
    };
    const vBridge = await OpenVBridge.deployVariableAnchorBridge(bridge2WebbEthInput, deploymentConfig, initialGovernorsConfig);
    // Should be able to retrieve individual anchors
    const vAnchor1: OpenVAnchor = vBridge.getVAnchor(chainID1)! as OpenVAnchor;
    const vAnchor2: OpenVAnchor = vBridge.getVAnchor(chainID2)! as OpenVAnchor;
    const depositAmount = 10000;
    const blinding = 1010101;
    const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
    const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, signers[1]);
    const signers2BalanceBefore = await webbToken1.getBalance(await signers[2].getAddress());
    assert.strictEqual(BigNumber.from(signers2BalanceBefore).toString(), BigNumber.from(0).toString());
    const recipient = await signers[2].getAddress();
    await vAnchor1.wrapAndDeposit(0, chainID2, recipient, '0x00', blinding);
    await vAnchor2.setSigner(ganacheWallet2);
    await vAnchor2.wrapAndDeposit(depositAmount, chainID1, recipient, '0x00', blinding);
    await vBridge.update(chainID1);
    await vBridge.update(chainID2);
    let edgeIndex = await vAnchor1.contract.edgeIndex(chainID2);
    const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
    // Merkle Proof Generation
    const delHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'));
    const prehashed = solidityPack([ "uint48", "uint256", "address", "bytes32", "uint256" ], [ FIRST_CHAIN_ID, depositAmount, recipient, delHash, blinding]);

    let commitment = vAnchor2.getCommitment(chainID1, depositAmount, recipient, '0x00', blinding);
    let mt = new MerkleTree(30, [], {hashFunction: sha3Hash},);
    // Step 3: Get Merkle Proof and leaf Index of commitment
    mt.insert(toFixedHex(BigNumber.from(commitment)));
    let commitmentIndex = mt.indexOf(commitment);
    let merkleProof = mt.path(commitmentIndex);
    await vAnchor1.withdraw(recipient, depositAmount, '0x00', blinding, merkleProof, commitmentIndex);
    await vAnchor1.contract.unwrap(tokenInstance2.contract.address, depositAmount, recipient);
  });
});
