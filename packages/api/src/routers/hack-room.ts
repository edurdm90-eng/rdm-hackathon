import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { client } from "../../../db/src/index.js";
import { protectedProcedure, router } from "../index.js";

const proofTypeSchema = z.enum(["github", "drive", "file", "url", "video", "deck", "game_score"]);
const taskKindSchema = z.enum(["task", "challenge", "game", "special"]);
const gameTypeSchema = z.enum(["memory_match", "breath_timer", "quick_maths"]);
const rewardKindSchema = z.enum([
  "participant_certificate",
  "winner_certificate",
  "winner_nft_badge",
]);
const proofItemSchema = z.object({
  type: proofTypeSchema,
  value: z.string().trim().min(3).max(500),
});

type ParticipantRecord = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
};

type HackRoomRecord = {
  _id: string;
  name: string;
  description: string;
  inviteCode: string;
  hostId: string;
  hostName: string;
  status: "active" | "closed";
  participants: ParticipantRecord[];
  createdAt: string;
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
  submittedAt: string;
  reviewedAt?: string;
  updatedAt: string;
};

type RewardRecipientRecord = {
  userId: string;
  name: string;
  email: string;
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
  sourceSubmissionId?: string;
  sourceSubmissionTitle?: string;
  teamName?: string;
  status: "issued";
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
  _id?: { toString: () => string };
  email: string;
  id?: string;
  name?: string;
};

const roomCollection = () => client.collection<HackRoomRecord>("hack_rooms");
const taskCollection = () => client.collection<HackTaskRecord>("hack_tasks");
const submissionCollection = () => client.collection<HackSubmissionRecord>("hack_submissions");
const rewardCollection = () => client.collection<HackRewardRecord>("hack_rewards");
const notificationCollection = () => client.collection<HackNotificationRecord>("hack_notifications");
const userCollection = () => client.collection<AuthUserRecord>("user");

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

function getUserId(user: AuthUserRecord) {
  return user.id ?? user._id?.toString() ?? "";
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
  if (kind === "participant_certificate") return "Participant Certificate";
  if (kind === "winner_certificate") return "Winner Certificate";
  return "Winner NFT Badge";
}

export const hackRoomRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const user = ctx.session.user;
    const [hostedRooms, joinedRooms] = await Promise.all([
      roomCollection().find({ hostId: user.id }).toArray(),
      roomCollection().find({ "participants.userId": user.id }).toArray(),
    ]);

    const hostedRoomIds = hostedRooms.map((room) => room._id);
    const joinedRoomIds = joinedRooms.map((room) => room._id);
    const visibleRoomIds = [...new Set([...hostedRoomIds, ...joinedRoomIds])];

    const [
      rawVisibleTasks,
      mySubmissions,
      hostSubmissions,
      visibleWinnerSubmissions,
      visibleRewards,
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
      mySubmissions: mySubmissions
        .filter((submission) => taskById.has(submission.taskId))
        .sort(byNewest)
        .map((submission) => {
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
      visibleWinners: visibleWinnerSubmissions
        .filter((submission) => taskById.has(submission.taskId))
        .map(withSubmissionContext)
        .sort(byNewest),
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
        winners: hostSubmissions.filter((submission) => submission.status === "winner").length,
      },
    };
  }),

  createRoom: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(3).max(80),
        description: z.string().trim().max(240).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const timestamp = now();
      const room: HackRoomRecord = {
        _id: makeId("room"),
        name: input.name,
        description: input.description,
        inviteCode: await createUniqueInviteCode(),
        hostId: ctx.session.user.id,
        hostName: ctx.session.user.name,
        status: "active",
        participants: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

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
      const room = await roomCollection().findOne({ inviteCode, status: "active" });

      if (!room) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active hack room uses that invite code",
        });
      }

      const alreadyJoined = room.participants.some(
        (participant) => participant.userId === ctx.session.user.id,
      );

      if (!alreadyJoined) {
        await roomCollection().updateOne(
          { _id: room._id },
          {
            $push: {
              participants: {
                userId: ctx.session.user.id,
                name: ctx.session.user.name,
                email: ctx.session.user.email,
                joinedAt: now(),
              },
            },
            $set: { updatedAt: now() },
          },
        );
      }

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

      const taskKind = task.kind ?? "task";
      const isParticipant = room.participants.some(
        (participant) => participant.userId === ctx.session.user.id,
      );
      const isSpecialAssignee = taskKind === "special" && isSpecialTaskForUser(task, ctx.session.user);

      if (taskKind === "special" && !isSpecialAssignee) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the assigned participant can submit proof for this special task",
        });
      }

      if (taskKind !== "special" && !isParticipant) {
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
    .mutation(async ({ ctx, input }) => {
      const room = await requireHostedRoom(input.roomId, ctx.session.user.id);
      const timestamp = now();
      let sourceSubmission: HackSubmissionRecord | null = null;
      let sourceTask: HackTaskRecord | null = null;
      let recipients: RewardRecipientRecord[] = [];

      if (input.kind === "participant_certificate") {
        const recipientIds = input.recipientIds.length
          ? new Set(input.recipientIds)
          : new Set(room.participants.map((participant) => participant.userId));
        recipients = room.participants
          .filter((participant) => recipientIds.has(participant.userId))
          .map(({ email, name, userId }) => ({ email, name, userId }));
      } else {
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

        recipients = room.participants.map(({ email, name, userId }) => ({
          email,
          name,
          userId,
        }));
      }

      if (!recipients.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Select at least one reward recipient",
        });
      }

      const reward: HackRewardRecord = {
        _id: makeId("reward"),
        awardXrdm: input.awardXrdm,
        createdAt: timestamp,
        description: input.description,
        hostId: ctx.session.user.id,
        hostName: ctx.session.user.name,
        issuedAt: timestamp,
        kind: input.kind,
        ledgerNote: input.ledgerNote,
        recipients,
        roomId: room._id,
        sourceSubmissionId: sourceSubmission?._id,
        sourceSubmissionTitle: sourceTask?.title,
        status: "issued",
        teamName: room.name,
        title: input.title || rewardLabel(input.kind),
        updatedAt: timestamp,
      };

      await rewardCollection().insertOne(reward);
      return reward;
    }),
});
