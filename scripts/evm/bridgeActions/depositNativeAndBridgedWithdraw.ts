import { ethers } from "ethers";
import { Anchor } from "@webb-tools/fixed-bridge";
import { depositNativeTokenAnchor } from "../deposits/depositNativeTokenAnchor";
import { bridgedWithdrawWebbToken } from "../withdrawals/bridgedWithdrawWebbToken";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function depositNativeAndBridgedWithdraw(
  depositAnchor: Anchor,
  withdrawAnchor: Anchor,
  depositWallet: ethers.Signer,
  withdrawWallet: ethers.Signer,
  recipient: string,
) {
  const destinationChain = await withdrawWallet.getChainId();
  const deposit = await depositNativeTokenAnchor(
    depositAnchor,
    destinationChain,
    depositWallet,
  );

  // Allow time for relayer network to update anchor state on withdraw side
  await sleep(150000);

  const proof = depositAnchor.tree.path(deposit.index);
  const withdraw = await bridgedWithdrawWebbToken(withdrawAnchor, proof, deposit, recipient);
  console.log('withdraw event: ', withdraw);
}
