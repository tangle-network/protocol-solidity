const assert = require('assert');
const TruffleAssert = require('truffle-assertions');
import { ethers, network } from 'hardhat';
import { toFixedHex, toHex, MerkleTree, MerkleProof } from '@webb-tools/sdk-core';
import { BigNumber, BigNumberish } from 'ethers';
import { solidityPack } from 'ethers/lib/utils';
import { getChainIdType } from '@webb-tools/utils';
import { OpenVAnchor } from '@webb-tools/anchors';
import { ERC20PresetMinterPauser__factory, KeccakHasher__factory } from '../../typechain';
import { startGanacheServer } from '@webb-tools/test-utils';
import { CircomUtxo } from '@webb-tools/sdk-core';
import { DeployerConfig, GovernorConfig } from '@webb-tools/interfaces';
import { HARDHAT_PK_1 } from '../../hardhatAccounts.js';
import { OpenVBridge, VBridgeInput } from '@webb-tools/vbridge';
import { MintableToken, FungibleTokenWrapper } from '@webb-tools/tokens';

function sha3Hash(left: BigNumberish, right: BigNumberish) {
  const packed = solidityPack(['bytes32', 'bytes32'], [toFixedHex(left), toFixedHex(right)]);
  return BigNumber.from(ethers.utils.keccak256(ethers.utils.arrayify(packed)));
}

describe('Open VAnchor Contract', () => {
  let sender;
  let openVAnchor;
  let token;
  let tokenDenomination = '1000000000000000000'; // 1 ether
  let chainId;
  let recipient;
  const relayingFee = BigNumber.from(0);

  beforeEach(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    recipient = signers[1];
    chainId = getChainIdType(await sender.getChainId());
    // create token
    let tokenName: string = 'existingERC20';
    let tokenAbbreviation: string = 'EXIST';
    token = await MintableToken.createToken(tokenName, tokenAbbreviation, sender);
    await token.mintTokens(await sender.getAddress(), BigNumber.from(tokenDenomination));
    const hasherFactory = new KeccakHasher__factory(wallet);
    const hasher = await hasherFactory.deploy();
    await hasher.deployed();

    const webbToken = await FungibleTokenWrapper.createFungibleTokenWrapper(
      'WEBB',
      'WEBB',
      0,
      await sender.getAddress(),
      await sender.getAddress(),
      '1000000000000000',
      false,
      sender
    );
    await webbToken.contract.add(token.contract.address, 1);

    openVAnchor = await OpenVAnchor.createOpenVAnchor(
      30,
      hasher.address,
      sender.address,
      webbToken.contract.address,
      sender
    );
    // Allow the contracts to spend the token
    let tx = await token.approveSpending(webbToken.contract.address);
    await tx.wait();

    await webbToken.grantMinterRole(openVAnchor.contract.address);
    await openVAnchor.contract.configureMaximumDepositLimit(BigNumber.from(10_000_000_000), 1);
    await openVAnchor.contract.configureMinimalWithdrawalLimit(
      BigNumber.from(tokenDenomination).mul(1_000_000),
      2
    );
  });

  it('should deposit and withdraw', async () => {
    let blinding = BigNumber.from(1010101010);
    const delegatedCalldata = '0x00';
    // Wrap and deposit
    await openVAnchor.wrapAndDeposit(
      chainId,
      BigNumber.from(10_000),
      await recipient.getAddress(),
      delegatedCalldata,
      blinding,
      relayingFee,
      token.contract.address
    );

    // Merkle Proof Generation
    const delHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'));
    const prehashed = solidityPack(
      ['uint48', 'uint256', 'address', 'bytes32', 'uint256', 'uint256'],
      [chainId, 10000, await recipient.getAddress(), delHash, blinding, relayingFee]
    );

    // Step 1: Get Commitment
    let commitment = ethers.utils.keccak256(ethers.utils.arrayify(prehashed));

    // Step 2: Insert into Merkle Tree
    let mt = new MerkleTree(30, [], { hashFunction: sha3Hash });
    // Step 3: Get Merkle Proof and leaf Index of commitment
    mt.insert(commitment);
    let commitmentIndex = mt.indexOf(commitment);
    let merkleProof = mt.path(commitmentIndex);
    // let merkleProof = merkleProofData.pathElements;
    // let root = merkleProofData.merkleRoot;
    // Withdraw
    await openVAnchor.withdrawAndUnwrap(
      BigNumber.from(10000),
      await recipient.getAddress(),
      delegatedCalldata,
      blinding,
      relayingFee,
      merkleProof,
      commitmentIndex,
      token.contract.address
    );
  });

  it('should not withdraw with wrong chain id', async () => {
    // Deposit
    let blinding = BigNumber.from(1010101010);
    const delegatedCalldata = '0x00';
    // Deposit
    //Wrong chain id
    chainId = getChainIdType(31338);
    await openVAnchor.wrapAndDeposit(
      chainId,
      BigNumber.from(10000),
      await recipient.getAddress(),
      delegatedCalldata,
      blinding,
      relayingFee,
      token.contract.address
    );

    // Merkle Proof Generation
    const delHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'));
    const prehashed = solidityPack(
      ['uint48', 'uint256', 'address', 'bytes32', 'uint256', 'uint256'],
      [chainId, 10000, await recipient.getAddress(), delHash, blinding, relayingFee]
    );

    // Step 1: Get Commitment
    let commitment = ethers.utils.keccak256(ethers.utils.arrayify(prehashed));

    // Step 2: Insert into Merkle Tree
    let mt = new MerkleTree(30, [], { hashFunction: sha3Hash });
    // Step 3: Get Merkle Proof and leaf Index of commitment
    mt.insert(commitment);
    let commitmentIndex = mt.indexOf(commitment);
    let merkleProof = mt.path(commitmentIndex);

    // Withdraw
    await TruffleAssert.reverts(
      openVAnchor.withdraw(
        BigNumber.from(10000),
        await recipient.getAddress(),
        delegatedCalldata,
        blinding,
        relayingFee,
        merkleProof,
        commitmentIndex
      ),
      'Invalid Merkle Proof'
    );
  });
});

