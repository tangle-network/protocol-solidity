const assert = require('assert');
const TruffleAssert = require('truffle-assertions');
import { ethers, network } from 'hardhat';
import { toFixedHex, toHex, MerkleTree, MerkleProof } from '@webb-tools/sdk-core';
import { BigNumber, BigNumberish } from 'ethers';
import { solidityPack } from 'ethers/lib/utils';
import { getChainIdType } from '@webb-tools/utils';
import { OpenVAnchor } from '@webb-tools/anchors';
import { ERC20PresetMinterPauser__factory, KeccakHasher__factory } from '@webb-tools/contracts';

function sha3Hash (left: BigNumberish, right: BigNumberish) {
  const packed = solidityPack([ "bytes32", "bytes32"], [toFixedHex(left), toFixedHex(right)]);
  return BigNumber.from(ethers.utils.keccak256(ethers.utils.arrayify(packed)));
}

describe.only('Open VAnchor Contract', () => {
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
      const tokenFactory = new ERC20PresetMinterPauser__factory(wallet);
      token = await tokenFactory.deploy('test token', 'TEST');
      await token.deployed();
      await token.mint(sender.address, '10000000000000000000000');

      // create poseidon hasher
      const hasherFactory = new KeccakHasher__factory(wallet);
      const hasher = await hasherFactory.deploy();
      await hasher.deployed();

      // const openVAnchorFactory = new OpenVAnchor__factory(wallet);
      // openVAnchorInstance= await openVAnchorFactory.deploy(30, sender.address, token.address,);
      openVAnchor = await OpenVAnchor.createOpenVAnchor(
        30,
        hasher.address,
        sender.address,
        token.address,
        sender
      )

      await openVAnchor.contract.configureMaximumDepositLimit(BigNumber.from(10000000000),0,);
      await openVAnchor.contract.configureMinimalWithdrawalLimit(BigNumber.from(tokenDenomination).mul(1_000_000),
      0,);
      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await token.grantRole(MINTER_ROLE, openVAnchor.contract.address);

      await token.approve(token.address, '1000000000000000000');
    });

    it('should deposit and withdraw', async () => {
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
      console.log(commitment);

      // Step 2: Insert into Merkle Tree
      let mt = new MerkleTree(30, [], {hashFunction: sha3Hash},);
      // Step 3: Get Merkle Proof and leaf Index of commitment
      mt.insert(commitment);
      let commitmentIndex = mt.indexOf(commitment);
      console.log('commitment index', commitmentIndex);
      let merkleProof = mt.path(commitmentIndex);
      // let merkleProof = merkleProofData.pathElements;
      // let root = merkleProofData.merkleRoot;
      // Withdraw
      await openVAnchor.withdraw(await recipient.getAddress(), BigNumber.from(10000), delegatedCalldata, blinding, merkleProof, commitmentIndex);
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
      console.log(commitment);

      // Step 2: Insert into Merkle Tree
      let mt = new MerkleTree(30, [], {hashFunction: sha3Hash},);
      // Step 3: Get Merkle Proof and leaf Index of commitment
      mt.insert(commitment);
      let commitmentIndex = mt.indexOf(commitment);
      console.log('commitment index', commitmentIndex);
      let merkleProof = mt.path(commitmentIndex);

      // Withdraw
      await TruffleAssert.reverts(openVAnchor.withdraw(await recipient.getAddress(), 10000, delegatedCalldata, blinding, merkleProof, commitmentIndex), "Invalid root");
    });
});
