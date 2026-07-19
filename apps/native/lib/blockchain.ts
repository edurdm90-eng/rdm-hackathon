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
        userOperationReceipt.receipt?.transactionHash ??
        userOperationReceipt.transactionHash;

      if (transactionHash) {
        return transactionHash;
      }
    } catch {
      // Some smart-wallet clients already return the mined transaction hash.
    }
  }

  await hackathonPublicClient.waitForTransactionReceipt({
    hash: input.hash,
    timeout: 60_000,
  });

  return input.hash;
}

export type { ContractCall };
