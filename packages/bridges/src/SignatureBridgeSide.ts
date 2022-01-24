import { BigNumber, ethers } from 'ethers';
import { SignatureBridge, SignatureBridge__factory } from '@webb-tools/contracts';
import { GovernedTokenWrapper } from "@webb-tools/tokens";
import { TokenWrapperHandler } from "@webb-tools/tokens";
import { AnchorHandler } from "@webb-tools/anchors";
import { IAnchor, IBridgeSide, Proposal } from "@webb-tools/interfaces";

export class SignatureBridgeSide implements IBridgeSide {
  contract: SignatureBridge;
  admin: ethers.Signer;
  anchorHandler: AnchorHandler;
  tokenHandler: TokenWrapperHandler;
  proposals: Proposal[];
  signingSystemSignFn: (data: any) => Promise<string>;

  ANCHOR_HANDLER_MISSING_ERROR = new Error("Cannot connect an anchor without a handler");
  TOKEN_HANDLER_MISSING_ERROR = new Error("Cannot connect to a token wrapper without a handler");

  private constructor(
    contract: SignatureBridge,
    signer: ethers.Signer,
    signingSystemSignFn?: (data: any) => Promise<string>,
  ) {
    this.contract = contract;
    this.admin = signer;
    this.anchorHandler = null;
    this.tokenHandler = null;
    this.proposals = [];
    if (signingSystemSignFn) {
      this.signingSystemSignFn = signingSystemSignFn;
    } else {
      this.signingSystemSignFn = (data: any) => {
        return signer.signMessage(data)
      };
    }
  }

  public async execute(proposalData: string) {
    const proposalMsg = ethers.utils.arrayify(ethers.utils.keccak256(proposalData).toString());
    const sig = await this.signingSystemSignFn(proposalMsg);
    const tx = await this.contract.executeProposalWithSignature(proposalData, sig);
    const receipt = await tx.wait();
    
    return receipt;
  }

  public static async createBridgeSide(
    initialGovernor: string,
    fee: ethers.BigNumberish,
    expiry: ethers.BigNumberish,
    admin: ethers.Signer
  ): Promise<SignatureBridgeSide> {
    const bridgeFactory = new SignatureBridge__factory(admin);
    const chainId = await admin.getChainId();
    const deployedBridge = await bridgeFactory.deploy(initialGovernor);
    await deployedBridge.deployed();
    const bridgeSide = new SignatureBridgeSide(deployedBridge, admin);
    return bridgeSide;
  }

  public static async connect(address: string, admin: ethers.Signer) {
    const deployedBridge = SignatureBridge__factory.connect(address, admin);
    const bridgeSide = new SignatureBridgeSide(deployedBridge, admin);
    return bridgeSide;
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
    if (fee < 0 || fee > 100) throw new Error("Invalid fee");
    const proposalData = await governedToken.getFeeProposalData(fee);
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

 
  public async createAddTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getAddTokenProposalData(tokenAddress);
    return proposalData;
  }

  public async createRemoveTokenUpdateProposalData(governedToken: GovernedTokenWrapper, tokenAddress: string) {
    const proposalData = await governedToken.getRemoveTokenProposalData(tokenAddress);
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

  // Connects the bridgeSide, anchor handler, and anchor.
  // Returns the resourceID used to connect them all
  public async connectAnchorWithSignature(anchor: IAnchor): Promise<string> {
    const resourceId = await this.setResourceWithSignature(anchor);
    await this.executeHandlerProposalWithSig(anchor, this.anchorHandler.contract.address);

    return resourceId;
  }

  public async setResourceWithSignature(anchor: IAnchor): Promise<string> {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;

    const resourceId = await anchor.createResourceId();

    const unsignedData = this.anchorHandler.contract.address + resourceId.slice(2) + anchor.contract.address.slice(2);
    const unsignedMsg = ethers.utils.arrayify(ethers.utils.keccak256(unsignedData).toString());
    const sig = await this.signingSystemSignFn(unsignedMsg);
    const tx = await this.contract.adminSetResourceWithSignature(this.anchorHandler.contract.address, resourceId, anchor.contract.address, sig);
    await tx.wait();
    return resourceId;
  }

  public async setGovernedTokenResourceWithSignature(governedToken: GovernedTokenWrapper): Promise<string> {
    if (!this.tokenHandler) throw this.TOKEN_HANDLER_MISSING_ERROR;

    const resourceId = await governedToken.createResourceId();
    const unsignedData = this.tokenHandler.contract.address + resourceId.slice(2) + governedToken.contract.address.slice(2);
    const unsignedMsg = ethers.utils.arrayify(ethers.utils.keccak256(unsignedData).toString());
    const sig = await this.signingSystemSignFn(unsignedMsg);
    await this.contract.adminSetResourceWithSignature(this.tokenHandler.contract.address, resourceId, governedToken.contract.address, sig);
    return resourceId;
  }

  public async executeHandlerProposalWithSig(anchor: IAnchor, newHandler: string) {
    const proposalData = await this.createHandlerUpdateProposalData(anchor, newHandler);
    return this.execute(proposalData);
  }

  public async executeAnchorProposalWithSig(srcAnchor: IAnchor, executionResourceID: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;

    const proposalData = await this.createAnchorUpdateProposalData(srcAnchor, executionResourceID); return this.execute(proposalData);
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

  public async executeConfigLimitsProposalWithSig(anchor: IAnchor, _minimalWithdrawalAmount: string, _maximumDepositAmount: string) {
    if (!this.anchorHandler) throw this.ANCHOR_HANDLER_MISSING_ERROR;

    const proposalData = await this.createConfigLimitsProposalData(anchor, _minimalWithdrawalAmount,_maximumDepositAmount);
    return this.execute(proposalData);
  }
}
