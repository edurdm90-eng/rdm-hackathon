import {
  polygonAmoyChain,
  polygonAmoyDeployment,
  xrdmImplementationAbi,
} from "../../../blockchain-client/src/index.js";
import { TRPCError } from "@trpc/server";
import { ObjectId, type Filter } from "mongodb";
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseEventLogs,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { z } from "zod";

import { normalizeUserRole, type UserRole } from "../../../auth/src/roles.js";
import { client } from "../../../db/src/index.js";
import { env } from "../../../env/src/server.js";
import { protectedProcedure, router } from "../index.js";

const proofTypeSchema = z.enum(["github", "drive", "file", "url", "video", "deck", "game_score"]);
const taskKindSchema = z.enum(["task", "challenge", "game", "special"]);
const gameTypeSchema = z.enum(["memory_match", "breath_timer", "quick_maths"]);
const rewardKindSchema = z.enum([
  "participant_certificate",
  "winner_certificate",
  "winner_nft_badge",
]);
const addressSchema = z
  .string()
  .trim()
  .refine(isAddress, "Enter a valid EVM wallet address")
  .transform((value) => getAddress(value));
const txHashSchema = z
  .string()
  .trim()
  .regex(/^0x[0-9a-fA-F]{64}$/, "Enter a valid transaction hash")
  .transform((value) => value as Hex);
const proofItemSchema = z.object({
  type: proofTypeSchema,
  value: z.string().trim().min(3).max(500),
});

function isLinkProofType(proofType: z.infer<typeof proofTypeSchema>) {
  return proofType !== "game_score";
}

function isHttpsProofUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("https://")) {
    return false;
  }

  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

type OnchainStatus = "not_created" | "pending" | "confirmed" | "failed";
type ChainEventKind =
  | "room_created"
  | "participants_registered"
  | "submission_xrdm_awarded"
  | "winner_noted"
  | "winner_xrdm_awarded"
  | "reward_xrdm_awarded"
  | "reward_nft_awarded";

type ParticipantRecord = {
  userId: string;
  name: string;
  email: string;
  embeddedWalletAddress?: string;
  joinedAt: string;
  onchainAddress?: string;
  onchainRegisteredAt?: string;
  registerTxHash?: string;
  smartWalletAddress?: string;
};

type HackRoomRecord = {
  _id: string;
  name: string;
  description: string;
  inviteCode: string;
  hostId: string;
  hostName: string;
  hostEmbeddedWalletAddress?: string;
  hostOnchainAddress?: string;
  hostSmartWalletAddress?: string;
  status: "active" | "closed";
  participants: ParticipantRecord[];
  chainId?: number;
  createdAt: string;
  contractAddress?: string;
  createTxHash?: string;
  onchainHackathonId?: string;
  onchainStatus?: OnchainStatus;
  updatedAt: string;
};

type HackTaskRecord = {
  _id: string;
  roomId: string;
  hostId: string;
  kind?: z.infer<typeof taskKindSchema>;
  gameType?: z.infer<typeof gameTypeSchema>;
  assignedToEmail?: string;
  assignedToName?: string;
  assignedToUserId?: string;
  title: string;
  description: string;
  dueAt: string;
  rewardXrdm: number;
  proofTypes: Array<z.infer<typeof proofTypeSchema>>;
  createdAt: string;
  updatedAt: string;
};

type HackSubmissionRecord = {
  _id: string;
  roomId: string;
  taskId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  proofItems?: Array<z.infer<typeof proofItemSchema>>;
  proofUrl: string;
  notes: string;
  submissionDescription?: string;
  submitterName?: string;
  teamMateEmails?: string[];
  teamName?: string;
  status: "submitted" | "approved" | "winner" | "returned";
  hostFeedback?: string;
  awardXrdm?: number;
  onchainAwardStatus?: Extract<OnchainStatus, "pending" | "confirmed" | "failed">;
  onchainAwardTxHash?: string;
  onchainWinnerStatus?: Extract<OnchainStatus, "pending" | "confirmed" | "failed">;
  onchainWinnerTxHash?: string;
  submittedAt: string;
  reviewedAt?: string;
  updatedAt: string;
};

type RewardRecipientRecord = {
  userId: string;
  name: string;
  email: string;
  nftTokenId?: string;
  onchainAddress?: string;
  smartWalletAddress?: string;
};

type HackRewardRecord = {
  _id: string;
  roomId: string;
  hostId: string;
  hostName: string;
  kind: z.infer<typeof rewardKindSchema>;
  title: string;
  description: string;
  awardXrdm: number;
  ledgerNote: string;
  recipients: RewardRecipientRecord[];
  chainId?: number;
  contractAddress?: string;
  metadataUri?: string;
  nftTxHash?: string;
  onchainStatus?: Extract<OnchainStatus, "pending" | "confirmed" | "failed">;
  sourceSubmissionId?: string;
  sourceSubmissionTitle?: string;
  teamName?: string;
  status: "pending" | "issued";
  xrdmTxHash?: string;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
};

type HackNotificationRecord = {
  _id: string;
  roomId: string;
  hostId: string;
  hostName: string;
  title: string;
  message: string;
  recipientIds: string[];
  recipientEmails: string[];
  createdAt: string;
  updatedAt: string;
};

type AuthUserRecord = {
  email: string;
  embeddedWalletAddress?: string;
  id?: string;
  name?: string;
  onchainAddress?: string;
  role?: unknown;
  smartWalletAddress?: string;
};

type HackChainEventRecord = {
  _id: string;
  appEntityId: string;
  blockNumber?: string;
  confirmedAt?: string;
  createdAt: string;
  expectedAmount?: number;
  expectedHackathonId?: string;
  expectedRecipients?: string[];
  idempotencyKey: string;
  kind: ChainEventKind;
  roomId: string;
  status: "confirmed" | "failed" | "pending";
  txHash: string;
  updatedAt: string;
};

type AuthUserDocument = AuthUserRecord & {
  _id?: ObjectId | string | { toString: () => string };
};

const roomCollection = () => client.collection<HackRoomRecord>("hack_rooms");
const taskCollection = () => client.collection<HackTaskRecord>("hack_tasks");
const submissionCollection = () => client.collection<HackSubmissionRecord>("hack_submissions");
const rewardCollection = () => client.collection<HackRewardRecord>("hack_rewards");
const notificationCollection = () => client.collection<HackNotificationRecord>("hack_notifications");
const userCollection = () => client.collection<AuthUserRecord>("user");
const chainEventCollection = () => client.collection<HackChainEventRecord>("hack_chain_events");

const publicChainClients = polygonAmoyChain.rpcUrls.default.http.map((rpcUrl) =>
  createPublicClient({
    chain: polygonAmoyChain,
    transport: http(rpcUrl),
  }),
);

let idCounter = 0;

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  idCounter = (idCounter + 1) % 1_000_000;
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 12);
  const counter = idCounter.toString(36).padStart(4, "0");
  return `${prefix}_${timestamp}${randomPart}${counter}`;
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HR-";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function createUniqueInviteCode() {
  for (let attempts = 0; attempts < 8; attempts++) {
    const inviteCode = makeInviteCode();
    const existing = await roomCollection().findOne({ inviteCode });
    if (!existing) {
      return inviteCode;
    }
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not generate a unique invite code",
  });
}

async function requireHostedRoom(roomId: string, hostId: string) {
  const room = await roomCollection().findOne({ _id: roomId });
  if (!room) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Hack room not found",
    });
  }
  if (room.hostId !== hostId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the host can manage this hack room",
    });
  }
  return room;
}

