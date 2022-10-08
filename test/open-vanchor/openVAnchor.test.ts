const assert = require('assert');
import { ethers, network } from 'hardhat';
import BN from 'bn.js';
import { toFixedHex, toHex, MerkleTree, MerkleProof } from '@webb-tools/sdk-core';

import { OpenVAnchor__factory } from '../../typechain';

// Typechain generated bindings for contracts
// These contracts are included in packages, so should be tested
import {
  ERC20PresetMinterPauser,
  ERC20PresetMinterPauser__factory,
  GovernedTokenWrapper as WrappedToken,
  GovernedTokenWrapper__factory as WrappedTokenFactory,
  PoseidonT3__factory
} from '../../packages/contracts/src';
import { BigNumber, BigNumberish } from 'ethers';
import { keccak256, sha3 } from 'web3-utils';

function sha3Hash (left: BigNumberish, right: BigNumberish) {
  return BigNumber.from(sha3(left.toString() + right.toString()));
}

describe('Governable Contract', () => {
    let sender;
    let openVAnchorInstance;
    let token;
    let tokenDenomination = '1000000000000000000' // 1 ether
    let chainId = 31337;
    let recipient;
    beforeEach(async () => {
      const signers = await ethers.getSigners();
      const wallet = signers[0];
      sender = wallet;
      recipient = signers[1];

      // create token
      const tokenFactory = new ERC20PresetMinterPauser__factory(wallet);
      token = await tokenFactory.deploy('test token', 'TEST');
      await token.deployed();
      await token.mint(sender.address, '10000000000000000000000');

      const openVAnchorFactory = new OpenVAnchor__factory(wallet);
      openVAnchorInstance= await openVAnchorFactory.deploy(30, sender.address, token.address,);
      await openVAnchorInstance.deployed();
    });
   
    it('should deposit and withdraw', async () => {
      // Deposit
      await openVAnchorInstance.configureMaximumDepositLimit(BigNumber.from(0),0,);
      await openVAnchorInstance.configureMinimalWithdrawalLimit(BigNumber.from(tokenDenomination).mul(1_000_000),
      0,);
      const MINTER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('MINTER_ROLE'));
      await token.grantRole(MINTER_ROLE, openVAnchorInstance.address);

      await token.approve(token.address, '1000000000000000000');

      let blinding = BigNumber.from(1010101010);
      // Deposit
      await openVAnchorInstance.wrapAndDeposit(10000, chainId, recipient.getAddress(), BigNumber.from(0), token.address, blinding);

      // Merkle Proof Generation
      let prehashed = toFixedHex(chainId) + toFixedHex(10000).slice(2) + toFixedHex(recipient, 20).slice(2) + keccak256('00').slice(2) + toFixedHex(blinding).slice(2);  
      // Step 1: Get Commitment
      let commitment = keccak256(prehashed);
      
      // Step 2: Insert into Merkle Tree
      let mt = new MerkleTree(30, [], {hashFunction: sha3Hash},);
      // Step 3: Get Merkle Proof and leaf Index of commitment
      mt.insert(commitment);
      let commitmentIndex = mt.indexOf(commitment);
      let merkleProofData = mt.path(commitmentIndex);
      let merkleProof = merkleProofData.pathElements;
      let root = merkleProofData.merkleRoot;

      // Withdraw
      await openVAnchorInstance.withdraw(recipient.getAddress(), 10000, BigNumber.from(0), blinding, merkleProof, commitmentIndex, root);
    });
});