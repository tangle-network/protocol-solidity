import { ethers } from "ethers";
import Anchor from "../../../lib/darkwebb/Anchor";
import { depositErc20TokenAnchor } from "../deposits/depositErc20TokenAnchor";
import { bridgedWithdrawErc20Token } from "../withdrawals/bridgedWithdrawErc20Token";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function depositAndBridgedWithdraw(
  depositAnchor: Anchor,
  withdrawAnchor: Anchor,
  depositWallet: ethers.Signer,
  withdrawWallet: ethers.Signer,
  recipient: string,
) {
  const destinationChain = await withdrawWallet.getChainId();
  const deposit = await depositErc20TokenAnchor(
    depositAnchor,
    depositAnchor.token ? depositAnchor.token : '0x0000000000000000000000000000000000000000',
    destinationChain,
    depositWallet,
  );

  // Allow time for relayer network to update anchor state on withdraw side
  await sleep(150000);

  const proof = depositAnchor.tree.path(deposit.index);
  const withdraw = await bridgedWithdrawErc20Token(withdrawAnchor, proof, deposit, recipient);
}
