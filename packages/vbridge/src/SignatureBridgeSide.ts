import { BaseContract, BigNumber, ethers } from 'ethers';
import { SignatureBridge, SignatureBridge__factory } from '@webb-tools/contracts';
import { FungibleTokenWrapper, Treasury } from '@webb-tools/tokens';
import { TokenWrapperHandler } from '@webb-tools/tokens';
import { AnchorHandler, WebbContracts } from '@webb-tools/anchors';
import { Deployer } from '@webb-tools/create2-utils';
import { IVAnchor, IBridgeSide, Proposal } from '@webb-tools/interfaces';
import { TreasuryHandler } from '@webb-tools/tokens';
import { getChainIdType } from '@webb-tools/utils';
import { signMessage, toHex } from '@webb-tools/sdk-core';

type SystemSigningFn = (data: any) => Promise<string>;

export class SignatureBridgeSide<A extends BaseContract> implements IBridgeSide {
  contract: SignatureBridge;
  admin: ethers.Signer;
  governor: ethers.Wallet | string;
  anchorHandler: AnchorHandler;
  tokenHandler: TokenWrapperHandler;
  treasuryHandler: TreasuryHandler;
  proposals: Proposal[];
  signingSystemSignFn: SystemSigningFn;

  ANCHOR_HANDLER_MISSING_ERROR = new Error('Cannot connect an anchor without a handler');
  TOKEN_HANDLER_MISSING_ERROR = new Error('Cannot connect to a token wrapper without a handler');
  TREASURY_HANDLER_MISSING_ERROR = new Error('Cannot connect to treasury without handler');

  private constructor(contract: SignatureBridge, systemSigningFn: SystemSigningFn) {
    this.contract = contract;
    this.anchorHandler = null;
    this.tokenHandler = null;
    this.treasuryHandler = null;
    this.proposals = [];

    this.signingSystemSignFn = systemSigningFn;
  }

  /**
   * When a bridgeSide is created, the admin is set as the governor.
   * Ownership of the bridge can then be transferred to another entity.
   *
   * @param admin - The deployer and governor upon creation.
   */
  public static async createBridgeSide<A extends BaseContract>(
    admin: ethers.Wallet
  ): Promise<SignatureBridgeSide<A>> {
    const bridgeFactory = new SignatureBridge__factory(admin);
    const deployedBridge = await bridgeFactory.deploy(admin.address, 0);
    await deployedBridge.deployed();
    const bridgeSide = new SignatureBridgeSide(deployedBridge, (data: any) => {
      return Promise.resolve(signMessage(admin, data));
    });
    bridgeSide.admin = admin;
    bridgeSide.governor = admin;
    return bridgeSide;
  }

  public static async create2BridgeSide<A extends BaseContract>(
    deployer: Deployer,
    saltHex: string,
    admin: ethers.Wallet
  ): Promise<SignatureBridgeSide<A>> {
    const argTypes = ['address', 'uint32'];
    const args = [admin.address, 0];
    const { contract: deployedBridge } = await deployer.deploy(
      SignatureBridge__factory,
      saltHex,
      admin,
      undefined,
      argTypes,
      args
    );
    const bridgeSide = new SignatureBridgeSide(deployedBridge, (data: any) => {
      return Promise.resolve(signMessage(admin, data));
    });
    bridgeSide.admin = admin;
    bridgeSide.governor = admin;
    return bridgeSide;
  }