function getUserId(user: AuthUserDocument) {
  return user.id ?? user._id?.toString() ?? "";
}

function userIdLookup(userId: string): Filter<AuthUserRecord> {
  const filters: Filter<AuthUserRecord>[] = [{ id: userId }];

  if (ObjectId.isValid(userId)) {
    filters.push({ _id: new ObjectId(userId) });
  }

  return { $or: filters };
}

function sessionUserLookup(user: { email?: string | null; id: string }): Filter<AuthUserRecord> {
  const filters: Filter<AuthUserRecord>[] = [{ id: user.id }];

  if (ObjectId.isValid(user.id)) {
    filters.push({ _id: new ObjectId(user.id) });
  }

  if (user.email) {
    filters.push({ email: user.email.toLowerCase() });
  }

  return { $or: filters };
}

async function getUserRole(userId: string): Promise<UserRole> {
  const user = await userCollection().findOne(userIdLookup(userId), {
    projection: { role: 1 },
  });

  return normalizeUserRole(user?.role);
}

async function requireHostRole(userId: string) {
  const role = await getUserRole(userId);

  if (role !== "host") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only users with the host role can create hack rooms",
    });
  }

  return role;
}

async function findRegisteredUserByEmail(email: string) {
  return userCollection().findOne({
    email: {
      $options: "i",
      $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
    },
  });
}

function isSpecialTaskForUser(task: HackTaskRecord, user: { email: string; id: string }) {
  if ((task.kind ?? "task") !== "special") {
    return true;
  }

  return (
    task.assignedToUserId === user.id ||
    task.assignedToEmail?.toLowerCase() === user.email.toLowerCase()
  );
}

function byNewest<T extends { createdAt?: string; submittedAt?: string }>(left: T, right: T) {
  const leftDate = left.submittedAt ?? left.createdAt ?? "";
  const rightDate = right.submittedAt ?? right.createdAt ?? "";
  return rightDate.localeCompare(leftDate);
}

function normalizeProofItems(submission: HackSubmissionRecord) {
  if (submission.proofItems?.length) {
    return submission.proofItems;
  }

  return submission.proofUrl
    ? [
        {
          type: "url" as const,
          value: submission.proofUrl,
        },
      ]
    : [];
}

function rewardLabel(kind: z.infer<typeof rewardKindSchema>) {
  if (kind === "participant_certificate") return "Member Certificate";
  if (kind === "winner_certificate") return "Winner Certificate";
  return "Winner NFT Badge";
}

function buildRewardMetadataUrl(rewardId: string) {
  return `${env.BETTER_AUTH_URL.replace(/\/$/, "")}/metadata/hack-rewards/${rewardId}.json`;
}

function normalizeStoredAddress(value?: string | null) {
  return value && isAddress(value) ? getAddress(value) : null;
}

function sameAddress(left?: string | null, right?: string | null) {
  const normalizedLeft = normalizeStoredAddress(left);
  const normalizedRight = normalizeStoredAddress(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

function requireRoomHackathonId(room: HackRoomRecord) {
  if (!room.onchainHackathonId || room.onchainStatus !== "confirmed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Create this room on-chain before issuing blockchain rewards",
    });
  }

  return BigInt(room.onchainHackathonId);
}

async function waitForSuccessfulReceipt(txHash: Hex) {
  const startedAt = Date.now();
  const receipt = await firstResolved(
    publicChainClients.map((chainClient, index) => async () => {
      const rpcStartedAt = Date.now();
      const candidateReceipt = await chainClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
      });

      console.info(
        `[chain-timing] backend-receipt rpc-${index} ${txHash} ${Date.now() - rpcStartedAt}ms`,
      );

      return candidateReceipt;
    }),
  );

  console.info(`[chain-timing] backend-receipt resolved ${txHash} ${Date.now() - startedAt}ms`);

  if (receipt.status !== "success") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blockchain transaction failed on-chain",
    });
  }

  return receipt;
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
            reject(errors[0] ?? new Error("Unable to resolve blockchain receipt."));
          }
        });
    });
  });
}

function getDecodedImplementationLogs(receipt: TransactionReceipt, eventName: string) {
  return parseEventLogs({
    abi: xrdmImplementationAbi,
    logs: receipt.logs,
    strict: false,
  }).filter((log) => {
    const decoded = log as { address?: string; eventName?: string };
    return (
      decoded.eventName === eventName &&
      sameAddress(decoded.address, polygonAmoyDeployment.eduProxy)
    );
  }) as Array<{
    address: Address;
    args: Record<string, unknown>;
    eventName: string;
  }>;
}

function getBigIntArg(args: Record<string, unknown>, key: string) {
  const value = args[key];

  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    return BigInt(value);
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Blockchain event is missing ${key}`,
  });
}

function getAddressArg(args: Record<string, unknown>, key: string) {
  const value = args[key];

  if (typeof value === "string" && isAddress(value)) {
    return getAddress(value);
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Blockchain event is missing ${key}`,
  });
}

