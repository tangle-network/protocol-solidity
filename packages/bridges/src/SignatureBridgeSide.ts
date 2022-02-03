import { BigNumber, ethers } from 'ethers';
import { SignatureBridge, SignatureBridge__factory } from '@webb-tools/contracts';
import { GovernedTokenWrapper, Treasury } from "@webb-tools/tokens";
import { TokenWrapperHandler } from "@webb-tools/tokens";
import { AnchorHandler } from "@webb-tools/anchors";
import { IAnchor, IBridgeSide, Proposal } from "@webb-tools/interfaces";
import { TreasuryHandler } from "@webb-tools/tokens";
import { getChainIdType, signMessage, toHex } from '@webb-tools/utils';

export class SignatureBridgeSide implements IBridgeSide {
  contract: SignatureBridge;
  admin: ethers.Signer;
  governor: ethers.Wallet;
  anchorHandler: AnchorHandler;
  tokenHandler: TokenWrapperHandler;
  treasuryHandler: TreasuryHandler;
  proposals: Proposal[];
  signingSystemSignFn: (data: any) => Promise<string>;

  ANCHOR_HANDLER_MISSING_ERROR = new Error("Cannot connect an anchor without a handler");
  TOKEN_HANDLER_MISSING_ERROR = new Error("Cannot connect to a token wrapper without a handler");
  TREASURY_HANDLER_MISSING_ERROR = new Error("Cannot connect to treasury without handler"); 

  private constructor(
    contract: SignatureBridge,
    initialGovernor: ethers.Wallet,
    signer: ethers.Signer,
    signingSystemSignFn?: (data: any) => Promise<string>,
  ) {
    this.contract = contract;
    this.admin = signer;
    this.governor = initialGovernor;
    this.anchorHandler = null;
    this.tokenHandler = null;
    this.treasuryHandler = null;
    this.proposals = [];
    if (signingSystemSignFn) {
      this.signingSystemSignFn = signingSystemSignFn;
    } else {
      this.signingSystemSignFn = (data: any) => {
        return signMessage(initialGovernor, data)
      };
    }
  }

  public static async createBridgeSide(
    initialGovernor: ethers.Wallet,
    admin: ethers.Signer
  ): Promise<SignatureBridgeSide> {
    const bridgeFactory = new SignatureBridge__factory(admin);
    const deployedBridge = await bridgeFactory.deploy(initialGovernor.address);
    await deployedBridge.deployed();
    const bridgeSide = new SignatureBridgeSide(deployedBridge, initialGovernor, admin);
    return bridgeSide;
  }

  public static async connect(address: string, initialGovernor: ethers.Wallet, admin: ethers.Wallet) {
    const deployedBridge = SignatureBridge__factory.connect(address, admin);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, initialGovernor, admin);
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

  public async createRescueTokensProposalData(treasury: Treasury, tokenAddress: string, to: string, amountToRescue: BigNumber) {
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
   public async createFeeRecipientUpdateProposalData(governedToken: GovernedTokenWrapper, feeRecipient: string): Promise<string> {
    const proposalData = await governedToken.getFeeRecipientProposalData(feeRecipient);
    return proposalData;
  }

  public async createConfigLimitsProposalData(vAnchor: IAnchor, _minimalWithdrawalAmount: string, _maximumDepositAmount: string) {
    const proposalData = await vAnchor.getConfigLimitsProposalData(_minimalWithdrawalAmount,_maximumDepositAmount);
    return proposalData;
  }

  public async setAnchorHandler(handler: AnchorHandler) {
    this.anchorHandler = handler;
  }

  public async setTokenWrapperHandler(handler: TokenWrapperHandler) {
    this.tokenHandler = handler;
  }

  public async setTreasuryHandler(handler: TreasuryHandler) {
    this.treasuryHandler = handler;
  }

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceId of the anchor instance that connects
  // the anchor handler to the anchor (execution) contract.
  public async connectAnchorWithSignature(anchor: IAnchor): Promise<string> {
    const resourceId = await this.setResourceWithSignature(anchor);
    if (this.anchorHandler.contract.address !== await anchor.getHandler()) {
      await this.executeHandlerProposalWithSig(anchor, this.anchorHandler.contract.address);
    }

    return resourceId;
  }

  public async createResourceId(): Promise<string> {
    return toHex(
      this.contract.address
        + toHex(getChainIdType(Number(await this.contract.getChainId())), 6).substr(2),
      32
    );
  }

  public async setResourceWithSignature(anchor: IAnchor): Promise<string> {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;

    const resourceId = await this.createResourceId();
    const newResourceId = await anchor.createResourceId();
    // const unsignedData = this.anchorHandler.contract.address + newResourceId.slice(2) + anchor.contract.address.slice(2);

    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
      "adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,address,bytes)"
    )).slice(0, 10).padEnd(10, '0');  
    const nonce = Number(await this.contract.proposalNonce()) + 1;;

