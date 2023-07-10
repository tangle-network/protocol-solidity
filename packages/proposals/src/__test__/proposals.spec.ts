// Copyright 2022-2023 Webb Technologies Inc.
// SPDX-License-Identifier: Apache-2.0

import { assert } from 'chai';
import { utils } from 'ethers';

import { hexToU8a, u8aToHex } from '@polkadot/util';

import {
  EVMProposal,
  FeeRecipientUpdateProposal,
  MaxDepositLimitProposal,
  MinWithdrawalLimitProposal,
  RefreshProposal,
  RegisterFungibleTokenProposal,
  RegisterNftTokenProposal,
  RescueTokensProposal,
  ResourceIdUpdateProposal,
  SetTreasuryHandlerProposal,
  SetVerifierProposal,
  TokenAddProposal,
  TokenRemoveProposal,
  WrappingFeeUpdateProposal,
} from '../';
import { ProposalHeader } from '../ProposalHeader';
import { AnchorUpdateProposal } from '../ProposalKinds';
import { ResourceId } from '../ResourceId';
import { ChainType } from '@webb-tools/utils';

describe('test various conversion functions', () => {
  it('should encode and decode anchor update proposal types correctly', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);
    const srcChainId = 0xbabe;
    const merkleRoot = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const otherAnchorAddress = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const srcResourceId = new ResourceId(otherAnchorAddress, chainType, srcChainId);
    const updateProposal = new AnchorUpdateProposal(header, merkleRoot, srcResourceId);
    const headerEncoded = header.toU8a();
    const headerDecoded = ProposalHeader.fromBytes(headerEncoded);

    assert.equal(headerDecoded.resourceId.toString(), resourceId.toString());
    assert.equal(u8aToHex(headerDecoded.functionSignature), u8aToHex(functionSignature));
    assert.equal(headerDecoded.nonce, lastLeafIndex);

    const updateProposalEncoded = updateProposal.toU8a();
    const updateProposalDecoded = AnchorUpdateProposal.fromBytes(updateProposalEncoded);

    assert.equal(updateProposalDecoded.header.resourceId.toString(), resourceId.toString());
    assert.equal(
      u8aToHex(updateProposalDecoded.header.functionSignature),
      u8aToHex(functionSignature)
    );
    assert.equal(updateProposalDecoded.header.nonce, lastLeafIndex);
    assert.equal(updateProposalDecoded.merkleRoot, merkleRoot);
    assert.equal(updateProposalDecoded.srcResourceId.toString(), srcResourceId.toString());
  });

  it('Should encode and decode evm proposal', () => {
    const tx = utils.parseTransaction(
      '0x02f901fb018265708414077824850f609e3a0a83012c6f94f4c62b4f8b7b1b1c4ba88bfd3a8ea392641516e98726f8e5ab97bbd5b90184e3a54629000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000050000000000000000000000003696ce3b3d62326bc54ee471b329df7c60d94c2900000000000000000000000000000000000000000000000000091a706b2d1f7e0000000000000000000000002bdf24d26391195668acdf429c26c605b72029700000000000000000000000000000000000000000000000000007c575c8277aaf0000000000000000000000008da6869b882f27a0624e8a6736ef77ade0124adb0000000000000000000000000000000000000000000000000008bbcfdd814df50000000000000000000000006d4d6a996a670f80751f52c9c121710c06512a230000000000000000000000000000000000000000000000000008bc4ae2731e45000000000000000000000000214872c00ef77571916bf6773ab017cb5623b1410000000000000000000000000000000000000000000000000004a0e4b84eb56ec080a04f866699aaaefd51ca25e1202b7c7326184743888c191d2a13a16de013da2f84a07ac203cc7e5a0c7a390f6115be844d85db6892e681a3a7b4eb0f028909802548'
    );

    const evmProposal = new EVMProposal(tx.chainId, tx.nonce, tx);
    const eVMProposalEncoded = evmProposal.toU8a();
    const eVMProposalDecoded = EVMProposal.fromBytes(eVMProposalEncoded);

    assert.equal(eVMProposalDecoded.nonce, tx.nonce);
    assert.equal(eVMProposalDecoded.chainId, tx.chainId);
  });

  it('Should encode and decode refresh vote proposal', () => {
    const merkleRoot = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const averageSessionLength = BigInt(10);
    const voterCount = 3;
    const publicKey = '0x020258d309d321e1108e1f055100b86df5d104ca589c1349e5731ef82b19ade12b';
    const nonce = 0;

    const refreshProposal = new RefreshProposal(
      merkleRoot,
      averageSessionLength,
      voterCount,
      nonce,
      publicKey
    );
    const refreshProposalEncoded = refreshProposal.toU8a();
    const refreshProposalDecoded = RefreshProposal.fromBytes(refreshProposalEncoded);

    assert.equal(refreshProposalDecoded.nonce, nonce);
    assert.equal(refreshProposalDecoded.publicKey, publicKey);
  });

  it('Should encode and decode token add proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newTokenAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const tokenAddProposal = new TokenAddProposal(header, newTokenAddress);
    const tokenAddProposalEncoded = tokenAddProposal.toU8a();
    const tokenAddProposalDecoded = TokenAddProposal.fromBytes(tokenAddProposalEncoded);

    assert.equal(tokenAddProposalDecoded.newTokenAddress, newTokenAddress);
    assert.equal(tokenAddProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode token remove proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const removedTokenAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const tokenRemoveProposal = new TokenRemoveProposal(header, removedTokenAddress);
    const tokenRemoveProposalEncoded = tokenRemoveProposal.toU8a();
    const tokenRemoveProposalDecoded = TokenRemoveProposal.fromBytes(tokenRemoveProposalEncoded);

    assert.equal(tokenRemoveProposalDecoded.removeTokenAddress, removedTokenAddress);
    assert.equal(tokenRemoveProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode wrapping fee update proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newFee = '0x1011';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const wrappingFeeUpdateProposal = new WrappingFeeUpdateProposal(header, newFee);
    const wrappingFeeUpdateProposalEncoded = wrappingFeeUpdateProposal.toU8a();
    const wrappingFeeUpdateProposalDecoded = WrappingFeeUpdateProposal.fromBytes(
      wrappingFeeUpdateProposalEncoded
    );

    assert.equal(wrappingFeeUpdateProposalDecoded.newFee, newFee);
    assert.equal(wrappingFeeUpdateProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode min withdraw limit proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const minWithdrawalLimitBytes =
      '0x0000000000000000000000000000000000000000000000000000000000001111';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const minWithdrawLimitProposal = new MinWithdrawalLimitProposal(
      header,
      minWithdrawalLimitBytes
    );
    const minWithdrawLimitProposalEncoded = minWithdrawLimitProposal.toU8a();
    const minWithdrawLimitProposalDecoded = MinWithdrawalLimitProposal.fromBytes(
      minWithdrawLimitProposalEncoded
    );

    assert.equal(minWithdrawLimitProposalDecoded.minWithdrawalLimitBytes, minWithdrawalLimitBytes);
    assert.equal(minWithdrawLimitProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode max deposit limit proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const maxDepositLimitBytes =
      '0x0000000000000000000000000000000000000000000000000000000000001111';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const maxDepositLimitProposal = new MaxDepositLimitProposal(header, maxDepositLimitBytes);
    const maxDepositLimitProposalEncoded = maxDepositLimitProposal.toU8a();
    const maxDepositLimitProposalDecoded = MaxDepositLimitProposal.fromBytes(
      maxDepositLimitProposalEncoded
    );

    assert.equal(maxDepositLimitProposalDecoded.maxDepositLimitBytes, maxDepositLimitBytes);
    assert.equal(maxDepositLimitProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode resourceId update proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const handlerAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabb';
    const chainId = 0xcafe;
    const chainId2 = 0xcafa;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const newResourceId = new ResourceId(anchorAddress, chainType, chainId2);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const resourceIdUpdateProposal = new ResourceIdUpdateProposal(
      header,
      newResourceId.toString(),
      handlerAddress
    );
    const resourceIdUpdateProposalEncoded = resourceIdUpdateProposal.toU8a();
    const resourceIdUpdateProposalDecoded = ResourceIdUpdateProposal.fromBytes(
      resourceIdUpdateProposalEncoded
    );

    assert.equal(resourceIdUpdateProposalDecoded.handlerAddress, handlerAddress);
    assert.equal(resourceIdUpdateProposalDecoded.newResourceId, newResourceId.toString());
    assert.equal(resourceIdUpdateProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode set treasury handler proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newTreasuryHandler = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabb';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const setTreasuryHandlerProposal = new SetTreasuryHandlerProposal(header, newTreasuryHandler);
    const setTreasuryHandlerProposalEncoded = setTreasuryHandlerProposal.toU8a();
    const setTreasuryHandlerProposalDecoded = SetTreasuryHandlerProposal.fromBytes(
      setTreasuryHandlerProposalEncoded
    );

    assert.equal(setTreasuryHandlerProposalDecoded.newTreasuryHandler, newTreasuryHandler);
    assert.equal(setTreasuryHandlerProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode set verifier proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newVerifier = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabb';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const setVerifierProposal = new SetVerifierProposal(header, newVerifier);
    const setVerifierProposalEncoded = setVerifierProposal.toU8a();
    const setVerifierProposalDecoded = SetVerifierProposal.fromBytes(setVerifierProposalEncoded);

    assert.equal(setVerifierProposalDecoded.newVerifier, newVerifier);
    assert.equal(setVerifierProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode fee recipient update proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const newFeeRecipient = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabb';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const feeRecipientUpdateProposal = new FeeRecipientUpdateProposal(header, newFeeRecipient);
    const feeRecipientUpdateProposalEncoded = feeRecipientUpdateProposal.toU8a();
    const feeRecipientUpdateProposalDecoded = FeeRecipientUpdateProposal.fromBytes(
      feeRecipientUpdateProposalEncoded
    );

    assert.equal(feeRecipientUpdateProposalDecoded.newFeeRecipient, newFeeRecipient);
    assert.equal(feeRecipientUpdateProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode rescue token proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const tokenAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabb';
    const toAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaacc';
    const amount = '0x0000000000000000000000000000000000000000000000000000000000001111';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const lastLeafIndex = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, lastLeafIndex);

    const feeRecipientUpdateProposal = new RescueTokensProposal(
      header,
      tokenAddress,
      toAddress,
      amount
    );
    const feeRecipientUpdateProposalEncoded = feeRecipientUpdateProposal.toU8a();
    const feeRecipientUpdateProposalDecoded = RescueTokensProposal.fromBytes(
      feeRecipientUpdateProposalEncoded
    );

    assert.equal(feeRecipientUpdateProposalDecoded.tokenAddress, tokenAddress);
    assert.equal(feeRecipientUpdateProposalDecoded.toAddress, toAddress);
    assert.equal(feeRecipientUpdateProposalDecoded.amount, amount);
    assert.equal(feeRecipientUpdateProposalDecoded.header.toString(), header.toString());
  });

  it('Should encode and decode register fungible token proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const nonce = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, nonce);

    const tokenHandler = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const assetId = '0xbbbbbbbb';
    const name = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const symbol = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

    const registerFungibleTokenProposal = new RegisterFungibleTokenProposal(
      header,
      tokenHandler,
      assetId,
      name,
      symbol
    );
    const registerFungibleTokenProposalEncoded = registerFungibleTokenProposal.toU8a();
    const registerFungibleTokenProposalDecoded = RegisterFungibleTokenProposal.fromBytes(
      registerFungibleTokenProposalEncoded
    );

    assert.equal(registerFungibleTokenProposalDecoded.header.toString(), header.toString());
    assert.equal(registerFungibleTokenProposalDecoded.tokenHandler, tokenHandler);
    assert.equal(registerFungibleTokenProposalDecoded.assetId, assetId);
    assert.equal(registerFungibleTokenProposalDecoded.name, name);
    assert.equal(registerFungibleTokenProposalDecoded.symbol, symbol);
  });

  it('Should encode and decode register nft token proposal', () => {
    const anchorAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const chainId = 0xcafe;
    const chainType = ChainType.EVM;
    const resourceId = new ResourceId(anchorAddress, chainType, chainId);
    const functionSignature = hexToU8a('0xdeadbeef');
    const nonce = 0x0000feed;
    const header = new ProposalHeader(resourceId, functionSignature, nonce);

    const tokenHandler = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const assetId = '0xbbbbbbbb';
    const collectionAddress = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const salt = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const uri =
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';

    const registerNftTokenProposal = new RegisterNftTokenProposal(
      header,
      tokenHandler,
      assetId,
      collectionAddress,
      salt,
      uri
    );
    const registerNftTokenProposalEncoded = registerNftTokenProposal.toU8a();
    const registerNftTokenProposalDecoded = RegisterNftTokenProposal.fromBytes(
      registerNftTokenProposalEncoded
    );

    assert.equal(registerNftTokenProposalDecoded.header.toString(), header.toString());
    assert.equal(registerNftTokenProposalDecoded.tokenHandler, tokenHandler);
    assert.equal(registerNftTokenProposalDecoded.assetId, assetId);
    assert.equal(registerNftTokenProposalDecoded.collectionAddress, collectionAddress);
    assert.equal(registerNftTokenProposalDecoded.salt, salt);
    assert.equal(registerNftTokenProposalDecoded.uri, uri);
  });
});
