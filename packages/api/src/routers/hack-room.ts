import { client } from "@rdm-hack/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

const proofTypeSchema = z.enum(["github", "drive", "file", "url", "video", "deck"]);
const taskKindSchema = z.enum(["task", "challenge", "game"]);

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
  proofUrl: string;
  notes: string;
  status: "submitted" | "approved" | "winner" | "returned";
  hostFeedback?: string;
  awardXrdm?: number;
  submittedAt: string;
  reviewedAt?: string;
  updatedAt: string;
};

const roomCollection = () => client.collection<HackRoomRecord>("hack_rooms");
const taskCollection = () => client.collection<HackTaskRecord>("hack_tasks");
const submissionCollection = () => client.collection<HackSubmissionRecord>("hack_submissions");

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
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

function byNewest<T extends { createdAt?: string; submittedAt?: string }>(left: T, right: T) {
  const leftDate = left.submittedAt ?? left.createdAt ?? "";
  const rightDate = right.submittedAt ?? right.createdAt ?? "";
  return rightDate.localeCompare(leftDate);
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

    const [visibleTasks, mySubmissions, hostSubmissions, visibleWinnerSubmissions] =
      await Promise.all([
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
      ]);

    const roomById = new Map([...hostedRooms, ...joinedRooms].map((room) => [room._id, room]));
    const taskById = new Map(visibleTasks.map((task) => [task._id, task]));

    const withSubmissionContext = (submission: HackSubmissionRecord) => {
      const task = taskById.get(submission.taskId);
      const room = roomById.get(submission.roomId);
      return {
        ...submission,
        roomName: room?.name ?? "Hack room",
        taskTitle: task?.title ?? "Hack task",
        rewardXrdm: task?.rewardXrdm ?? submission.awardXrdm ?? 0,
      };
    };

    return {
      hostedRooms: hostedRooms.sort(byNewest),
      joinedRooms: joinedRooms.sort(byNewest),
      tasks: visibleTasks.sort(byNewest).map((task) => ({
        ...task,
        kind: task.kind ?? "task",
        roomName: roomById.get(task.roomId)?.name ?? "Hack room",
        inviteCode: roomById.get(task.roomId)?.inviteCode ?? "",
      })),
      mySubmissions: mySubmissions.sort(byNewest).map((submission) => {
        const task = taskById.get(submission.taskId);
        const room = roomById.get(submission.roomId);
        return {
          ...submission,
          roomName: room?.name ?? "Hack room",
          taskTitle: task?.title ?? "Hack task",
          rewardXrdm: task?.rewardXrdm ?? submission.awardXrdm ?? 0,
        };
      }),
      hostSubmissions: hostSubmissions.map(withSubmissionContext).sort(byNewest),
      visibleWinners: visibleWinnerSubmissions.map(withSubmissionContext).sort(byNewest),
      stats: {
        activeRooms: hostedRooms.length,
        joinedRooms: joinedRooms.length,
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
        title: z.string().trim().min(3).max(100),
        description: z.string().trim().min(10).max(700),
        dueAt: z.string().trim().min(3).max(80),
        rewardXrdm: z.coerce.number().int().min(0).max(1000),
        proofTypes: z.array(proofTypeSchema).min(1).max(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireHostedRoom(input.roomId, ctx.session.user.id);
      const timestamp = now();
      const task: HackTaskRecord = {
        _id: makeId("task"),
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
        proofUrl: z.string().trim().min(8).max(500),
        notes: z.string().trim().max(700).default(""),
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

      if (!isParticipant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Join this hack room before submitting proof",
        });
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
              proofUrl: input.proofUrl,
              notes: input.notes,
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
        proofUrl: input.proofUrl,
        notes: input.notes,
        status: "submitted",
        submittedAt: timestamp,
        updatedAt: timestamp,
      };

      await submissionCollection().insertOne(submission);
      return submission;
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
});