    const unsignedData = '0x'
      // A resource Id for the bridge contract
      + toHex(resourceId, 32).substr(2)
      + functionSig.slice(2)
      + toHex(nonce,4).substr(2)
      // The resource ID mapping the resource Id to handler and 
      // the handler to the execution contract (in the handler's storage)
      + toHex(newResourceId, 32).substr(2)
      // Setting the handler for the anchor to be the handler set in the bridge side class
      + toHex(this.anchorHandler.contract.address, 20).substr(2)
      + toHex(anchor.contract.address, 20).substr(2);

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
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
      "adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,address,bytes)"
    )).slice(0, 10).padEnd(10, '0');  
    const nonce = Number(await this.contract.proposalNonce()) + 1;;

    const unsignedData = '0x'
      // A resource Id for the bridge contract
      + toHex(resourceId, 32).substr(2)
      + functionSig.slice(2)
      + toHex(nonce,4).substr(2)
      // The resource ID mapping the resource Id to handler and 
      // the handler to the execution contract (in the handler's storage)
      + toHex(newResourceId, 32).substr(2)
      + toHex(this.tokenHandler.contract.address, 20).substr(2)
      + toHex(governedToken.contract.address, 20).substr(2);

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
    return resourceId;
  }

  public async setTreasuryResourceWithSignature(treasury: Treasury): Promise<string> {
    if (!this.treasuryHandler) throw this.TREASURY_HANDLER_MISSING_ERROR;

    const resourceId = await this.createResourceId();
    const newResourceId = await treasury.createResourceId();
    const functionSig = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
      "adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,address,bytes)"
    )).slice(0, 10).padEnd(10, '0');  
    const nonce = Number(await this.contract.proposalNonce()) + 1;;

    const unsignedData = '0x'
      // A resource Id for the bridge contract
      + toHex(resourceId, 32).substr(2)
      + functionSig.slice(2)
      + toHex(nonce,4).substr(2)
      // The resource ID mapping the resource Id to handler and 
      // the handler to the execution contract (in the handler's storage)
      + toHex(newResourceId, 32).substr(2)
      + toHex(this.treasuryHandler.contract.address, 20).substr(2)
      + toHex(treasury.contract.address, 20).substr(2);


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

  public async executeRescueTokensProposalWithSig(treasury: Treasury, tokenAddress: string, to: string, amountToRescue: BigNumber) {
    if (!this.treasuryHandler) throw this.TREASURY_HANDLER_MISSING_ERROR; 
    const proposalData = await this.createRescueTokensProposalData(treasury, tokenAddress, to, amountToRescue);
    return this.execute(proposalData);
  }


  public async executeConfigLimitsProposalWithSig(anchor: IAnchor, _minimalWithdrawalAmount: string, _maximumDepositAmount: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;
    const proposalData = await this.createConfigLimitsProposalData(anchor, _minimalWithdrawalAmount,_maximumDepositAmount);
    ;
    return this.execute(proposalData);
  }
}
