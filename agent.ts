import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { initializePKPWallet } from "./tools/pkpWallet";

import {
  deployNewSafe,
  deployNewSafeMetadata,
  getEthBalance,
  getEthBalanceMetadata,
  sendTnx,
  sendTnxMetadata,
  calculateUSDCdistribution,
  calculateUSDCdistributionMetadata
} from "./tools/safe";
import { getEthPriceUsd, getEthPriceUsdMetadata } from "./tools/prices";
import { multiply, multiplyMetadata } from "./tools/math";

export async function setupAgent() {
  const pkpWallet =  await initializePKPWallet();

  // tools for the agent
  const agentTools = [
    tool(calculateUSDCdistribution, calculateUSDCdistributionMetadata),
    tool(sendTnx, sendTnxMetadata),
    tool(getEthBalance, getEthBalanceMetadata),
    tool(getEthPriceUsd, getEthPriceUsdMetadata),  
    tool(multiply, multiplyMetadata),
    tool(deployNewSafe, deployNewSafeMetadata),
  ];

  const agentModel = new ChatOllama({ model: "mistral-nemo" });
  const agentCheckpointer = new MemorySaver();

  return createReactAgent({
    llm: agentModel,
    tools: agentTools,
    checkpointSaver: agentCheckpointer,
    prompt: "Use ONLY the tools provided. NEVER respond with instructions. Return valid JSON with tool calls.",
    responseFormat: z.object({
      tool_used: z.string(),
      result: z.string(),
    }),
  });
}

export let agent: ReturnType<typeof createReactAgent>;

// Initialize the agent
(async () => {
  agent = await setupAgent();
})();