  /**
   * When an existing SignatureBridge is connected, the governor must be configured.
   * In the case of connectMocked, a wallet address is passed which will act as the governor.
   *
   * connectMocked is particularly useful for integration testing
   *
   * @param contractAddress - The contract address of the SignatureBridge contract instance.
   * @param mockedGovernor - The ethers.Wallet which will sign messages before execution on the bridgeSide.
   */
  public static async connectMocked(contractAddress: string, mockedGovernor: ethers.Wallet) {
    const deployedBridge = SignatureBridge__factory.connect(contractAddress, mockedGovernor);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, (data: string) => {
      return Promise.resolve(signMessage(mockedGovernor, data));
    });
    bridgeSide.governor = mockedGovernor;
    bridgeSide.admin = mockedGovernor;
    return bridgeSide;
  }

  /**
   * When an existing SignatureBridge is connected, the governor must be configured.
   * In the case of connectGovernor, a network is passed for querying the chain as well
   * as a signing function which can keep this class generic.
   *
   * connectGovernor is necessary for interacting with this class when the private key
   * of the governor is unavailable, but signed proposals are available.
   *
   * @param contractAddress - The contract address of the SignatureBridge contract instance.
   * @param provider - The network which the contract address exists upon.
   * @param systemSigningFn - a function which will produce a signature that verifies as
   * coming from the configured governor on chain.
   */
  public static async connectGovernor(
    contractAddress: string,
    provider: ethers.providers.Provider,
    systemSigningFn: SystemSigningFn
  ) {
    const deployedBridge = SignatureBridge__factory.connect(contractAddress, provider);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, systemSigningFn);
    return bridgeSide;
  }

  /**
   * Transfers ownership directly from the current governor to the new governor.
   * Note that this requires an externally-signed transaction from the current governor.
   * @param newOwner The new owner of the bridge
   */
  public async transferOwnership(newOwner: string, nonce: number) {
    return this.contract.transferOwnership(newOwner, nonce, {
      gasLimit: '0x5B8D80',
    });
  }

  /**
   * Creates the proposal data for updating an execution anchor
   * with the latest state of a source anchor (i.e. most recent deposit).
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceId The resource id of the execution anchor instance.
   * @returns Promise<string>
   */
  public async createAnchorUpdateProposalData(
    srcAnchor: IVAnchor<A>,
    executionResourceID: string
  ): Promise<string> {
    const proposalData = await srcAnchor.getProposalData(executionResourceID);
    return proposalData;
  }

  public async createHandlerUpdateProposalData(anchor: IVAnchor<A>, newHandler: string) {
    const proposalData = await anchor.getHandlerProposalData(newHandler);
    return proposalData;
  }

  /**
   * Creates the proposal data for updating the wrapping fee
   * of a fungible token wrapper.
   * @param fungibleToken The fungible token wrapper whose fee will be updated.
   * @param fee The new fee percentage
   * @returns Promise<string>
   */
  public async createFeeUpdateProposalData(
    fungibleToken: FungibleTokenWrapper,
    fee: number
  ): Promise<string> {
    const proposalData = await fungibleToken.getFeeProposalData(fee);
    return proposalData;
  }

  public async createAddTokenUpdateProposalData(
    fungibleToken: FungibleTokenWrapper,
    tokenAddress: string
  ) {
    const proposalData = await fungibleToken.getAddTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async createRemoveTokenUpdateProposalData(
    fungibleToken: FungibleTokenWrapper,
    tokenAddress: string
  ) {
    const proposalData = await fungibleToken.getRemoveTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async createTreasuryHandlerUpdateProposalData(treasury: Treasury, newHandler: string) {
    const proposalData = await treasury.getSetHandlerProposalData(newHandler);
    return proposalData;
  }

  public async createRescueTokensProposalData(
    treasury: Treasury,
    tokenAddress: string,
    to: string,
    amountToRescue: BigNumber
  ) {
    const proposalData = await treasury.getRescueTokensProposalData(
      tokenAddress,
      to,
      amountToRescue
    );
    return proposalData;
  }

  /**
   * Creates the proposal data for updating the fee recipient
   * of a fungible token wrapper.
   * @param fungibleToken The fungible token wrapper whose fee will be updated.
   * @param feeRecipient The new fee recipient
   * @returns Promise<string>
   */
  public async createFeeRecipientUpdateProposalData(
    fungibleToken: FungibleTokenWrapper,
    feeRecipient: string
  ): Promise<string> {
    const proposalData = await fungibleToken.getFeeRecipientProposalData(feeRecipient);
    return proposalData;
  }

  public async createMinWithdrawalLimitProposalData(
    vAnchor: IVAnchor<A>,
    _minimalWithdrawalAmount: string
  ) {
    const proposalData = await vAnchor.getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount);
    return proposalData;
  }

  public async createMaxDepositLimitProposalData(
    vAnchor: IVAnchor<A>,
    _maximumDepositAmount: string
  ) {
    const proposalData = await vAnchor.getMaxDepositLimitProposalData(_maximumDepositAmount);
    return proposalData;
  }

  public setAnchorHandler(handler: AnchorHandler) {
    this.anchorHandler = handler;
  }

  public setTokenWrapperHandler(handler: TokenWrapperHandler) {
    this.tokenHandler = handler;
  }

  public setTreasuryHandler(handler: TreasuryHandler) {
    this.treasuryHandler = handler;
  }

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceId of the anchor instance that connects
  // the anchor handler to the anchor (execution) contract.
  public async connectAnchorWithSignature(anchor: IVAnchor<A>): Promise<string> {
    const resourceId = await this.setAnchorResourceWithSignature(anchor);
    if (this.anchorHandler.contract.address !== (await anchor.getHandler())) {
      await this.executeHandlerProposalWithSig(anchor, this.anchorHandler.contract.address);
    }

    return resourceId;
  }

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address +
        toHex(getChainIdType(Number(await this.contract.getChainId())), 6).substr(2),
      32
    );
  }

  public async setResourceWithSignature(newResourceId: string, handler: string): Promise<string> {
    const resourceId = await this.createResourceId();
    const functionSig = ethers.utils
      .keccak256(
        ethers.utils.toUtf8Bytes(
          'adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,bytes)'
        )
      )
      .slice(0, 10)
      .padEnd(10, '0');
    const nonce = Number(await this.contract.proposalNonce()) + 1;
    const unsignedData =
      '0x' +
      // A resource Id for the bridge contract
      toHex(resourceId, 32).substr(2) +
      functionSig.slice(2) +
      toHex(nonce, 4).substr(2) +
      // The resource ID mapping the resource Id to handler and
      // the handler to the execution contract (in the handler's storage)
      toHex(newResourceId, 32).substr(2) +
      // Setting the handler
      toHex(handler, 20).substr(2);

    const sig = await this.signingSystemSignFn(unsignedData);
    const tx = await this.contract.adminSetResourceWithSignature(
      resourceId,
      functionSig,
      nonce,
      newResourceId,
      handler,
      sig
    );
    await tx.wait();
    return newResourceId;
  }

  public async setAnchorResourceWithSignature(anchor: IVAnchor<A>): Promise<string> {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;

    const newResourceId = await anchor.createResourceId();
    const handler = this.anchorHandler.contract.address;

    return await this.setResourceWithSignature(newResourceId, handler);
  }

  public async setFungibleTokenResourceWithSignature(
    fungibleToken: FungibleTokenWrapper
  ): Promise<string> {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;

    const newResourceId = await fungibleToken.createResourceId();
    const handler = this.tokenHandler.contract.address;

    return await this.setResourceWithSignature(newResourceId, handler);
  }

  public async setTreasuryResourceWithSignature(treasury: Treasury): Promise<string> {
    if (!this.treasuryHandler) throw this.TREASURY_HANDLER_MISSING_ERROR;

    const newResourceId = await treasury.createResourceId();
    const handler = this.treasuryHandler.contract.address;

    return await this.setResourceWithSignature(newResourceId, handler);
  }

  public async execute(proposalData: string) {
    const sig = await this.signingSystemSignFn(proposalData);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();

    return receipt;
  }

  public async executeHandlerProposalWithSig(anchor: IVAnchor<A>, newHandler: string) {
    const proposalData = await this.createHandlerUpdateProposalData(anchor, newHandler);
    return this.execute(proposalData);
  }

  // emit ProposalEvent(chainID, nonce, ProposalStatus.Executed, dataHash);
  public async executeAnchorProposalWithSig(srcAnchor: IVAnchor<A>, executionResourceID: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceID);
    return this.execute(proposalData);
  }

  public async executeFeeProposalWithSig(fungibleToken: FungibleTokenWrapper, fee: number) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;
    const proposalData = await this.createFeeUpdateProposalData(fungibleToken, fee);
    return this.execute(proposalData);
  }

  public async executeAddTokenProposalWithSig(
    fungibleToken: FungibleTokenWrapper,
    tokenAddress: string
  ) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;
    const proposalData = await this.createAddTokenUpdateProposalData(fungibleToken, tokenAddress);
    return this.execute(proposalData);
  }

  public async executeRemoveTokenProposalWithSig(
    fungibleToken: FungibleTokenWrapper,
    tokenAddress: string
  ) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;
    const proposalData = await this.createRemoveTokenUpdateProposalData(
      fungibleToken,
      tokenAddress
    );
    return this.execute(proposalData);
  }

  public async executeFeeRecipientProposalWithSig(
    fungibleToken: FungibleTokenWrapper,
    feeRecipient: string
  ) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;

    const proposalData = await this.createFeeRecipientUpdateProposalData(
      fungibleToken,
      feeRecipient
    );
    return this.execute(proposalData);
  }

  public async executeTreasuryHandlerProposalWithSig(treasury: Treasury, newHandler: string) {
    if (!this.treasuryHandler) throw this.TREASURY_HANDLER_MISSING_ERROR;
    const proposalData = await this.createTreasuryHandlerUpdateProposalData(treasury, newHandler);
    return this.execute(proposalData);
  }

  public async executeRescueTokensProposalWithSig(
    treasury: Treasury,
    tokenAddress: string,
    to: string,
    amountToRescue: BigNumber
  ) {
    if (!this.treasuryHandler) throw this.TREASURY_HANDLER_MISSING_ERROR;
    const proposalData = await this.createRescueTokensProposalData(
      treasury,
      tokenAddress,
      to,
      amountToRescue
    );
    return this.execute(proposalData);
  }

  public async executeMinWithdrawalLimitProposalWithSig(
    anchor: IVAnchor<A>,
    _minimalWithdrawalAmount: string
  ) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createMinWithdrawalLimitProposalData(
      anchor,
      _minimalWithdrawalAmount
    );
    return this.execute(proposalData);
  }

  public async executeMaxDepositLimitProposalWithSig(
    anchor: IVAnchor<A>,
    _maximumDepositAmount: string
  ) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createMaxDepositLimitProposalData(
      anchor,
      _maximumDepositAmount
    );
    return this.execute(proposalData);
  }
}
