import { BigNumber, ethers } from 'ethers';
import { SignatureBridge, SignatureBridge__factory } from '@webb-tools/contracts';
import { GovernedTokenWrapper, Treasury } from '@webb-tools/tokens';
import { TokenWrapperHandler } from '@webb-tools/tokens';
import { AnchorHandler } from '@webb-tools/anchors';
import { IAnchor, IBridgeSide, Proposal } from '@webb-tools/interfaces';
import { TreasuryHandler } from '@webb-tools/tokens';
import { getChainIdType } from '@webb-tools/utils';
import { signMessage, toHex } from '@webb-tools/sdk-core';
import EC from 'elliptic';
const ec = new EC.ec('secp256k1');

export class SignatureBridgeSide implements IBridgeSide {
  contract: SignatureBridge;
  admin: ethers.Signer;
  governor: ethers.Wallet | string;
  anchorHandler: AnchorHandler;
  tokenHandler: TokenWrapperHandler;
  treasuryHandler: TreasuryHandler;
  proposals: Proposal[];
  signingSystemSignFn: (data: any) => Promise<string>;

  ANCHOR_HANDLER_MISSING_ERROR = new Error('Cannot connect an anchor without a handler');
  TOKEN_HANDLER_MISSING_ERROR = new Error('Cannot connect to a token wrapper without a handler');
  TREASURY_HANDLER_MISSING_ERROR = new Error('Cannot connect to treasury without handler');

  private constructor(
    contract: SignatureBridge,
    governor: ethers.Wallet | string,
    signer: ethers.Signer,
    signingSystemSignFn?: (data: any) => Promise<string>
  ) {
    this.contract = contract;
    this.admin = signer;
    this.governor = governor;
    this.anchorHandler = null;
    this.tokenHandler = null;
    this.treasuryHandler = null;
    this.proposals = [];
    if (signingSystemSignFn) {
      // The signing system here is an asynchronous function that
      // potentially dispatches a message for a signature and waits
      // to receive it. It is potentially a long-running process.
      this.signingSystemSignFn = signingSystemSignFn;
    } else {
      if (typeof governor === 'string') {
        throw new Error('Cannot sign with signing system without a governor wallet');
      }

      this.signingSystemSignFn = (data: any) => {
        return Promise.resolve(signMessage(governor, data));
      };
    }
  }

  public static async createBridgeSide(
    initialGovernor: ethers.Wallet | string,
    admin: ethers.Signer,
    signingSystemSignFn?: (data: any) => Promise<string>
  ): Promise<SignatureBridgeSide> {
    const bridgeFactory = new SignatureBridge__factory(admin);
    const deployedBridge = (typeof initialGovernor === 'string')
      ? await bridgeFactory.deploy(initialGovernor, 0)
      : await bridgeFactory.deploy(initialGovernor.address, 0);
    await deployedBridge.deployed();
    const bridgeSide = (typeof initialGovernor === 'string')
      ? new SignatureBridgeSide(deployedBridge, initialGovernor, admin, signingSystemSignFn)
      : new SignatureBridgeSide(deployedBridge, initialGovernor, admin, signingSystemSignFn);
    return bridgeSide;
  }

