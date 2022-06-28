import { ethers } from 'ethers';
import { AnchorProxy as AnchorProxyContract, AnchorProxy__factory } from '@webb-tools/contracts';
import { WithdrawalEvent, RefreshEvent } from '@webb-tools/contracts/src/FixedDepositAnchor';
import { Anchor } from './Anchor';
import { IAnchorDepositInfo } from '@webb-tools/interfaces';
import { toFixedHex } from "@webb-tools/sdk-core";

enum InstanceState {
  ENABLED,
  DISABLED,
  MINEABLE,
}

interface Instance {
  token: string;
  state: InstanceState;
}

interface IAnchorStruct {
  addr: string;
  instance: Instance;
}

export class AnchorProxy {
  signer: ethers.Signer;
  contract: AnchorProxyContract;
  // An AnchorProxy can proxy for multiple anchors so we have a map from address to Anchor Class
  anchorProxyMap: Map<string, Anchor>; 
  
  constructor(
    contract: AnchorProxyContract,
    signer: ethers.Signer,
    anchorList: Anchor[],

  ) {
    this.contract = contract;
    this.signer = signer;
    this.anchorProxyMap = new Map<string, Anchor>();
    for (let i = 0; i < anchorList.length; i++) {
      this.insertAnchor(anchorList[i]);
    }
  }

  //need to fix this
  public static async createAnchorProxy(
    _anchorTrees: string,
    _governance: string,
    _anchorList: Anchor[],
    deployer: ethers.Signer
  ) {
    const factory = new AnchorProxy__factory(deployer);
    const instances = _anchorList.map((a: Anchor) => {
      return {
        addr: a.contract.address,
        instance: {
          token: a.token || '',
          state: InstanceState.DISABLED,
        },
      }
    });
    const deployTx = factory.getDeployTransaction(_anchorTrees, _governance, instances).data;
    const gasEstimate = await factory.signer.estimateGas({ data: deployTx });
    const contract = await factory.deploy(_anchorTrees, _governance, instances, { gasLimit: gasEstimate }); //edit this
    await contract.deployed();

    const handler = new AnchorProxy(contract, deployer, _anchorList);
    return handler;
  }

  public async deposit(anchorAddr: string, destChainId: number, encryptedNote?: string): Promise<{deposit: IAnchorDepositInfo, index: number}> {
    const deposit: IAnchorDepositInfo = Anchor.generateDeposit(destChainId);
    let _encryptedNote: string = '0x000000'
    if (encryptedNote) {
      const _encryptedNote: string = encryptedNote;
    } 

    const gasEstimate = await this.contract.estimateGas.deposit(
      anchorAddr,
      toFixedHex(deposit.commitment),
      _encryptedNote,
    );

    const tx = await this.contract.deposit(
      anchorAddr,
      toFixedHex(deposit.commitment),
      _encryptedNote,
      { gasLimit: gasEstimate }
    );
  
    await tx.wait();

    const anchor = this.anchorProxyMap.get(anchorAddr);
    if (!anchor) {
      throw new Error('Anchor not found');
    }

    anchor.tree.insert(deposit.commitment);
    let index = anchor.tree.number_of_elements() - 1;
    return { deposit, index };
  }

  public async withdraw(
    anchorAddr: string,
    deposit: IAnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number
  ): Promise<RefreshEvent | WithdrawalEvent> {
    const anchor = this.anchorProxyMap.get(anchorAddr);
    if (!anchor) {
      throw new Error('Anchor not found');
    }

    const { publicInputs, extData } = await anchor.setupWithdraw(
      deposit,
      index,
      recipient,
      relayer,
      fee,
      refreshCommitment,
    );

    const gasEstimate = await this.contract.estimateGas.withdraw(
      anchorAddr,
      publicInputs,
      extData
    );

    const tx = await this.contract.withdraw(
      anchorAddr,
      publicInputs,
      extData,
      { gasLimit: gasEstimate }
    );

    const receipt = await tx.wait();

    if (refreshCommitment !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      anchor.tree.insert(refreshCommitment);
      const filter = anchor.contract.filters.Refresh(null, null, null);
      const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    } else {
      const filter = anchor.contract.filters.Withdrawal(null, relayer, null);
      const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    }
  }

  public insertAnchor(anchor: Anchor) {
    this.anchorProxyMap.set(anchor.contract.address, anchor);
  }
}