function getAddressArrayArg(args: Record<string, unknown>, key: string) {
  const value = args[key];

  if (
    Array.isArray(value) &&
    value.every((item): item is string => typeof item === "string" && isAddress(item))
  ) {
    return value.map((item) => getAddress(item));
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Blockchain event is missing ${key}`,
  });
}

function assertAllAddressesIncluded(actual: Array<string>, expected: Array<string>) {
  const actualSet = new Set(actual.map((address) => getAddress(address)));
  const missing = expected.filter((address) => !actualSet.has(getAddress(address)));

  if (missing.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blockchain transaction does not include the expected recipient",
    });
  }
}

async function recordConfirmedChainEvent(input: {
  appEntityId: string;
  expectedAmount?: number;
  expectedHackathonId?: bigint;
  expectedRecipients?: Array<string>;
  idempotencyKey: string;
  kind: ChainEventKind;
  receipt: TransactionReceipt;
  roomId: string;
  txHash: Hex;
}) {
  const timestamp = now();

  await chainEventCollection().updateOne(
    { idempotencyKey: input.idempotencyKey },
    {
      $set: {
        blockNumber: input.receipt.blockNumber.toString(),
        confirmedAt: timestamp,
        expectedAmount: input.expectedAmount,
        expectedHackathonId: input.expectedHackathonId?.toString(),
        expectedRecipients: input.expectedRecipients?.map((address) => getAddress(address)),
        kind: input.kind,
        roomId: input.roomId,
        status: "confirmed",
        txHash: input.txHash,
        updatedAt: timestamp,
      },
      $setOnInsert: {
        _id: makeId("chain"),
        appEntityId: input.appEntityId,
        createdAt: timestamp,
        idempotencyKey: input.idempotencyKey,
      },
    },
    { upsert: true },
  );
}

async function verifyHackathonCreated(txHash: Hex, expectedHost: string) {
  const receipt = await waitForSuccessfulReceipt(txHash);
  const logs = getDecodedImplementationLogs(receipt, "HackathonCreated");
  const matchingLog = logs.find((log) => sameAddress(getAddressArg(log.args, "host"), expectedHost));

  if (!matchingLog) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blockchain transaction did not create a hackathon for this host wallet",
    });
  }

  return {
    hackathonId: getBigIntArg(matchingLog.args, "hackathonId"),
    receipt,
  };
}

async function verifyParticipantsRegistered(
  txHash: Hex,
  expectedHackathonId: bigint,
  expectedParticipants: Array<string>,
) {
  const receipt = await waitForSuccessfulReceipt(txHash);
  const logs = getDecodedImplementationLogs(receipt, "ParticipantsRegistered");
  const matchingLog = logs.find((log) => {
    if (getBigIntArg(log.args, "hackathonId") !== expectedHackathonId) {
      return false;
    }

    const participants = getAddressArrayArg(log.args, "participants");
    return expectedParticipants.every((address) => participants.includes(getAddress(address)));
  });

  if (!matchingLog) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blockchain transaction did not register the expected room members",
    });
  }

  return receipt;
}

async function verifyXrdmAwarded(
  txHash: Hex,
  expectedHackathonId: bigint,
  expectedRecipients: Array<string>,
  expectedAmounts: Array<number>,
) {
  const receipt = await waitForSuccessfulReceipt(txHash);
  const logs = getDecodedImplementationLogs(receipt, "XRDMAwarded");
  const unmatched = expectedRecipients.map((recipient, index) => ({
    amount: BigInt(expectedAmounts[index] ?? 0),
    recipient: getAddress(recipient),
  }));

  for (const log of logs) {
    if (getBigIntArg(log.args, "hackathonId") !== expectedHackathonId) {
      continue;
    }

    const recipient = getAddressArg(log.args, "recipient");
    const amount = getBigIntArg(log.args, "amount");
    const matchIndex = unmatched.findIndex(
      (expected) => expected.recipient === recipient && expected.amount === amount,
    );

    if (matchIndex >= 0) {
      unmatched.splice(matchIndex, 1);
    }
  }

  if (unmatched.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blockchain transaction did not award the expected XRDM",
    });
  }

  return receipt;
}

async function verifyWinnersNoted(
  txHash: Hex,
  expectedHackathonId: bigint,
  expectedWinners: Array<string>,
) {
  const receipt = await waitForSuccessfulReceipt(txHash);
  const logs = getDecodedImplementationLogs(receipt, "WinnersNoted");
  const matchingLog = logs.find((log) => {
    if (getBigIntArg(log.args, "hackathonId") !== expectedHackathonId) {
      return false;
    }

    const winners = getAddressArrayArg(log.args, "winners");
    return expectedWinners.every((address) => winners.includes(getAddress(address)));
  });

  if (!matchingLog) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blockchain transaction did not note the expected winner",
    });
  }

  return receipt;
}

async function verifyNftAwarded(
  txHash: Hex,
  expectedHackathonId: bigint,
  expectedRecipients: Array<string>,
  expectedUri: string,
) {
  const receipt = await waitForSuccessfulReceipt(txHash);
  const logs = getDecodedImplementationLogs(receipt, "NFTAwarded");
  const tokenIdsByRecipient = new Map<string, string>();

  for (const log of logs) {
    if (getBigIntArg(log.args, "hackathonId") !== expectedHackathonId) {
      continue;
    }

    const recipient = getAddressArg(log.args, "recipient");
    const uri = String(log.args.uri ?? "");

    if (expectedUri && uri !== expectedUri) {
      continue;
    }

    tokenIdsByRecipient.set(recipient, getBigIntArg(log.args, "tokenId").toString());
  }

  assertAllAddressesIncluded([...tokenIdsByRecipient.keys()], expectedRecipients);

  return {
    receipt,
    tokenIdsByRecipient,
  };
}

async function findUsersByIds(userIds: Array<string>) {
  if (!userIds.length) {
    return new Map<string, AuthUserRecord>();
  }

  const users = await userCollection().find(userIdLookupMany(userIds)).toArray();
  return new Map(users.map((user) => [getUserId(user), user]));
}

function userIdLookupMany(userIds: Array<string>): Filter<AuthUserRecord> {
  const objectIds = userIds.filter(ObjectId.isValid).map((userId) => new ObjectId(userId));
  const filters: Filter<AuthUserRecord>[] = [{ id: { $in: userIds } }];

  if (objectIds.length) {
    filters.push({ _id: { $in: objectIds } });
  }

  return { $or: filters };
}

function resolveParticipantOnchainAddress(
  participant: ParticipantRecord,
  user?: AuthUserRecord,
) {
  return (
    normalizeStoredAddress(participant.onchainAddress) ??
    normalizeStoredAddress(participant.smartWalletAddress) ??
    normalizeStoredAddress(user?.onchainAddress) ??
    normalizeStoredAddress(user?.smartWalletAddress)
  );
}

function buildRegistrationPlan(room: HackRoomRecord, recipients: Array<RewardRecipientRecord>) {
  const registered = new Set(
    room.participants
      .filter((participant) => participant.onchainRegisteredAt)
      .map((participant) => normalizeStoredAddress(participant.onchainAddress))
      .filter((address): address is Address => Boolean(address)),
  );

  const missingByAddress = new Map<string, { address: Address; userId: string }>();

  recipients.forEach((recipient) => {
    const address = normalizeStoredAddress(recipient.onchainAddress);
    if (!address || registered.has(address)) {
      return;
    }
    missingByAddress.set(address, {
      address,
      userId: recipient.userId,
    });
  });

  return [...missingByAddress.values()];
}

async function buildSubmissionChainPlan(input: {
  awardXrdm?: number;
  hostId: string;
  submissionId: string;
}) {
  const submission = await submissionCollection().findOne({ _id: input.submissionId });

  if (!submission) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Submission not found",
    });
  }

  const room = await requireHostedRoom(submission.roomId, input.hostId);
  const task = await taskCollection().findOne({
    _id: submission.taskId,
    roomId: submission.roomId,
  });
  const participant = room.participants.find(
    (roomParticipant) => roomParticipant.userId === submission.participantId,
  );

  if (!participant) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Participant must join the room before receiving blockchain rewards",
    });
  }

  const participantUsers = await findUsersByIds([participant.userId]);
  const participantUser = participantUsers.get(participant.userId);
  const recipientAddress = resolveParticipantOnchainAddress(participant, participantUser);
  const amount = input.awardXrdm ?? task?.rewardXrdm ?? submission.awardXrdm ?? 0;
  const recipient: RewardRecipientRecord = {
    email: participant.email,
    name: participant.name,
    onchainAddress: recipientAddress ?? undefined,
    smartWalletAddress: participant.smartWalletAddress ?? participantUser?.smartWalletAddress,
    userId: participant.userId,
  };
  const registrationPlan = buildRegistrationPlan(room, [recipient]);

  if (amount > 0 && !recipientAddress) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Participant must sync a Privy smart wallet before receiving XRDM",
    });
  }

  return {
    amount,
    hackathonId: amount > 0 || input.awardXrdm !== undefined ? requireRoomHackathonId(room) : null,
    participant,
    recipient,
    recipientAddress,
    registrationPlan,
    room,
    submission,
    task,
  };
}

export const hackRoomRouter = router({
  syncWallets: protectedProcedure
    .input(
      z
        .object({
          embeddedWalletAddress: addressSchema.optional(),
          smartWalletAddress: addressSchema.optional(),
        })
        .refine((input) => input.embeddedWalletAddress || input.smartWalletAddress, {
          message: "At least one wallet address is required",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      const timestamp = now();
      const userUpdate: Partial<AuthUserRecord> & {
        updatedAt: string;
      } = {
        updatedAt: timestamp,
      };
      const hostedRoomUpdate: Record<string, string> = {
        updatedAt: timestamp,
      };
      const participantUpdate: Record<string, string> = {
        updatedAt: timestamp,
      };

      if (input.embeddedWalletAddress) {
        userUpdate.embeddedWalletAddress = input.embeddedWalletAddress;
        hostedRoomUpdate.hostEmbeddedWalletAddress = input.embeddedWalletAddress;
        participantUpdate["participants.$[participant].embeddedWalletAddress"] =
          input.embeddedWalletAddress;
      }

      if (input.smartWalletAddress) {
        userUpdate.onchainAddress = input.smartWalletAddress;
        userUpdate.smartWalletAddress = input.smartWalletAddress;
        hostedRoomUpdate.hostOnchainAddress = input.smartWalletAddress;
        hostedRoomUpdate.hostSmartWalletAddress = input.smartWalletAddress;
        participantUpdate["participants.$[participant].onchainAddress"] = input.smartWalletAddress;
        participantUpdate["participants.$[participant].smartWalletAddress"] =
          input.smartWalletAddress;
      }

      const userUpdateResult = await userCollection().updateOne(sessionUserLookup(ctx.session.user), {
        $set: userUpdate,
      });

      if (userUpdateResult.matchedCount === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Could not sync wallet because the authenticated user was not found",
        });
      }

      await Promise.all([
        roomCollection().updateMany(
          { hostId: ctx.session.user.id },
          {
            $set: hostedRoomUpdate,
          },
        ),
        roomCollection().updateMany(
          { "participants.userId": ctx.session.user.id },
          {
            $set: participantUpdate,
          },
          {
            arrayFilters: [{ "participant.userId": ctx.session.user.id }],
          },
        ),
      ]);

      return {
        embeddedWalletAddress: input.embeddedWalletAddress ?? null,
        onchainAddress: input.smartWalletAddress ?? null,
        smartWalletAddress: input.smartWalletAddress ?? null,
      };
    }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user;
    const [viewerRole, currentUser, hostedRooms, joinedRooms] = await Promise.all([
      getUserRole(user.id),
      userCollection().findOne(userIdLookup(user.id), {
        projection: {
          embeddedWalletAddress: 1,
          onchainAddress: 1,
          smartWalletAddress: 1,
        },
      }),
      roomCollection()
        .find({ hostId: user.id, status: "active" })
        .toArray(),
      roomCollection()
        .find({
          "participants.userId": user.id,
          onchainStatus: "confirmed",
          status: "active",
        })
        .toArray(),
    ]);

    const hostedRoomIds = hostedRooms.map((room) => room._id);
    const joinedRoomIds = joinedRooms.map((room) => room._id);
    const visibleRoomIds = [...new Set([...hostedRoomIds, ...joinedRoomIds])];

    const [
      rawVisibleTasks,
      mySubmissions,
      hostSubmissions,
      visibleWinnerSubmissions,
      rawVisibleRewards,
      visibleNotifications,
    ] = await Promise.all([
        visibleRoomIds.length
          ? taskCollection().find({ roomId: { $in: visibleRoomIds } }).toArray()
          : [],
        submissionCollection().find({ participantId: user.id }).toArray(),
        hostedRoomIds.length
          ? submissionCollection().find({ roomId: { $in: hostedRoomIds } }).toArray()
          : [],
        visibleRoomIds.length
          ? submissionCollection()
              .find({ roomId: { $in: visibleRoomIds }, status: "winner" })
              .toArray()
          : [],
        visibleRoomIds.length
          ? rewardCollection()
              .find({
                $or: [
                  { roomId: { $in: hostedRoomIds } },
                  { "recipients.userId": user.id },
                ],
              })
              .toArray()
          : [],
        visibleRoomIds.length
          ? notificationCollection()
              .find({
                $or: [
                  { roomId: { $in: hostedRoomIds } },
                  { recipientIds: user.id },
                  { recipientEmails: user.email.toLowerCase() },
                ],
              })
              .toArray()
          : [],
      ]);

    const visibleRewards = rawVisibleRewards.filter((reward) => reward.status === "issued");
    const visibleTasks = rawVisibleTasks.filter(
      (task) => hostedRoomIds.includes(task.roomId) || isSpecialTaskForUser(task, user),
    );
    const roomById = new Map([...hostedRooms, ...joinedRooms].map((room) => [room._id, room]));
    const taskById = new Map(visibleTasks.map((task) => [task._id, task]));

    const withSubmissionContext = (submission: HackSubmissionRecord) => {
      const task = taskById.get(submission.taskId);
      const room = roomById.get(submission.roomId);
      return {
        ...submission,
        gameType:
          (task?.kind ?? "task") === "game" ? (task?.gameType ?? "memory_match") : task?.gameType,
        proofItems: normalizeProofItems(submission),
        roomName: room?.name ?? "Hack room",
        taskKind: task?.kind ?? "task",
        taskTitle: task?.title ?? "Hack task",
        rewardXrdm: task?.rewardXrdm ?? submission.awardXrdm ?? 0,
      };
    };

    return {
      viewerRole,
      wallets: {
        embeddedWalletAddress: currentUser?.embeddedWalletAddress ?? null,
        onchainAddress: currentUser?.onchainAddress ?? null,
        smartWalletAddress: currentUser?.smartWalletAddress ?? null,
      },
      hostedRooms: hostedRooms.sort(byNewest),
      joinedRooms: joinedRooms.sort(byNewest),
      tasks: visibleTasks.sort(byNewest).map((task) => ({
        ...task,
        gameType: (task.kind ?? "task") === "game" ? (task.gameType ?? "memory_match") : task.gameType,
        kind: task.kind ?? "task",
        roomName: roomById.get(task.roomId)?.name ?? "Hack room",
        inviteCode: roomById.get(task.roomId)?.inviteCode ?? "",
      })),
      notifications: visibleNotifications.sort(byNewest).map((notification) => ({
        ...notification,
        roomName: roomById.get(notification.roomId)?.name ?? "Hack room",
      })),
      mySubmissions: mySubmissions.sort(byNewest).map((submission) => {
        const task = taskById.get(submission.taskId);
        const room = roomById.get(submission.roomId);
        return {
          ...submission,
          gameType:
            (task?.kind ?? "task") === "game" ? (task?.gameType ?? "memory_match") : task?.gameType,
          proofItems: normalizeProofItems(submission),
          roomName: room?.name ?? "Hack room",
          taskKind: task?.kind ?? "task",
          taskTitle: task?.title ?? "Hack task",
          rewardXrdm: task?.rewardXrdm ?? submission.awardXrdm ?? 0,
        };
      }),
      hostSubmissions: hostSubmissions.map(withSubmissionContext).sort(byNewest),
      visibleWinners: visibleWinnerSubmissions.map(withSubmissionContext).sort(byNewest),
      rewards: visibleRewards.sort(byNewest).map((reward) => ({
        ...reward,
        label: rewardLabel(reward.kind),
        recipientCount: reward.recipients.length,
        roomName: roomById.get(reward.roomId)?.name ?? reward.teamName ?? "Hack room",
      })),
      stats: {
        activeRooms: hostedRooms.length,
        joinedRooms: joinedRooms.length,
        notifications: visibleNotifications.filter((notification) =>
          notification.recipientIds.includes(user.id),
        ).length,
        participants: hostedRooms.reduce((total, room) => total + room.participants.length, 0),
        pendingSubmissions: hostSubmissions.filter((submission) => submission.status === "submitted")
          .length,
        winners: mySubmissions.filter((submission) => submission.status === "winner").length,
      },
    };
  }),

  createRoom: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(3).max(80),
        description: z.string().trim().max(240).default(""),
        txHash: txHashSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireHostRole(ctx.session.user.id);

      const hostUser = await userCollection().findOne(userIdLookup(ctx.session.user.id), {
        projection: {
          embeddedWalletAddress: 1,
          onchainAddress: 1,
          smartWalletAddress: 1,
        },
      });
      const timestamp = now();
      const room: HackRoomRecord = {
        _id: makeId("room"),
        name: input.name,
        description: input.description,
        inviteCode: await createUniqueInviteCode(),
        hostId: ctx.session.user.id,
        hostEmbeddedWalletAddress: hostUser?.embeddedWalletAddress,
        hostName: ctx.session.user.name,
        hostOnchainAddress: hostUser?.onchainAddress,
        hostSmartWalletAddress: hostUser?.smartWalletAddress,
        onchainStatus: "not_created",
        status: "active",
        participants: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      if (input.txHash) {
        const hostAddress =
          normalizeStoredAddress(hostUser?.onchainAddress) ??
          normalizeStoredAddress(hostUser?.smartWalletAddress);

        if (!hostAddress) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Sync the host smart wallet before creating the room on-chain",
          });
        }

        const existingRoom = await roomCollection().findOne({ createTxHash: input.txHash });
        if (existingRoom) {
          if (existingRoom.hostId !== ctx.session.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "This blockchain transaction is already linked to another room",
            });
          }
          return existingRoom;
        }

        const { hackathonId, receipt } = await verifyHackathonCreated(input.txHash, hostAddress);
        room.chainId = polygonAmoyDeployment.chainId;
        room.contractAddress = polygonAmoyDeployment.eduProxy;
        room.createTxHash = input.txHash;
        room.onchainHackathonId = hackathonId.toString();
        room.onchainStatus = "confirmed";

        await roomCollection().insertOne(room);
        await recordConfirmedChainEvent({
          appEntityId: room._id,
          expectedHackathonId: hackathonId,
          expectedRecipients: [hostAddress],
          idempotencyKey: `room:${room._id}:created`,
          kind: "room_created",
          receipt,
          roomId: room._id,
          txHash: input.txHash,
        });

        return room;
      }

      await roomCollection().insertOne(room);

      return room;
    }),

  joinRoom: protectedProcedure
    .input(
      z.object({
        inviteCode: z.string().trim().min(4).max(24),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const inviteCode = input.inviteCode.toUpperCase();
      const room = await roomCollection().findOne({
        inviteCode,
        onchainStatus: "confirmed",
        status: "active",
      });

      if (!room) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active hack room uses that invite code",
        });
      }

      const alreadyJoined = room.participants.some(
        (participant) => participant.userId === ctx.session.user.id,
      );
      const currentUser = await userCollection().findOne(userIdLookup(ctx.session.user.id), {
        projection: {
          embeddedWalletAddress: 1,
          onchainAddress: 1,
          smartWalletAddress: 1,
        },
      });

      if (!alreadyJoined) {
        await roomCollection().updateOne(
          { _id: room._id },
          {
            $push: {
              participants: {
                embeddedWalletAddress: currentUser?.embeddedWalletAddress,
                userId: ctx.session.user.id,
                name: ctx.session.user.name,
                email: ctx.session.user.email,
                joinedAt: now(),
                onchainAddress: currentUser?.onchainAddress,
                smartWalletAddress: currentUser?.smartWalletAddress,
              },
            },
            $set: { updatedAt: now() },
          },
        );
      } else {
        await roomCollection().updateOne(
          { _id: room._id, "participants.userId": ctx.session.user.id },
          {
            $set: {
              "participants.$.embeddedWalletAddress": currentUser?.embeddedWalletAddress,
              "participants.$.onchainAddress": currentUser?.onchainAddress,
              "participants.$.smartWalletAddress": currentUser?.smartWalletAddress,
              updatedAt: now(),
            },
          },
        );
      }

      const updatedRoom = await roomCollection().findOne({ _id: room._id });
      return updatedRoom ?? room;
    }),

  completeRoomOnchainCreate: protectedProcedure
    .input(
      z.object({
        roomId: z.string().min(1),
        txHash: txHashSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await requireHostedRoom(input.roomId, ctx.session.user.id);
      const hostAddress =
        normalizeStoredAddress(room.hostOnchainAddress) ??
        normalizeStoredAddress(room.hostSmartWalletAddress);

      if (!hostAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sync the host smart wallet before creating the room on-chain",
        });
      }

      if (room.onchainStatus === "confirmed" && room.onchainHackathonId) {
        return room;
      }

      const { hackathonId, receipt } = await verifyHackathonCreated(input.txHash, hostAddress);
      const timestamp = now();

      await Promise.all([
        recordConfirmedChainEvent({
          appEntityId: room._id,
          expectedHackathonId: hackathonId,
          expectedRecipients: [hostAddress],
          idempotencyKey: `room:${room._id}:created`,
          kind: "room_created",
          receipt,
          roomId: room._id,
          txHash: input.txHash,
        }),
        roomCollection().updateOne(
          { _id: room._id },
          {
            $set: {
              chainId: polygonAmoyDeployment.chainId,
              contractAddress: polygonAmoyDeployment.eduProxy,
              createTxHash: input.txHash,
              onchainHackathonId: hackathonId.toString(),
              onchainStatus: "confirmed",
              updatedAt: timestamp,
            },
          },
        ),
      ]);

      const updatedRoom = await roomCollection().findOne({ _id: room._id });
      return updatedRoom ?? room;
    }),

  completeParticipantRegistration: protectedProcedure
    .input(
      z.object({
        participantIds: z.array(z.string().trim().min(1)).min(1).max(100),
        roomId: z.string().min(1),
        txHash: txHashSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await requireHostedRoom(input.roomId, ctx.session.user.id);
      const hackathonId = requireRoomHackathonId(room);
      const requestedParticipantIds = new Set(input.participantIds);
      const selectedParticipants = room.participants.filter((participant) =>
        requestedParticipantIds.has(participant.userId),
      );

      if (selectedParticipants.length !== requestedParticipantIds.size) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more participants are not part of this room",
        });
      }

      const participantAddresses = selectedParticipants
        .map((participant) => normalizeStoredAddress(participant.onchainAddress))
        .filter((address): address is Address => Boolean(address));

      if (participantAddresses.length !== selectedParticipants.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Every participant must have a synced smart wallet before registration",
        });
      }

      const receipt = await verifyParticipantsRegistered(
        input.txHash,
        hackathonId,
        participantAddresses,
      );
      const timestamp = now();

      await Promise.all([
        recordConfirmedChainEvent({
          appEntityId: selectedParticipants.map((participant) => participant.userId).join(","),
          expectedHackathonId: hackathonId,
          expectedRecipients: participantAddresses,
          idempotencyKey: `room:${room._id}:participants:${participantAddresses.sort().join(",")}`,
          kind: "participants_registered",
          receipt,
          roomId: room._id,
          txHash: input.txHash,
        }),
        roomCollection().updateOne(
          { _id: room._id },
          {
            $set: {
              "participants.$[participant].onchainRegisteredAt": timestamp,
              "participants.$[participant].registerTxHash": input.txHash,
              updatedAt: timestamp,
            },
          },
          {
            arrayFilters: [{ "participant.userId": { $in: input.participantIds } }],
          },
        ),
      ]);

      const updatedRoom = await roomCollection().findOne({ _id: room._id });
      return updatedRoom ?? room;
    }),

  createTask: protectedProcedure
    .input(
      z.object({
        roomId: z.string().min(1),
        kind: taskKindSchema.default("task"),
        gameType: gameTypeSchema.optional(),
        assignedToEmail: z.string().trim().max(254).optional(),
        title: z.string().trim().min(3).max(100),
        description: z.string().trim().min(10).max(700),
        dueAt: z.string().trim().min(3).max(80),
        rewardXrdm: z.coerce.number().int().min(0).max(1000),
        proofTypes: z.array(proofTypeSchema).min(1).max(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await requireHostedRoom(input.roomId, ctx.session.user.id);
      const assignedEmail = input.assignedToEmail?.trim().toLowerCase();
      let assignedUser: AuthUserRecord | null = null;
      let assignedParticipant: ParticipantRecord | undefined;

      if (input.kind === "special") {
        if (!assignedEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Enter the registered participant email for this special task",
          });
        }

        assignedUser = await findRegisteredUserByEmail(assignedEmail);

        if (!assignedUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No registered user uses that email address",
          });
        }

        const assignedUserId = getUserId(assignedUser);
        assignedParticipant = room.participants.find(
          (participant) =>
            participant.email.toLowerCase() === assignedEmail ||
            participant.userId === assignedUserId,
        );

        if (!assignedParticipant) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "That registered user has not joined this room yet",
          });
        }
      }

      const timestamp = now();
      const task: HackTaskRecord = {
        _id: makeId("task"),
        assignedToEmail: assignedParticipant?.email.toLowerCase(),
        assignedToName: assignedParticipant?.name ?? assignedUser?.name,
        assignedToUserId: assignedParticipant?.userId ?? (assignedUser ? getUserId(assignedUser) : undefined),
        gameType: input.kind === "game" ? (input.gameType ?? "memory_match") : undefined,
        roomId: input.roomId,
        hostId: ctx.session.user.id,
        kind: input.kind,
        title: input.title,
        description: input.description,
        dueAt: input.dueAt,
        rewardXrdm: input.rewardXrdm,
        proofTypes: input.proofTypes,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await taskCollection().insertOne(task);
      return task;
    }),

  submitProof: protectedProcedure
    .input(
      z.object({
        roomId: z.string().min(1),
        taskId: z.string().min(1),
        proofItems: z.array(proofItemSchema).max(6).default([]),
        proofUrl: z.string().trim().max(500).default(""),
        notes: z.string().trim().max(700).default(""),
        submissionDescription: z.string().trim().max(700).default(""),
        submitterName: z.string().trim().max(80).default(""),
        teamMateEmails: z.array(z.string().trim().email()).max(20).default([]),
        teamName: z.string().trim().max(100).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [room, task] = await Promise.all([
        roomCollection().findOne({ _id: input.roomId }),
        taskCollection().findOne({ _id: input.taskId, roomId: input.roomId }),
      ]);

      if (!room || !task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Hack room task not found",
        });
      }

      const isParticipant = room.participants.some(
        (participant) => participant.userId === ctx.session.user.id,
      );
      const isSpecialAssignee =
        (task.kind ?? "task") === "special" && isSpecialTaskForUser(task, ctx.session.user);

      if (!isParticipant && !isSpecialAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Join this hack room before submitting proof",
        });
      }

      const cleanProofItems = input.proofItems.filter((item) => item.value.trim());
      const legacyProofItem = input.proofUrl.trim()
        ? [
            {
              type: "url" as const,
              value: input.proofUrl.trim(),
            },
          ]
        : [];
      const proofItems = cleanProofItems.length ? cleanProofItems : legacyProofItem;

      if (!proofItems.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Submit at least one proof link",
        });
      }

      const invalidProofItem = proofItems.find(
        (item) => isLinkProofType(item.type) && !isHttpsProofUrl(item.value),
      );

      if (invalidProofItem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${invalidProofItem.type} proof must start with https://`,
        });
      }

      if (cleanProofItems.length) {
        const submittedProofTypes = new Set(proofItems.map((item) => item.type));
        const missingProofTypes = task.proofTypes.filter(
          (proofType) => !submittedProofTypes.has(proofType),
        );

        if (missingProofTypes.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Missing required proof: ${missingProofTypes.join(", ")}`,
          });
        }
      }

      const timestamp = now();
      const existing = await submissionCollection().findOne({
        taskId: input.taskId,
        participantId: ctx.session.user.id,
      });

      if (existing) {
        await submissionCollection().updateOne(
          { _id: existing._id },
          {
            $set: {
              proofItems,
              proofUrl: proofItems[0]?.value ?? input.proofUrl,
              notes: input.notes,
              submissionDescription: input.submissionDescription,
              submitterName: input.submitterName,
              teamMateEmails: [...new Set(input.teamMateEmails.map((email) => email.toLowerCase()))],
              teamName: input.teamName,
              status: "submitted",
              submittedAt: timestamp,
              updatedAt: timestamp,
            },
            $unset: {
              hostFeedback: "",
              awardXrdm: "",
              reviewedAt: "",
            },
          },
        );
        const updatedSubmission = await submissionCollection().findOne({ _id: existing._id });
        return updatedSubmission ?? existing;
      }

      const submission: HackSubmissionRecord = {
        _id: makeId("sub"),
        roomId: input.roomId,
        taskId: input.taskId,
        participantId: ctx.session.user.id,
        participantName: ctx.session.user.name,
        participantEmail: ctx.session.user.email,
        proofItems,
        proofUrl: proofItems[0]?.value ?? input.proofUrl,
        notes: input.notes,
        submissionDescription: input.submissionDescription,
        submitterName: input.submitterName,
        teamMateEmails: [...new Set(input.teamMateEmails.map((email) => email.toLowerCase()))],
        teamName: input.teamName,
        status: "submitted",
        submittedAt: timestamp,
        updatedAt: timestamp,
      };

      await submissionCollection().insertOne(submission);
      return submission;
    }),

  sendRoomNotification: protectedProcedure
    .input(
      z.object({
        roomId: z.string().min(1),
        title: z.string().trim().min(3).max(100),
        message: z.string().trim().min(3).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await requireHostedRoom(input.roomId, ctx.session.user.id);

      if (!room.participants.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Add participants before sending a room notification",
        });
      }

      const timestamp = now();
      const notification: HackNotificationRecord = {
        _id: makeId("note"),
        createdAt: timestamp,
        hostId: ctx.session.user.id,
        hostName: ctx.session.user.name,
        message: input.message,
        recipientEmails: room.participants.map((participant) => participant.email.toLowerCase()),
        recipientIds: room.participants.map((participant) => participant.userId),
        roomId: room._id,
        title: input.title,
        updatedAt: timestamp,
      };

      await notificationCollection().insertOne(notification);
      return notification;
    }),

  prepareSubmissionApproval: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const plan = await buildSubmissionChainPlan({
        hostId: ctx.session.user.id,
        submissionId: input.submissionId,
      });

      return {
        amount: plan.amount,
        hackathonId: plan.hackathonId?.toString() ?? null,
        recipientAddress: plan.recipientAddress,
        registration: plan.registrationPlan,
        roomId: plan.room._id,
      };
    }),

  completeSubmissionApproval: protectedProcedure
    .input(
      z.object({
        hostFeedback: z.string().trim().min(3).max(700),
        submissionId: z.string().min(1),
        txHash: txHashSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await buildSubmissionChainPlan({
        hostId: ctx.session.user.id,
        submissionId: input.submissionId,
      });
      const timestamp = now();

      if (plan.amount > 0) {
        if (!input.txHash || !plan.recipientAddress || !plan.hackathonId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "XRDM approval requires a confirmed blockchain transaction",
          });
        }

        const receipt = await verifyXrdmAwarded(
          input.txHash,
          plan.hackathonId,
          [plan.recipientAddress],
          [plan.amount],
        );

        await recordConfirmedChainEvent({
          appEntityId: plan.submission._id,
          expectedAmount: plan.amount,
          expectedHackathonId: plan.hackathonId,
          expectedRecipients: [plan.recipientAddress],
          idempotencyKey: `submission:${plan.submission._id}:approved:xrdm`,
          kind: "submission_xrdm_awarded",
          receipt,
          roomId: plan.room._id,
          txHash: input.txHash,
        });
      }

      await submissionCollection().updateOne(
        { _id: input.submissionId },
        {
          $set: {
            hostFeedback: input.hostFeedback,
            onchainAwardStatus: plan.amount > 0 ? "confirmed" : undefined,
            onchainAwardTxHash: input.txHash,
            reviewedAt: timestamp,
            status: "approved",
            updatedAt: timestamp,
          },
          $unset: { awardXrdm: "" },
        },
      );

      const updatedSubmission = await submissionCollection().findOne({ _id: input.submissionId });
      return updatedSubmission ?? plan.submission;
    }),

  prepareWinnerSelection: protectedProcedure
    .input(
      z.object({
        awardXrdm: z.coerce.number().int().min(0).max(1000),
        submissionId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const plan = await buildSubmissionChainPlan({
        awardXrdm: input.awardXrdm,
        hostId: ctx.session.user.id,
        submissionId: input.submissionId,
      });

      if (!plan.recipientAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Winner must sync a Privy smart wallet before being announced on-chain",
        });
      }

      return {
        amount: plan.amount,
        hackathonId: plan.hackathonId?.toString() ?? null,
        recipientAddress: plan.recipientAddress,
        registration: plan.registrationPlan,
        roomId: plan.room._id,
      };
    }),

  completeWinnerSelection: protectedProcedure
    .input(
      z.object({
        awardTxHash: txHashSchema.optional(),
        awardXrdm: z.coerce.number().int().min(0).max(1000),
        hostFeedback: z.string().trim().min(3).max(700),
        submissionId: z.string().min(1),
        winnerTxHash: txHashSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await buildSubmissionChainPlan({
        awardXrdm: input.awardXrdm,
        hostId: ctx.session.user.id,
        submissionId: input.submissionId,
      });

      if (!plan.hackathonId || !plan.recipientAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Winner requires a confirmed room and synced smart wallet",
        });
      }

      const winnerReceipt = await verifyWinnersNoted(
        input.winnerTxHash,
        plan.hackathonId,
        [plan.recipientAddress],
      );

      await recordConfirmedChainEvent({
        appEntityId: plan.submission._id,
        expectedHackathonId: plan.hackathonId,
        expectedRecipients: [plan.recipientAddress],
        idempotencyKey: `submission:${plan.submission._id}:winner:noted`,
        kind: "winner_noted",
        receipt: winnerReceipt,
        roomId: plan.room._id,
        txHash: input.winnerTxHash,
      });

      if (input.awardXrdm > 0) {
        if (!input.awardTxHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Winner XRDM requires a confirmed blockchain transaction",
          });
        }

        const awardReceipt = await verifyXrdmAwarded(
          input.awardTxHash,
          plan.hackathonId,
          [plan.recipientAddress],
          [input.awardXrdm],
        );

        await recordConfirmedChainEvent({
          appEntityId: plan.submission._id,
          expectedAmount: input.awardXrdm,
          expectedHackathonId: plan.hackathonId,
          expectedRecipients: [plan.recipientAddress],
          idempotencyKey: `submission:${plan.submission._id}:winner:xrdm`,
          kind: "winner_xrdm_awarded",
          receipt: awardReceipt,
          roomId: plan.room._id,
          txHash: input.awardTxHash,
        });
      }

      const timestamp = now();
      await submissionCollection().updateOne(
        { _id: input.submissionId },
        {
          $set: {
            awardXrdm: input.awardXrdm,
            hostFeedback: input.hostFeedback,
            onchainAwardStatus: input.awardXrdm > 0 ? "confirmed" : undefined,
            onchainAwardTxHash: input.awardTxHash,
            onchainWinnerStatus: "confirmed",
            onchainWinnerTxHash: input.winnerTxHash,
            reviewedAt: timestamp,
            status: "winner",
            updatedAt: timestamp,
          },
        },
      );

      const updatedSubmission = await submissionCollection().findOne({ _id: input.submissionId });
      return updatedSubmission ?? plan.submission;
    }),

  approveSubmission: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().min(1),
        hostFeedback: z.string().trim().min(3).max(700),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await submissionCollection().findOne({ _id: input.submissionId });

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        });
      }

      await requireHostedRoom(submission.roomId, ctx.session.user.id);
      const timestamp = now();

      await submissionCollection().updateOne(
        { _id: input.submissionId },
        {
          $set: {
            status: "approved",
            hostFeedback: input.hostFeedback,
            reviewedAt: timestamp,
            updatedAt: timestamp,
          },
          $unset: { awardXrdm: "" },
        },
      );

      const updatedSubmission = await submissionCollection().findOne({ _id: input.submissionId });
      return updatedSubmission ?? submission;
    }),

  selectWinner: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().min(1),
        hostFeedback: z.string().trim().min(3).max(700),
        awardXrdm: z.coerce.number().int().min(0).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await submissionCollection().findOne({ _id: input.submissionId });

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        });
      }

      await requireHostedRoom(submission.roomId, ctx.session.user.id);
      const timestamp = now();

      await submissionCollection().updateOne(
        { _id: input.submissionId },
        {
          $set: {
            status: "winner",
            hostFeedback: input.hostFeedback,
            awardXrdm: input.awardXrdm,
            reviewedAt: timestamp,
            updatedAt: timestamp,
          },
        },
      );

      const updatedSubmission = await submissionCollection().findOne({ _id: input.submissionId });
      return updatedSubmission ?? submission;
    }),

  returnSubmission: protectedProcedure
    .input(
      z.object({
        submissionId: z.string().min(1),
        hostFeedback: z.string().trim().min(3).max(700),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await submissionCollection().findOne({ _id: input.submissionId });

      if (!submission) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Submission not found",
        });
      }

      await requireHostedRoom(submission.roomId, ctx.session.user.id);
      const timestamp = now();

      await submissionCollection().updateOne(
        { _id: input.submissionId },
        {
          $set: {
            status: "returned",
            hostFeedback: input.hostFeedback,
            reviewedAt: timestamp,
            updatedAt: timestamp,
          },
          $unset: { awardXrdm: "" },
        },
      );

      const updatedSubmission = await submissionCollection().findOne({ _id: input.submissionId });
      return updatedSubmission ?? submission;
    }),

  prepareReward: protectedProcedure
    .input(
      z.object({
        awardXrdm: z.coerce.number().int().min(0).max(1000).default(0),
        description: z.string().trim().max(500).default(""),
        kind: rewardKindSchema,
        ledgerNote: z.string().trim().max(500).default(""),
        recipientIds: z.array(z.string().trim().min(1)).max(250).default([]),
        roomId: z.string().min(1),
        sourceSubmissionId: z.string().trim().optional(),
        title: z.string().trim().max(100).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await requireHostedRoom(input.roomId, ctx.session.user.id);
      const timestamp = now();
      let sourceSubmission: HackSubmissionRecord | null = null;
      let sourceTask: HackTaskRecord | null = null;

      if (input.kind !== "participant_certificate") {
        if (!input.sourceSubmissionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose an announced winner before issuing this reward",
          });
        }

        sourceSubmission = await submissionCollection().findOne({
          _id: input.sourceSubmissionId,
          roomId: room._id,
          status: "winner",
        });

        if (!sourceSubmission) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Winner submission not found",
          });
        }

        sourceTask = await taskCollection().findOne({
          _id: sourceSubmission.taskId,
          roomId: room._id,
        });
      }

      const roomParticipantIds = new Set(room.participants.map((participant) => participant.userId));
      const unknownRecipientIds = input.recipientIds.filter(
        (recipientId) => !roomParticipantIds.has(recipientId),
      );

      if (unknownRecipientIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more selected recipients have not joined this room",
        });
      }

      const recipientIds = input.recipientIds.length
        ? new Set(input.recipientIds)
        : roomParticipantIds;
      const selectedParticipants = room.participants.filter((participant) =>
        recipientIds.has(participant.userId),
      );
      const usersById = await findUsersByIds(selectedParticipants.map((participant) => participant.userId));
      const recipients = selectedParticipants.map((participant) => {
        const user = usersById.get(participant.userId);
        const onchainAddress = resolveParticipantOnchainAddress(participant, user);

        return {
          email: participant.email,
          name: participant.name,
          onchainAddress: onchainAddress ?? undefined,
          smartWalletAddress: participant.smartWalletAddress ?? user?.smartWalletAddress,
          userId: participant.userId,
        };
      });

      if (!recipients.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select at least one reward recipient",
        });
      }

      if (
        (input.awardXrdm > 0 || input.kind === "winner_nft_badge") &&
        recipients.some((recipient) => !recipient.onchainAddress)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Every reward recipient must sync a Privy smart wallet first",
        });
      }

      const rewardId = makeId("reward");
      const metadataUri =
        input.kind === "winner_nft_badge" ? buildRewardMetadataUrl(rewardId) : undefined;
      const reward: HackRewardRecord = {
        _id: rewardId,
        awardXrdm: input.awardXrdm,
        chainId: polygonAmoyDeployment.chainId,
        contractAddress: polygonAmoyDeployment.eduProxy,
        createdAt: timestamp,
        description: input.description,
        hostId: ctx.session.user.id,
        hostName: ctx.session.user.name,
        issuedAt: timestamp,
        kind: input.kind,
        ledgerNote: input.ledgerNote,
        metadataUri,
        onchainStatus: "pending",
        recipients,
        roomId: room._id,
        sourceSubmissionId: sourceSubmission?._id,
        sourceSubmissionTitle: sourceTask?.title,
        status: "pending",
        teamName: room.name,
        title: input.title || rewardLabel(input.kind),
        updatedAt: timestamp,
      };
      const registrationPlan = buildRegistrationPlan(room, recipients);
      const hackathonId =
        input.awardXrdm > 0 || input.kind === "winner_nft_badge"
          ? requireRoomHackathonId(room)
          : null;

      await rewardCollection().insertOne(reward);

      return {
        reward,
        onchain: {
          awardXrdm: input.awardXrdm,
          hackathonId: hackathonId?.toString() ?? null,
          metadataUri,
          recipientAddresses: recipients
            .map((recipient) => normalizeStoredAddress(recipient.onchainAddress))
            .filter((address): address is Address => Boolean(address)),
          registration: registrationPlan,
          requiresNft: input.kind === "winner_nft_badge",
          requiresXrdm: input.awardXrdm > 0,
        },
      };
    }),

  completeReward: protectedProcedure
    .input(
      z.object({
        nftTxHash: txHashSchema.optional(),
        rewardId: z.string().min(1),
        xrdmTxHash: txHashSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reward = await rewardCollection().findOne({ _id: input.rewardId });

      if (!reward) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Reward not found",
        });
      }

      const room = await requireHostedRoom(reward.roomId, ctx.session.user.id);

      if (reward.status === "issued") {
        return reward;
      }

      const hackathonId =
        reward.awardXrdm > 0 || reward.kind === "winner_nft_badge"
          ? requireRoomHackathonId(room)
          : null;
      const recipientAddresses = reward.recipients
        .map((recipient) => normalizeStoredAddress(recipient.onchainAddress))
        .filter((address): address is Address => Boolean(address));

      if (
        (reward.awardXrdm > 0 || reward.kind === "winner_nft_badge") &&
        recipientAddresses.length !== reward.recipients.length
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Every reward recipient must have a synced smart wallet",
        });
      }

      if (reward.awardXrdm > 0) {
        if (!input.xrdmTxHash || !hackathonId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "XRDM reward requires a confirmed blockchain transaction",
          });
        }

        const xrdmReceipt = await verifyXrdmAwarded(
          input.xrdmTxHash,
          hackathonId,
          recipientAddresses,
          recipientAddresses.map(() => reward.awardXrdm),
        );

        await recordConfirmedChainEvent({
          appEntityId: reward._id,
          expectedAmount: reward.awardXrdm,
          expectedHackathonId: hackathonId,
          expectedRecipients: recipientAddresses,
          idempotencyKey: `reward:${reward._id}:xrdm`,
          kind: "reward_xrdm_awarded",
          receipt: xrdmReceipt,
          roomId: room._id,
          txHash: input.xrdmTxHash,
        });
      }

      let tokenIdsByRecipient = new Map<string, string>();

      if (reward.kind === "winner_nft_badge") {
        if (!input.nftTxHash || !hackathonId || !reward.metadataUri) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "NFT reward requires a confirmed blockchain transaction",
          });
        }

        const nftResult = await verifyNftAwarded(
          input.nftTxHash,
          hackathonId,
          recipientAddresses,
          reward.metadataUri,
        );
        tokenIdsByRecipient = nftResult.tokenIdsByRecipient;

        await recordConfirmedChainEvent({
          appEntityId: reward._id,
          expectedHackathonId: hackathonId,
          expectedRecipients: recipientAddresses,
          idempotencyKey: `reward:${reward._id}:nft`,
          kind: "reward_nft_awarded",
          receipt: nftResult.receipt,
          roomId: room._id,
          txHash: input.nftTxHash,
        });
      }

      const timestamp = now();
      const recipients = reward.recipients.map((recipient) => {
        const recipientAddress = normalizeStoredAddress(recipient.onchainAddress);
        return {
          ...recipient,
          nftTokenId: recipientAddress ? tokenIdsByRecipient.get(recipientAddress) : recipient.nftTokenId,
        };
      });

      await rewardCollection().updateOne(
        { _id: reward._id },
        {
          $set: {
            nftTxHash: input.nftTxHash,
            onchainStatus: "confirmed",
            recipients,
            status: "issued",
            updatedAt: timestamp,
            xrdmTxHash: input.xrdmTxHash,
          },
        },
      );

      const updatedReward = await rewardCollection().findOne({ _id: reward._id });
      return updatedReward ?? reward;
    }),

  issueReward: protectedProcedure
    .input(
      z.object({
        roomId: z.string().min(1),
        kind: rewardKindSchema,
        title: z.string().trim().max(100).default(""),
        description: z.string().trim().max(500).default(""),
        awardXrdm: z.coerce.number().int().min(0).max(1000).default(0),
        ledgerNote: z.string().trim().max(500).default(""),
        sourceSubmissionId: z.string().trim().optional(),
        recipientIds: z.array(z.string().trim().min(1)).max(250).default([]),
      }),
    )
    .mutation(async () => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Use the sponsored blockchain prepareReward and completeReward flow",
      });
    }),
});