  public static async connect(address: string, governor: ethers.Wallet, admin: ethers.Wallet) {
    const deployedBridge = SignatureBridge__factory.connect(address, admin);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, governor, admin);
    return bridgeSide;
  }

  /**
   * Transfers ownership directly from the current governor to the new governor.
   * Note that this requires an externally-signed transaction from the current governor.
   * @param newOwner The new owner of the bridge
   */
  public async transferOwnership(newOwner: string, nonce: number) {
    return this.contract.transferOwnership(newOwner, nonce);
  }

  /**
   * Creates the proposal data for updating an execution anchor
   * with the latest state of a source anchor (i.e. most recent deposit).
   * @param srcAnchor The anchor instance whose state has updated.
   * @param executionResourceId The resource id of the execution anchor instance.
   * @returns Promise<string>
   */
  public async createAnchorUpdateProposalData(srcAnchor: IAnchor, executionResourceID: string): Promise<string> {
    const proposalData = await srcAnchor.getProposalData(executionResourceID);
    return proposalData;
  }

  public async createHandlerUpdateProposalData(anchor: IAnchor, newHandler: string) {
    const proposalData = await anchor.getHandlerProposalData(newHandler);
    return proposalData;
  }

  /**
   * Creates the proposal data for updating the wrapping fee
   * of a governed token wrapper.
   * @param governedToken The governed token wrapper whose fee will be updated.
   * @param fee The new fee percentage
   * @returns Promise<string>
   */
  public async createFeeUpdateProposalData(governedToken: GovernedTokenWrapper, fee: number): Promise<string> {
    // TODO: Validate fee is between [0, 100]
    const proposalData = await governedToken.getFeeProposalData(fee);
    return proposalData;
  }

  public async createAddTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getAddTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async createRemoveTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getRemoveTokenProposalData(tokenAddress);
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
    const proposalData = await treasury.getRescueTokensProposalData(tokenAddress, to, amountToRescue);
    return proposalData;
  }

  /**
   * Creates the proposal data for updating the fee recipient
   * of a governed token wrapper.
   * @param governedToken The governed token wrapper whose fee will be updated.
   * @param feeRecipient The new fee recipient
   * @returns Promise<string>
   */
  public async createFeeRecipientUpdateProposalData(
    governedToken: GovernedTokenWrapper,
    feeRecipient: string
  ): Promise<string> {
    const proposalData = await governedToken.getFeeRecipientProposalData(feeRecipient);
    return proposalData;
  }

  public async createMinWithdrawalLimitProposalData(vAnchor: IAnchor, _minimalWithdrawalAmount: string) {
    const proposalData = await vAnchor.getMinWithdrawalLimitProposalData(_minimalWithdrawalAmount);
    return proposalData;
  }

  public async createMaxDepositLimitProposalData(vAnchor: IAnchor, _maximumDepositAmount: string) {
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
  public async connectAnchorWithSignature(anchor: IAnchor): Promise<string> {
    const resourceId = await this.setResourceWithSignature(anchor);
    if (this.anchorHandler.contract.address !== (await anchor.getHandler())) {
      await this.executeHandlerProposalWithSig(anchor, this.anchorHandler.contract.address);
    }

    return resourceId;
  }

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address + toHex(getChainIdType(Number(await this.contract.getChainId())), 6).substr(2),
      32
    );
  }

  public async setResourceWithSignature(anchor: IAnchor): Promise<string> {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;

    const resourceId = await this.createResourceId();
    const newResourceId = await anchor.createResourceId();
    // const unsignedData = this.anchorHandler.contract.address + newResourceId.slice(2) + anchor.contract.address.slice(2);

    const functionSig = ethers.utils
      .keccak256(
        ethers.utils.toUtf8Bytes('adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,address,bytes)')
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
      // Setting the handler for the anchor to be the handler set in the bridge side class
      toHex(this.anchorHandler.contract.address, 20).substr(2) +
      toHex(anchor.contract.address, 20).substr(2);

    const sig = await this.signingSystemSignFn(unsignedData);
    const tx = await this.contract.adminSetResourceWithSignature(
      resourceId,
      functionSig,
      nonce,
      newResourceId,
      this.anchorHandler.contract.address,
      anchor.contract.address,
      sig
    );
    await tx.wait();
    return newResourceId;
  }

  public async setGovernedTokenResourceWithSignature(governedToken: GovernedTokenWrapper): Promise<string> {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;

    const resourceId = await this.createResourceId();
    const newResourceId = await governedToken.createResourceId();
    const functionSig = ethers.utils
      .keccak256(
        ethers.utils.toUtf8Bytes('adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,address,bytes)')
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
      toHex(this.tokenHandler.contract.address, 20).substr(2) +
      toHex(governedToken.contract.address, 20).substr(2);

    const sig = await this.signingSystemSignFn(unsignedData);
    const tx = await this.contract.adminSetResourceWithSignature(
      resourceId,
      functionSig,
      nonce,
      newResourceId,
      this.tokenHandler.contract.address,
      governedToken.contract.address,
      sig
    );
    await tx.wait();
    return resourceId;
  }

  public async setTreasuryResourceWithSignature(treasury: Treasury): Promise<string> {
    if (!this.treasuryHandler) throw this.TREASURY_HANDLER_MISSING_ERROR;

    const resourceId = await this.createResourceId();
    const newResourceId = await treasury.createResourceId();
    const functionSig = ethers.utils
      .keccak256(
        ethers.utils.toUtf8Bytes('adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,address,bytes)')
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
      toHex(this.treasuryHandler.contract.address, 20).substr(2) +
      toHex(treasury.contract.address, 20).substr(2);

    const sig = await this.signingSystemSignFn(unsignedData);
    const tx = await this.contract.adminSetResourceWithSignature(
      resourceId,
      functionSig,
      nonce,
      newResourceId,
      this.treasuryHandler.contract.address,
      treasury.contract.address,
      sig
    );
    await tx.wait();
    return resourceId;
  }

  public async execute(proposalData: string) {
    const sig = await this.signingSystemSignFn(proposalData);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();

    return receipt;
  }

  public async executeHandlerProposalWithSig(anchor: IAnchor, newHandler: string) {
    const proposalData = await this.createHandlerUpdateProposalData(anchor, newHandler);
    return this.execute(proposalData);
  }

  // emit ProposalEvent(chainID, nonce, ProposalStatus.Executed, dataHash);
  public async executeAnchorProposalWithSig(srcAnchor: IAnchor, executionResourceID: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceID);
    return this.execute(proposalData);
  }

  public async executeFeeProposalWithSig(governedToken: GovernedTokenWrapper, fee: number) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;
    const proposalData = await this.createFeeUpdateProposalData(governedToken, fee);
    return this.execute(proposalData);
  }

  public async executeAddTokenProposalWithSig(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;
    const proposalData = await this.createAddTokenUpdateProposalData(governedToken, tokenAddress);
    return this.execute(proposalData);
  }

  public async executeRemoveTokenProposalWithSig(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;
    const proposalData = await this.createRemoveTokenUpdateProposalData(governedToken, tokenAddress);
    return this.execute(proposalData);
  }

  public async executeFeeRecipientProposalWithSig(governedToken: GovernedTokenWrapper, feeRecipient: string) {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;

    const proposalData = await this.createFeeRecipientUpdateProposalData(governedToken, feeRecipient);
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
    const proposalData = await this.createRescueTokensProposalData(treasury, tokenAddress, to, amountToRescue);
    return this.execute(proposalData);
  }

  public async executeMinWithdrawalLimitProposalWithSig(anchor: IAnchor, _minimalWithdrawalAmount: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createMinWithdrawalLimitProposalData(anchor, _minimalWithdrawalAmount);
    return this.execute(proposalData);
  }

  public async executeMaxDepositLimitProposalWithSig(anchor: IAnchor, _maximumDepositAmount: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createMaxDepositLimitProposalData(anchor, _maximumDepositAmount);
    return this.execute(proposalData);
  }
}
