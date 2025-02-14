/// <reference types="node" />
import { z } from "zod";
import { ethers } from "ethers";
import { createSafeClient } from '@safe-global/sdk-starter-kit';

// Import Lit Protocol dependencies
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY, LIT_RPC } from "@lit-protocol/constants";
import {
  createSiweMessage,
  generateAuthSig,
  LitPKPResource
} from "@lit-protocol/auth-helpers";
import { PKPEthersWallet } from "@lit-protocol/pkp-ethers";
import { ILitNodeClient } from "@lit-protocol/types";

import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// PKP Configuration
const ETHEREUM_PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const LIT_PKP_PUBLIC_KEY = process.env.PKP_ADD || "";

let pkpWallet: PKPEthersWallet | null = null;
let litNodeClient: ILitNodeClient | null = null;

// Initialize the Lit Node Client
async function initializeLitNodeClient(): Promise<ILitNodeClient> {
  if (litNodeClient) return litNodeClient;
  
  litNodeClient = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev,
    debug: false,
  });
  await litNodeClient.connect();
  return litNodeClient;
}

// Initialize the PKP Wallet
export async function initializePKPWallet(): Promise<PKPEthersWallet> {
  if (pkpWallet) return pkpWallet;
  
  const client = await initializeLitNodeClient();
  
  // Setup ethers wallet for authentication
  const ethersWallet = new ethers.Wallet(
    ETHEREUM_PRIVATE_KEY,
    new ethers.JsonRpcProvider(LIT_RPC.CHRONICLE_YELLOWSTONE)
  );

  const sessionSignatures = await (client as any).getSessionSigs({
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
      const nonce = `${Date.now().toString()}${Math.random().toString(36).substring(2, 15)}`;
      
      const toSign = await createSiweMessage({
        uri,
        expiration,
        resources: resourceAbilityRequests,
        walletAddress: await ethersWallet.getAddress(),
        nonce, // Use our custom nonce
        litNodeClient: client,
      });

      return await generateAuthSig({
        signer: ethersWallet,
        toSign,
      });
    },
  });
  
  // Initialize PKP Ethers Wallet
  pkpWallet = new PKPEthersWallet({
    litNodeClient: client,
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

const getProvider = () => {
  return new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);
};

export const getEthBalance = async ({ address }) => {
  if (!address.startsWith("0x") || address.length !== 42) {
    throw new Error("Invalid address.");
  }

  const provider = getProvider();
  const balance = await provider.getBalance(address);
  const ethBalance = ethers.formatEther(balance);

  return `The current balance of the Sepolia wallet at address ${address} is ${ethBalance} ETH.
  use this information and tell the user the amount of eth they have in the wallet and how much its worth in USD`;
};

// Deploy a new Safe using the PKP wallet
export const deployNewSafe = async () => {
  const pkp = await getPKPWallet();
  const saltNonce = Math.trunc(Math.random() * 10 ** 10).toString(); // Random 10-digit integer
  
  const pkpAddress = await pkp.getAddress();
  
  const privateKey = await pkp.privateKey;
  const wallet = new ethers.Wallet(privateKey);
  
  const safeClient = await createSafeClient({
    provider: "https://rpc.ankr.com/eth_sepolia",
    signer: privateKey,
    safeOptions: {
      owners: [pkpAddress],
      threshold: 1
    }
  });

  const safeAddress = await safeClient.getAddress();

  return `A new Safe multisig was successfully deployed on Sepolia. You can see it live at https://app.safe.global/home?safe=sep:${safeAddress}. The saltNonce used was ${saltNonce}.
  // Now, tell the user that you have create this safe and give the above details to the user in a good format. Make sure the first address in your response is the safe Address.`;
};

export function calculateUSDCdistribution({n, d, f}): string {
  if (n <= 0 || d <= 0 || f < 0 || f > n) {
      throw new Error("Invalid input parameters. Ensure n > 0, d > 0, and 0 <= f <= n.");
  }

  if (f === 0) {
      return  "No one failed. No funds to distribute.";
  }

  // Calculate total distribution and reward per successful participant
  const totalDistribution = f * d;
  const s = n - f;
  const rewardPerSuccessfulParticipant = totalDistribution / s;

  return `Each successful participant receives ${rewardPerSuccessfulParticipant.toFixed(2)} USDC.`;
}

// Send transaction using PKP wallet
export const sendTnx = async ({ safeAddress }) => {
  const pkp = await getPKPWallet();
  const privateKey = await pkp.privateKey;
  
  const safeClient = await createSafeClient({
    provider: "https://rpc.ankr.com/eth_sepolia",
    signer: privateKey,
    safeAddress: safeAddress
  });

  const pendingTxs = await safeClient.getPendingTransactions();

  return `The transaction has been created successfully! This is the hash.
  tell the user that you've sent the transaction and it has been created successfully`;
};

export const calculateUSDCdistributionMetadata = {
  name: "calculateUSDCdistribution",
  description:
    "Calculates the USDC distribution for an accountability platform. It determines how much each successful participant receives when failed participants forfeit their deposits.",
  schema: z
    .object({
      n: z.number().positive("Total participants (n) must be a positive number."),
      d: z.number().positive("Deposit amount (d) must be a positive number."),
      f: z.number().nonnegative("Number of failures (f) must be a non-negative number."),
    }),
};

export const sendTnxMetadata = {
  name: "sendTnx",
  description: "This sends the transaction to the given safe using PKP wallet",
  schema: z.object({
    safeAddress: z.string(),
  }),
};

export const getEthBalanceMetadata = {
  name: "getEthBalance",
  description:
    "Call to Get the balance in ETH of a given Sepolia address.",
  schema: z.object({
    address: z.string(),
  }),
};

export const deployNewSafeMetadata = {
  name: "deployNewSafe",
  description: "Call to deploy a new Safe Multisig on Sepolia using PKP wallet",
  schema: z.object({}),
};

// Initialize wallet on startup if needed
(async () => {
  try {
    const wallet = await getPKPWallet();
    console.log("PKP wallet ready with address:", await wallet.getAddress());
  } catch (error) {
    console.error("Failed to initialize PKP wallet:", error);
  }
})();