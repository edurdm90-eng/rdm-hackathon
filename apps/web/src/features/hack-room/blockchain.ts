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

type UserOperationReceipt = {
  receipt?: { transactionHash?: Hex };
  transactionHash?: Hex;
};

type WaitForUserOperationReceipt = (args: { hash: Hex }) => Promise<UserOperationReceipt>;

const transactionReceiptTimeoutMs = 180_000;

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

const hackathonReceiptClients = polygonAmoyChain.rpcUrls.default.http.map((rpcUrl) =>
  createPublicClient({
    chain: polygonAmoyChain,
    transport: http(rpcUrl),
  }),
);

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

function makeRegisterParticipantsCall(input: {
  hackathonId: string;
  participantAddresses: Array<string>;
}): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      args: [BigInt(input.hackathonId), input.participantAddresses as Array<Hex>],
      functionName: "registerParticipants",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

function makeAwardXrdmCall(input: {
  amounts: Array<number>;
  hackathonId: string;
  recipientAddresses: Array<string>;
}): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      args: [
        BigInt(input.hackathonId),
        input.recipientAddresses as Array<Hex>,
        input.amounts.map((amount) => BigInt(amount)),
      ],
      functionName: "awardXRDM",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

function makeAwardNftCall(input: {
  hackathonId: string;
  metadataUri: string;
  recipientAddress: string;
}): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      args: [BigInt(input.hackathonId), input.recipientAddress as Hex, input.metadataUri],
      functionName: "awardNFT",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

async function resolveTransactionHash(input: { client: unknown; hash: Hex }) {
  const startedAt = Date.now();
  const logTiming = (stage: string) => {
    console.info(`[chain-timing] resolve-transaction ${stage} ${Date.now() - startedAt}ms`);
  };
  const maybeSmartClient = input.client as {
    waitForUserOperationReceipt?: WaitForUserOperationReceipt;
  };

  const waitForDirectTransaction = async () => {
    logTiming(`direct-receipt-start ${input.hash}`);
    await firstResolved(
      hackathonReceiptClients.map((client) => async () => {
        await client.waitForTransactionReceipt({
          hash: input.hash,
          timeout: transactionReceiptTimeoutMs,
        });
      }),
    );
    logTiming(`direct-receipt-mined ${input.hash}`);

    return input.hash;
  };

  if (!maybeSmartClient.waitForUserOperationReceipt) {
    return waitForDirectTransaction();
  }

  const waitForSmartWalletOperation = async () => {
    logTiming(`user-operation-receipt-start ${input.hash}`);
    const userOperationReceipt = await maybeSmartClient.waitForUserOperationReceipt?.({
      hash: input.hash,
    });
    const transactionHash =
      userOperationReceipt?.receipt?.transactionHash ?? userOperationReceipt?.transactionHash;

    if (!transactionHash) {
      throw new Error("Smart wallet receipt did not include a transaction hash.");
    }

    logTiming(`user-operation-receipt-resolved ${transactionHash}`);
    return transactionHash;
  };

  // Privy may return either a UserOperation hash or an already-submitted tx hash.
  // Racing both receipt paths avoids the slow AA receipt wait when the tx hash is already usable.
  return firstResolved([waitForDirectTransaction, waitForSmartWalletOperation]);
}

async function firstResolved<T>(tasks: Array<() => Promise<T>>) {
  return new Promise<T>((resolve, reject) => {
    const errors: Array<unknown> = [];
    let pending = tasks.length;
    let settled = false;

    tasks.forEach((task) => {
      void task()
        .then((value) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        })
        .catch((error) => {
          errors.push(error);
          pending -= 1;

          if (pending === 0 && !settled) {
            reject(errors[0] ?? new Error("Unable to resolve blockchain transaction hash."));
          }
        });
    });
  });
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

  async function getSmartWalletClient() {
    const smartWalletClient = await getClientForChain({
      id: polygonAmoyDeployment.chainId,
    });

    if (!smartWalletClient) {
      throw new Error("Privy smart wallet is not ready yet.");
    }

    return smartWalletClient;
  }

  async function createHackathonOnchain() {
    const smartWalletClient = await getSmartWalletClient();

    const operationHash = await smartWalletClient.sendTransaction({
      calls: [makeCreateHackathonCall()],
    });

    return resolveTransactionHash({
      client: smartWalletClient,
      hash: operationHash,
    });
  }

  async function sendContractCalls(calls: Array<ContractCall>) {
    if (!calls.length) {
      return null;
    }

    const smartWalletClient = await getSmartWalletClient();
    const operationHash = await smartWalletClient.sendTransaction({
      calls,
    });

    return resolveTransactionHash({
      client: smartWalletClient,
      hash: operationHash,
    });
  }

  return {
    createHackathonOnchain,
    sendContractCalls,
  };
}

export {
  makeAwardNftCall,
  makeAwardXrdmCall,
  makeRegisterParticipantsCall,
  polygonAmoyChain,
};
export type { ContractCall };
