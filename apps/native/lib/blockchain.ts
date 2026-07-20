import {
  polygonAmoyChain,
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
type WaitForTransactionReceipt = (args: { hash: Hex; timeout: number }) => Promise<unknown>;

const TRANSACTION_RECEIPT_TIMEOUT_MS = 180_000;

export const hackathonPublicClient = createPublicClient({
  chain: polygonAmoyChain,
  transport: http(polygonAmoyChain.rpcUrls.default.http[0]),
});

export function makeCreateHackathonCall(): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      functionName: "createHackathon",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

export function makeRegisterParticipantsCall(input: {
  hackathonId: string;
  participantAddresses: Array<string>;
}): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      args: [
        BigInt(input.hackathonId),
        input.participantAddresses as Array<Hex>,
      ],
      functionName: "registerParticipants",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

export function makeAwardXrdmCall(input: {
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

export function makeNoteWinnersCall(input: {
  hackathonId: string;
  winnerAddresses: Array<string>;
}): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      args: [
        BigInt(input.hackathonId),
        input.winnerAddresses as Array<Hex>,
      ],
      functionName: "noteWinners",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

export function makeAwardNftCall(input: {
  hackathonId: string;
  metadataUri: string;
  recipientAddress: string;
}): ContractCall {
  return {
    data: encodeFunctionData({
      abi: xrdmImplementationAbi,
      args: [
        BigInt(input.hackathonId),
        input.recipientAddress as Hex,
        input.metadataUri,
      ],
      functionName: "awardNFT",
    }),
    to: polygonAmoyDeployment.eduProxy as Hex,
    value: 0n,
  };
}

export async function resolveTransactionHash(input: {
  client: unknown;
  hash: Hex;
}) {
  const maybeSmartClient = input.client as {
    waitForUserOperationReceipt?: WaitForUserOperationReceipt;
  };

  return resolveTransactionHashWithWaiters({
    hash: input.hash,
    waitForTransactionReceipt: (args) => hackathonPublicClient.waitForTransactionReceipt(args),
    waitForUserOperationReceipt: maybeSmartClient.waitForUserOperationReceipt,
  });
}

export async function resolveTransactionHashWithWaiters(input: {
  hash: Hex;
  waitForTransactionReceipt: WaitForTransactionReceipt;
  waitForUserOperationReceipt?: WaitForUserOperationReceipt;
}) {
  const waitForDirectTransaction = async () => {
    await input.waitForTransactionReceipt({
      hash: input.hash,
      timeout: TRANSACTION_RECEIPT_TIMEOUT_MS,
    });

    return input.hash;
  };

  if (!input.waitForUserOperationReceipt) {
    return waitForDirectTransaction();
  }

  const waitForSmartWalletOperation = async () => {
    const userOperationReceipt = await input.waitForUserOperationReceipt?.({
      hash: input.hash,
    });
    const transactionHash =
      userOperationReceipt?.receipt?.transactionHash ??
      userOperationReceipt?.transactionHash;

    if (!transactionHash) {
      throw new Error("Smart wallet receipt did not include a transaction hash.");
    }

    return transactionHash;
  };

  // Privy may return either a UserOperation hash or an already-submitted tx hash.
  // Racing both receipt paths avoids a slow AA receipt wait when the tx hash is already usable.
  return firstResolvedTransactionHash([
    waitForDirectTransaction,
    waitForSmartWalletOperation,
  ]);
}

async function firstResolvedTransactionHash(tasks: Array<() => Promise<Hex>>) {
  return new Promise<Hex>((resolve, reject) => {
    const errors: Array<unknown> = [];
    let pending = tasks.length;

    tasks.forEach((task) => {
      void task()
        .then(resolve)
        .catch((error) => {
          errors.push(error);
          pending -= 1;

          if (pending === 0) {
            reject(errors[0] ?? new Error("Unable to resolve blockchain transaction hash."));
          }
        });
    });
  });
}

export type { ContractCall };
