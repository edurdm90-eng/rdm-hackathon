import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import {
  polygonAmoyDeployment,
  xrdmImplementationAbi,
} from "@rdm-hack/blockchain-client";
import { createPublicClient, encodeFunctionData, http, type Hex } from "viem";

type ContractCall = {
  data: Hex;
  to: Hex;
  value: bigint;
};

const polygonAmoyChain = {
  blockExplorers: {
    default: {
      name: "PolygonScan Amoy",
      url: "https://amoy.polygonscan.com",
    },
  },
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: {
    decimals: 18,
    name: "POL",
    symbol: "POL",
  },
  rpcUrls: {
    default: {
      http: [
        "https://polygon-amoy-bor-rpc.publicnode.com",
        "https://rpc-amoy.polygon.technology",
      ],
    },
  },
  testnet: true,
} as const;

const hackathonPublicClient = createPublicClient({
  chain: polygonAmoyChain,
  transport: http(polygonAmoyChain.rpcUrls.default.http[0]),
});

function makeCreateHackathonCall(): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      functionName: "createHackathon",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

async function resolveTransactionHash(input: { client: unknown; hash: Hex }) {
  const maybeSmartClient = input.client as {
    waitForUserOperationReceipt?: (args: { hash: Hex }) => Promise<{
      receipt?: { transactionHash?: Hex };
      transactionHash?: Hex;
    }>;
  };

  if (maybeSmartClient.waitForUserOperationReceipt) {
    try {
      const userOperationReceipt = await maybeSmartClient.waitForUserOperationReceipt({
        hash: input.hash,
      });
      const transactionHash =
        userOperationReceipt.receipt?.transactionHash ?? userOperationReceipt.transactionHash;

      if (transactionHash) {
        return transactionHash;
      }
    } catch {
      // Some Privy clients already return the mined transaction hash.
    }
  }

  await hackathonPublicClient.waitForTransactionReceipt({
    hash: input.hash,
    timeout: 60_000,
  });

  return input.hash;
}

export function getHackRoomBlockchainErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to create the room on-chain.";

  if (
    message.includes("Failed to create smart wallet client for chain id") ||
    message.includes("must be configured in the smart wallet configuration")
  ) {
    return "Privy smart wallet is not ready for Polygon Amoy (80002). Wait a moment and try again. If it keeps happening, the Privy app owner must enable Smart Wallets for Polygon Amoy in the Privy dashboard.";
  }

  return message;
}

export function useHackRoomBlockchain() {
  const { getClientForChain } = useSmartWallets();

  async function createHackathonOnchain() {
    const smartWalletClient = await getClientForChain({
      id: polygonAmoyDeployment.chainId,
    });

    if (!smartWalletClient) {
      throw new Error("Privy smart wallet is not ready yet.");
    }

    const operationHash = await smartWalletClient.sendTransaction({
      calls: [makeCreateHackathonCall()],
    });

    return resolveTransactionHash({
      client: smartWalletClient,
      hash: operationHash,
    });
  }

  return {
    createHackathonOnchain,
  };
}

export { polygonAmoyChain };
