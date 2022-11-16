// @ts-nocheck
require("dotenv").config({ path: "../.env" });
import { ethers } from "ethers";
import { FungibleTokenWrapper__factory } from "../../../typechain/factories/FungibleTokenWrapper__factory";

export async function viewTokensInWrapper(
  tokenWrapperAddress: string,
  passedProvider: ethers.providers.JsonRpcProvider
) {
  const fungibleTokenWrapper = FungibleTokenWrapper__factory.connect(
    tokenWrapperAddress,
    passedProvider
  );
  const tokens = await fungibleTokenWrapper.functions.getTokens();

  const allowedNative = await fungibleTokenWrapper.isNativeAllowed();
  console.log("Tokens in the wrapper: ");
  console.log(tokens);
  console.log("nativeAllowed? ", allowedNative);
}
