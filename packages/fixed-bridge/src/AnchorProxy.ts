import { ethers } from "ethers";
import { AnchorProxy as AnchorProxyContract, AnchorProxy__factory } from '@webb-tools/contracts';
import { WithdrawalEvent, RefreshEvent } from '@webb-tools/contracts/src/AnchorBase';
import { Anchor } from './Anchor';
import { AnchorDepositInfo } from './types';
import { toFixedHex } from "@webb-tools/utils";

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
    const contract = await factory.deploy(_anchorTrees, _governance, instances); //edit this
    await contract.deployed();

    const handler = new AnchorProxy(contract, deployer, _anchorList);
    return handler;
  }

  public async deposit(anchorAddr: string, destChainId: number, encryptedNote?: string): Promise<{deposit: AnchorDepositInfo, index: number}> {
    const deposit: AnchorDepositInfo = Anchor.generateDeposit(destChainId);
    let _encryptedNote: string = '0x000000'
    if (encryptedNote) {
      const _encryptedNote: string = encryptedNote;
    } 


    const tx = await this.contract.deposit(
      anchorAddr,
      toFixedHex(deposit.commitment),
      _encryptedNote,
      { gasLimit: '0x5B8D80' }
    );
  
    await tx.wait();

    const anchor = this.anchorProxyMap.get(anchorAddr);
    if (!anchor) {
      throw new Error('Anchor not found');
    }

    const index: number = anchor.tree.insert(deposit.commitment);
    return { deposit, index };
  }

  public async withdraw(
    anchorAddr: string,
    deposit: AnchorDepositInfo,
    index: number,
    recipient: string,
    relayer: string,
    fee: bigint,
    refreshCommitment: string | number,
  ): Promise<RefreshEvent | WithdrawalEvent> {
    const anchor = this.anchorProxyMap.get(anchorAddr);
    if (!anchor) {
      throw new Error('Anchor not found');
    }
    const { args, input, proofEncoded, publicInputs } = await anchor.setupWithdraw(
      deposit,
      index,
      recipient,
      relayer,
      fee,
      refreshCommitment,
    );
    //@ts-ignore
    let tx = await this.contract.withdraw(
      anchorAddr,
      `0x${proofEncoded}`,
      publicInputs,
      { gasLimit: '0x5B8D80' }
    );
    const receipt = await tx.wait();

    if (args[2] !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      anchor.tree.insert(input.refreshCommitment);
      const filter = anchor.contract.filters.Refresh(null, null, null);
      const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    } else {
      const filter = anchor.contract.filters.Withdrawal(null, null, relayer, null);
      const events = await anchor.contract.queryFilter(filter, receipt.blockHash);
      return events[0];
    }
  }

  public insertAnchor(anchor: Anchor) {
    this.anchorProxyMap.set(anchor.contract.address, anchor);
  }
}
