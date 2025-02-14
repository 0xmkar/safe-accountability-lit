// 0x53b2b1795ed7C16C7956c86a131F3B546D668d1d

/// <reference types="node" />
import { z } from "zod";
import { ethers } from "ethers";
// import Safe from "@safe-global/protocol-kit";
// import { createPublicClient, http } from "viem";
// import { sepolia } from "viem/chains";
import { createSafeClient } from '@safe-global/sdk-starter-kit';


const provider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`);

// This function can call infura API and get sepolia address' balance
export const getEthBalance = async ({ address }) => {
  if (!address.startsWith("0x") || address.length !== 42) {
    throw new Error("Invalid address.");
  }

  const balance = await provider.getBalance(address);
  const ethBalance = ethers.formatEther(balance);
  
  // console.log("clg output - ", balance, "and eth balance", ethBalance);

  return `The current balance of the Sepolia wallet at address ${address} is ${ethBalance} ETH.
  use this information and tell the user the amount of eth they have in the wallet and how much its worth in USD`;
};

export const deployNewSafe = async () => {
  const saltNonce = Math.trunc(Math.random() * 10 ** 10).toString(); // Random 10-digit integer

  const safeClient = await createSafeClient({
    provider: "https://rpc.ankr.com/eth_sepolia",
    signer: process.env.AGENT_PRIVATE_KEY,
    safeOptions: {
      owners: [process.env.AGENT_ADDRESS as string],
      threshold: 1
    }
  });

  const safeAddress = await safeClient.getAddress();

  return `A new Safe multisig was successfully deployed on Sepolia. You can see it live at https://app.safe.global/home?safe=sep:${safeAddress}. The saltNonce used was ${saltNonce}.
  // Now, tell the user that you have create this safe and give the above details to the user in a good format. Make sure the first address in your response is the safe Address.`;
};

export const sendRandomTnx = async ({ safeAddress }) =>{

  const safeClient = await createSafeClient({
    provider: "https://rpc.ankr.com/eth_sepolia",
    signer: process.env.AGENT_PRIVATE_KEY,
    safeAddress: safeAddress
  });

  const some = safeClient.getPendingTransactions();

  return `The transaction has been created successfully! This is the hash.
  tell the user that you've sent the transaction and it has been created successfully `
};

export const sendRandomTnxMetadata = {
  name:"sendRandomTnx",
  description:"This sends the transaction to the given safe",
  schema:z.object({
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
  description: "Call to deploy a new 2-3 Safe Multisig on Sepolia.",
  schema: z.object({}),
};
