import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY, LIT_RPC } from "@lit-protocol/constants";
import {
  createSiweMessage,
  generateAuthSig,
  LitPKPResource
} from "@lit-protocol/auth-helpers";
import { PKPEthersWallet } from "@lit-protocol/pkp-ethers";
import * as ethers from "ethers";
import { ILitNodeClient } from "@lit-protocol/types";
import dotenv from "dotenv";
dotenv.config();

const ETHEREUM_PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const LIT_PKP_PUBLIC_KEY = process.env.PKP_ADD || "";

let pkpWallet: PKPEthersWallet | null = null;

export async function initializePKPWallet(): Promise<PKPEthersWallet> {
  if (pkpWallet) return pkpWallet;
  
  // Initialize Lit Node Client
  const litNodeClient: ILitNodeClient = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev,
    debug: false,
  });
  await litNodeClient.connect();
  
  // Setup ethers wallet for authentication
  const ethersWallet = new ethers.Wallet(
    ETHEREUM_PRIVATE_KEY,
    new ethers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
  );
  
  // Get session signatures
  const sessionSignatures = await litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(), // 1 hour
    resourceAbilityRequests: [
      {
        resource: new LitPKPResource("*"),
        ability: LIT_ABILITY.PKPSigning,
      },
    ],
    authNeededCallback: async ({
      uri,
      expiration,
      resourceAbilityRequests,
    }) => {
      const toSign = await createSiweMessage({
        uri,
        expiration,
        resources: resourceAbilityRequests,
        walletAddress: await ethersWallet.getAddress(),
        nonce: await litNodeClient.getLatestBlockhash(),
        litNodeClient,
      });

      return await generateAuthSig({
        signer: ethersWallet,
        toSign,
      });
    },
  });
  
  // Initialize PKP Ethers Wallet
  pkpWallet = new PKPEthersWallet({
    litNodeClient: litNodeClient as ILitNodeClient,
    pkpPubKey: LIT_PKP_PUBLIC_KEY,
    controllerSessionSigs: sessionSignatures
  });
  
  await pkpWallet.init();
  console.log("PKP Wallet initialized with address:", await pkpWallet.getAddress());
  
  return pkpWallet;
}

export async function getPKPWallet(): Promise<PKPEthersWallet> {
  if (!pkpWallet) {
    return await initializePKPWallet();
  }
  return pkpWallet;
}

// (async () => {
//   const some = await getPKPWallet();
// })();