describe('Open VAnchor Contract - cross chain', () => {
  const FIRST_CHAIN_ID = 31337;
  let hardhatWallet1 = new ethers.Wallet(HARDHAT_PK_1, ethers.provider);
  let sender;
  let recipient;
  let tokenInstance1;
  let tokenInstance2;
  let tokenName: string = 'existingERC20';
  let tokenAbbreviation: string = 'EXIST';
  let bridge2WebbEthInput: VBridgeInput;
  const relayingFee = BigNumber.from(0);

  const SECOND_CHAIN_ID = 10001;
  let ganacheProvider2 = new ethers.providers.JsonRpcProvider(
    `http://localhost:${SECOND_CHAIN_ID}`
  );
  ganacheProvider2.pollingInterval = 1;
  let ganacheWallet2 = new ethers.Wallet(
    'c0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
    ganacheProvider2
  );
  const chainID1 = getChainIdType(FIRST_CHAIN_ID);
  const chainID2 = getChainIdType(SECOND_CHAIN_ID);
  // setup ganache networks
  let ganacheServer2: any;

  before(async () => {
    const signers = await ethers.getSigners();
    const wallet = signers[0];
    sender = wallet;
    recipient = signers[1];
    ganacheServer2 = await startGanacheServer(SECOND_CHAIN_ID, SECOND_CHAIN_ID, [
      {
        balance: '0x1000000000000000000000',
        secretKey: '0xc0d375903fd6f6ad3edafc2c5428900c0757ce1da10e5dd864fe387b32b91d7e',
      },
    ]);
    await ganacheProvider2.ready;
    // Create a token on first chain
    tokenInstance1 = await MintableToken.createToken(tokenName, tokenAbbreviation, sender);
    // Create a token on second chain
    tokenInstance2 = await MintableToken.createToken(tokenName, tokenAbbreviation, ganacheWallet2);
    await tokenInstance2.mintTokens(ganacheWallet2.address, BigNumber.from('1000000000'));
  });

  it('should deposit and withdraw cross chain', async () => {
    const depositAmount = 10000;
    const blinding = 1010101;

    let webbTokens1 = new Map<number, FungibleTokenWrapper | undefined>();
    webbTokens1.set(chainID1, null!);
    webbTokens1.set(chainID2, null!);
    bridge2WebbEthInput = {
      vAnchorInputs: {
        asset: {
          [chainID1]: [tokenInstance1.contract.address],
          [chainID2]: [tokenInstance2.contract.address],
        },
      },
      chainIDs: [chainID1, chainID2],
      webbTokens: webbTokens1,
    };

    const deploymentConfig: DeployerConfig = {
      [chainID1]: hardhatWallet1,
      [chainID2]: ganacheWallet2,
    };

    const initialGovernorsConfig: GovernorConfig = {
      [chainID1]: await hardhatWallet1.getAddress(),
      [chainID2]: await ganacheWallet2.getAddress(),
    };
    const vBridge = await OpenVBridge.deployVariableAnchorBridge(
      bridge2WebbEthInput,
      deploymentConfig,
      initialGovernorsConfig
    );
    // Should be able to retrieve individual anchors
    const vAnchor1: OpenVAnchor = vBridge.getVAnchor(chainID1)! as OpenVAnchor;
    const vAnchor2: OpenVAnchor = vBridge.getVAnchor(chainID2)! as OpenVAnchor;

    const webbTokenAddress2 = vBridge.getWebbTokenAddress(chainID2);
    const webbToken2 = await MintableToken.tokenFromAddress(webbTokenAddress2!, ganacheWallet2);
    const ganacheWallet2BalanceBefore = await webbToken2.getBalance(
      await ganacheWallet2.getAddress()
    );
    assert.strictEqual(
      BigNumber.from(ganacheWallet2BalanceBefore).toString(),
      BigNumber.from(0).toString()
    );

    const webbTokenAddress1 = vBridge.getWebbTokenAddress(chainID1);
    const webbToken1 = await MintableToken.tokenFromAddress(webbTokenAddress1!, recipient);
    const recipientBalanceBefore = await webbToken1.getBalance(await recipient.getAddress());
    assert.strictEqual(
      BigNumber.from(recipientBalanceBefore).toString(),
      BigNumber.from(0).toString()
    );

    await vAnchor1.setSigner(sender);
    await vAnchor1.wrapAndDeposit(
      chainID2,
      BigNumber.from(0),
      await sender.getAddress(),
      '0x00',
      blinding,
      relayingFee,
      tokenInstance1.contract.address
    );
    // GanacheWallet2 wants to send `depositAmount` tokens to the `recipient` on chain 1.
    await vAnchor2.setSigner(ganacheWallet2);
    // First GanacheWallet2 must approve the `webbToken2` to spend `tokenInstance2` tokens.
    let tx = await tokenInstance2.approveSpending(webbToken2.contract.address);
    await tx.wait();
    // Then, GanacheWallet2 can deposit `depositAmount` tokens to the vanchor2.
    await vAnchor2.wrapAndDeposit(
      chainID1,
      BigNumber.from(depositAmount),
      await recipient.getAddress(),
      '0x00',
      blinding,
      relayingFee,
      tokenInstance2.contract.address
    );
    await vBridge.update(chainID1);
    await vBridge.update(chainID2);
    let edgeIndex = await vAnchor1.contract.edgeIndex(chainID2);
    const destAnchorEdge2Before = await vAnchor1.contract.edgeList(edgeIndex);
    // Merkle Proof Generation
    const delHash = ethers.utils.keccak256(ethers.utils.arrayify('0x00'));
    const prehashed = solidityPack(
      ['uint48', 'uint256', 'address', 'bytes32', 'uint256', 'uint256'],
      [chainID1, depositAmount, await recipient.getAddress(), delHash, blinding, relayingFee]
    );

    let commitment = vAnchor2.getCommitment(
      chainID1,
      depositAmount,
      await recipient.getAddress(),
      '0x00',
      blinding,
      relayingFee
    );
    assert.strictEqual(ethers.utils.keccak256(ethers.utils.arrayify(prehashed)), commitment);

    let mt = new MerkleTree(30, [], { hashFunction: sha3Hash });
    // Step 3: Get Merkle Proof and leaf Index of commitment
    mt.insert(toFixedHex(BigNumber.from(commitment)));
    let commitmentIndex = mt.indexOf(commitment);
    let merkleProof = mt.path(commitmentIndex);
    await vAnchor1.withdraw(
      depositAmount,
      await recipient.getAddress(),
      '0x00',
      blinding,
      relayingFee,
      merkleProof,
      commitmentIndex
    );

    const recipientBalanceAfter = await webbToken1.getBalance(await recipient.getAddress());
    assert.strictEqual(
      recipientBalanceAfter.toString(),
      recipientBalanceBefore.add(depositAmount).toString()
    );
  });
});
