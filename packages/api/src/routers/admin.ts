import { TRPCError } from "@trpc/server";
import type { ObjectId } from "mongodb";

import {
  isAdminEmailAllowed,
  normalizeAdminEmail,
} from "../../../auth/src/admin-access.js";
import { client } from "../../../db/src/index.js";
import { env } from "../../../env/src/server.js";
import { protectedProcedure, router } from "../index.js";

type AdminStatus = "confirmed" | "failed" | "pending";
type DateValue = Date | string;

type UserRecord = {
  _id?: ObjectId | string;
  id?: string;
  name?: string;
  email: string;
  role?: unknown;
  createdAt?: DateValue;
  updatedAt?: DateValue;
};

type SessionRecord = {
  userId: ObjectId | string;
  expiresAt: DateValue;
  updatedAt: DateValue;
};

type ParticipantRecord = {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
};

type RoomRecord = {
  _id: string;
  name: string;
  hostId: string;
  hostName: string;
  participants: ParticipantRecord[];
  onchainStatus?: "confirmed" | "failed" | "not_created" | "pending";
  createdAt: string;
  updatedAt: string;
};

type TaskRecord = {
  _id: string;
  roomId: string;
};

type SubmissionRecord = {
  _id: string;
  roomId: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  status: "approved" | "returned" | "submitted" | "winner";
  awardXrdm?: number;
  onchainAwardStatus?: AdminStatus;
  submittedAt: string;
  updatedAt: string;
};

type RewardRecord = {
  _id: string;
  roomId: string;
  hostId: string;
  hostName: string;
  title: string;
  kind: "participant_certificate" | "winner_certificate" | "winner_nft_badge";
  awardXrdm: number;
  recipients: Array<{
    userId: string;
    name: string;
    email: string;
  }>;
  onchainStatus?: AdminStatus;
  status: "issued" | "pending";
  issuedAt: string;
  updatedAt: string;
};

type ChainEventRecord = {
  _id: string;
  appEntityId?: string;
  expectedAmount?: number;
  expectedRecipients?: string[];
  kind: string;
  roomId: string;
  status: AdminStatus;
  createdAt: string;
  updatedAt: string;
};

type ActivityItem = {
  id: string;
  kind:
    | "approval"
    | "badge"
    | "certificate"
    | "join"
    | "reward"
    | "room"
    | "submission"
    | "winner";
  title: string;
  detail: string;
  time: string;
  status: AdminStatus;
};

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function timestamp(value: DateValue | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: DateValue | undefined) {
  const parsed = timestamp(value);
  return new Date(parsed || 0).toISOString();
}

function normalizedStatus(
  status: RoomRecord["onchainStatus"] | AdminStatus | undefined,
): AdminStatus {
  if (status === "confirmed" || status === "failed") {
    return status;
  }

  return "pending";
}

function userRecordId(user: UserRecord) {
  return user.id ?? user._id?.toString() ?? "";
}

function dayKey(value: DateValue | undefined) {
  const parsed = timestamp(value);
  return parsed ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function latestIso(current: string, candidate: DateValue | undefined) {
  return timestamp(candidate) > timestamp(current) ? isoDate(candidate) : current;
}

function groupByRoom<T extends { roomId: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const roomItems = grouped.get(item.roomId) ?? [];
    roomItems.push(item);
    grouped.set(item.roomId, roomItems);
  }

  return grouped;
}

function buildMovement(
  users: UserRecord[],
  rooms: RoomRecord[],
  submissions: SubmissionRecord[],
) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (6 - index));
    return {
      date,
      key: date.toISOString().slice(0, 10),
      users: 0,
      joins: 0,
      submissions: 0,
    };
  });
  const points = new Map(days.map((day) => [day.key, day]));

  for (const user of users) {
    const point = points.get(dayKey(user.createdAt));
    if (point) {
      point.users += 1;
    }
  }

  for (const room of rooms) {
    for (const participant of room.participants ?? []) {
      const point = points.get(dayKey(participant.joinedAt));
      if (point) {
        point.joins += 1;
      }
    }
  }

  for (const submission of submissions) {
    const point = points.get(dayKey(submission.submittedAt));
    if (point) {
      point.submissions += 1;
    }
  }

  return days.map((day) => ({
    day: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(day.date),
    users: day.users,
    joins: day.joins,
    submissions: day.submissions,
  }));
}

function buildActivity(
  rooms: RoomRecord[],
  submissions: SubmissionRecord[],
  rewards: RewardRecord[],
  chainEvents: ChainEventRecord[],
) {
  const activity: Array<ActivityItem & { sortAt: number }> = [];
  const roomNames = new Map(rooms.map((room) => [room._id, room.name]));

  for (const room of rooms) {
    activity.push({
      id: `room-${room._id}`,
      kind: "room",
      title: "Room created",
      detail: `${room.hostName} created ${room.name}.`,
      time: isoDate(room.createdAt),
      status: normalizedStatus(room.onchainStatus),
      sortAt: timestamp(room.createdAt),
    });

    for (const participant of room.participants ?? []) {
      activity.push({
        id: `join-${room._id}-${participant.userId}`,
        kind: "join",
        title: "Participant joined room",
        detail: `${participant.name} joined ${room.name}.`,
        time: isoDate(participant.joinedAt),
        status: "confirmed",
        sortAt: timestamp(participant.joinedAt),
      });
    }
  }

  for (const submission of submissions) {
    const isWinner = submission.status === "winner";
    const isApproved = submission.status === "approved";
    activity.push({
      id: `submission-${submission._id}`,
      kind: isWinner ? "winner" : isApproved ? "approval" : "submission",
      title: isWinner
        ? "Winner selected"
        : isApproved
          ? "Submission approved"
          : submission.status === "returned"
            ? "Submission returned"
            : "New submission",
      detail: `${submission.participantName} in ${
        roomNames.get(submission.roomId) ?? "Hack room"
      }.`,
      time: isoDate(submission.updatedAt ?? submission.submittedAt),
      status:
        submission.status === "returned"
          ? "failed"
          : submission.status === "submitted"
            ? "pending"
            : "confirmed",
      sortAt: timestamp(submission.updatedAt ?? submission.submittedAt),
    });
  }

  for (const reward of rewards) {
    const isBadge = reward.kind === "winner_nft_badge";
    const isCertificate = reward.kind.endsWith("_certificate");
    activity.push({
      id: `reward-${reward._id}`,
      kind: isBadge ? "badge" : isCertificate ? "certificate" : "reward",
      title: reward.title || (isBadge ? "NFT badge issued" : "Certificate issued"),
      detail: `${reward.recipients.length} recipient${
        reward.recipients.length === 1 ? "" : "s"
      } in ${roomNames.get(reward.roomId) ?? "Hack room"}.`,
      time: isoDate(reward.issuedAt ?? reward.updatedAt),
      status: normalizedStatus(
        reward.onchainStatus ?? (reward.status === "issued" ? "confirmed" : "pending"),
      ),
      sortAt: timestamp(reward.issuedAt ?? reward.updatedAt),
    });
  }

  for (const event of chainEvents) {
    if (!event.kind.includes("xrdm")) {
      continue;
    }

    const recipientCount = Math.max(event.expectedRecipients?.length ?? 1, 1);
    const amount = numericValue(event.expectedAmount) * recipientCount;
    activity.push({
      id: `chain-${event._id}`,
      kind: "reward",
      title: "XRDM chain event",
      detail: `${amount.toLocaleString("en-US")} XRDM for ${
        roomNames.get(event.roomId) ?? "Hack room"
      }.`,
      time: isoDate(event.updatedAt ?? event.createdAt),
      status: event.status,
      sortAt: timestamp(event.updatedAt ?? event.createdAt),
    });
  }

  return activity
    .sort((left, right) => right.sortAt - left.sortAt)
    .slice(0, 12)
    .map(({ sortAt: _sortAt, ...item }) => item);
}

async function loadAdminDashboard() {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [
    users,
    activeSessionUserIds,
    rooms,
    tasks,
    submissions,
    rewards,
    chainEvents,
  ] = await Promise.all([
    client
      .collection<UserRecord>("user")
      .find(
        {},
        {
          projection: {
            createdAt: 1,
            email: 1,
            id: 1,
            name: 1,
            role: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
    client.collection<SessionRecord>("session").distinct("userId", {
      expiresAt: { $gt: new Date(now) },
      updatedAt: { $gte: todayStart },
    }),
    client
      .collection<RoomRecord>("hack_rooms")
      .find(
        {},
        {
          projection: {
            createdAt: 1,
            hostId: 1,
            hostName: 1,
            name: 1,
            onchainStatus: 1,
            "participants.email": 1,
            "participants.joinedAt": 1,
            "participants.name": 1,
            "participants.userId": 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
    client
      .collection<TaskRecord>("hack_tasks")
      .find({}, { projection: { roomId: 1 } })
      .toArray(),
    client
      .collection<SubmissionRecord>("hack_submissions")
      .find(
        {},
        {
          projection: {
            awardXrdm: 1,
            onchainAwardStatus: 1,
            participantEmail: 1,
            participantId: 1,
            participantName: 1,
            roomId: 1,
            status: 1,
            submittedAt: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
    client
      .collection<RewardRecord>("hack_rewards")
      .find(
        {},
        {
          projection: {
            awardXrdm: 1,
            hostId: 1,
            hostName: 1,
            issuedAt: 1,
            kind: 1,
            onchainStatus: 1,
            "recipients.email": 1,
            "recipients.name": 1,
            "recipients.userId": 1,
            roomId: 1,
            status: 1,
            title: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
    client
      .collection<ChainEventRecord>("hack_chain_events")
      .find(
        {},
        {
          projection: {
            appEntityId: 1,
            createdAt: 1,
            expectedAmount: 1,
            expectedRecipients: 1,
            kind: 1,
            roomId: 1,
            status: 1,
            updatedAt: 1,
          },
        },
      )
      .toArray(),
  ]);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1_000;
  const activeUserIds = new Set(
    activeSessionUserIds.map((userId) => userId.toString()),
  );
  const userById = new Map<string, UserRecord>();

  for (const user of users) {
    const id = userRecordId(user);
    if (id) {
      userById.set(id, user);
    }
    if (user._id) {
      userById.set(user._id.toString(), user);
    }
  }

  const tasksByRoom = groupByRoom(tasks);
  const submissionsByRoom = groupByRoom(submissions);
  const rewardsByRoom = groupByRoom(rewards);
  const approvedSubmissions = submissions.filter(
    (submission) =>
      submission.status === "approved" || submission.status === "winner",
  );
  const winnerSubmissions = submissions.filter(
    (submission) => submission.status === "winner",
  );
  const confirmedSubmissionXrdm = submissions
    .filter((submission) => submission.onchainAwardStatus === "confirmed")
    .reduce((total, submission) => total + numericValue(submission.awardXrdm), 0);
  const confirmedRewardXrdm = rewards
    .filter((reward) => reward.onchainStatus === "confirmed")
    .reduce(
      (total, reward) =>
        total + numericValue(reward.awardXrdm) * reward.recipients.length,
      0,
    );
  const confirmedXrdm = confirmedSubmissionXrdm + confirmedRewardXrdm;
  const certificatesIssued = rewards
    .filter(
      (reward) =>
        reward.status === "issued" && reward.kind.endsWith("_certificate"),
    )
    .reduce((total, reward) => total + reward.recipients.length, 0);
  const nftBadgesIssued = rewards
    .filter(
      (reward) =>
        reward.status === "issued" && reward.kind === "winner_nft_badge",
    )
    .reduce((total, reward) => total + reward.recipients.length, 0);
  const confirmedChainEvents = chainEvents.filter(
    (event) => event.status === "confirmed",
  ).length;
  const pendingChainEvents = chainEvents.filter(
    (event) => event.status === "pending",
  ).length;
  const failedChainEvents = chainEvents.filter(
    (event) => event.status === "failed",
  ).length;
  const pendingConfirmationIds = new Set<string>();
  for (const event of chainEvents) {
    if (event.status === "pending") {
      pendingConfirmationIds.add(event.appEntityId ?? `chain:${event._id}`);
    }
  }
  for (const submission of submissions) {
    if (
      numericValue(submission.awardXrdm) > 0 &&
      submission.onchainAwardStatus === "pending"
    ) {
      pendingConfirmationIds.add(submission._id);
    }
  }
  for (const reward of rewards) {
    if (reward.status === "pending" || reward.onchainStatus === "pending") {
      pendingConfirmationIds.add(reward._id);
    }
  }
  const pendingConfirmations = pendingConfirmationIds.size;
  const confirmedEventsByEntityAndKind = new Map(
    chainEvents
      .filter((event) => event.status === "confirmed" && event.appEntityId)
      .map((event) => [`${event.appEntityId}:${event.kind}`, event]),
  );
  const submissionMismatches = submissions.filter((submission) => {
    if (
      (submission.status !== "approved" && submission.status !== "winner") ||
      numericValue(submission.awardXrdm) <= 0
    ) {
      return false;
    }

    const eventKind =
      submission.status === "winner"
        ? "winner_xrdm_awarded"
        : "submission_xrdm_awarded";
    const event = confirmedEventsByEntityAndKind.get(
      `${submission._id}:${eventKind}`,
    );
    return (
      submission.onchainAwardStatus === "failed" ||
      (submission.onchainAwardStatus === "confirmed" &&
        (!event ||
          numericValue(event.expectedAmount) !==
            numericValue(submission.awardXrdm)))
    );
  }).length;
  const rewardMismatches = rewards.filter((reward) => {
    if (reward.status !== "issued" || reward.onchainStatus === "pending") {
      return false;
    }

    const xrdmEvent = confirmedEventsByEntityAndKind.get(
      `${reward._id}:reward_xrdm_awarded`,
    );
    const nftEvent = confirmedEventsByEntityAndKind.get(
      `${reward._id}:reward_nft_awarded`,
    );
    const expectsXrdmEvent = numericValue(reward.awardXrdm) > 0;
    const expectsNftEvent = reward.kind === "winner_nft_badge";

    return (
      reward.onchainStatus === "failed" ||
      (reward.onchainStatus === "confirmed" &&
        ((expectsXrdmEvent &&
          (!xrdmEvent ||
            numericValue(xrdmEvent.expectedAmount) !==
              numericValue(reward.awardXrdm) ||
            (xrdmEvent.expectedRecipients?.length ?? 0) !==
              reward.recipients.length)) ||
          (expectsNftEvent &&
            (!nftEvent ||
              (nftEvent.expectedRecipients?.length ?? 0) !==
                reward.recipients.length))))
    );
  }).length;
  const chainSuccessRate = chainEvents.length
    ? (confirmedChainEvents / chainEvents.length) * 100
    : 0;
  const newUsersThisWeek = users.filter(
    (user) => timestamp(user.createdAt) >= sevenDaysAgo,
  ).length;
  const newRoomsThisWeek = rooms.filter(
    (room) => timestamp(room.createdAt) >= sevenDaysAgo,
  ).length;

  const roomRows = rooms
    .map((room) => {
      const roomRewards = rewardsByRoom.get(room._id) ?? [];
      const host = userById.get(room.hostId);

      return {
        id: room._id,
        name: room.name,
        hostEmail: host?.email ?? room.hostName,
        participants: room.participants?.length ?? 0,
        assignments: tasksByRoom.get(room._id)?.length ?? 0,
        submissions: submissionsByRoom.get(room._id)?.length ?? 0,
        rewardsIssued: roomRewards
          .filter((reward) => reward.status === "issued")
          .reduce((total, reward) => total + reward.recipients.length, 0),
        createdDate: isoDate(room.createdAt),
        onchainStatus: normalizedStatus(room.onchainStatus),
      };
    })
    .sort(
      (left, right) =>
        timestamp(right.createdDate) - timestamp(left.createdDate),
    );

  const roomSegments = rooms
    .map((room) => {
      const roomSubmissions = submissionsByRoom.get(room._id) ?? [];
      const roomRewards = rewardsByRoom.get(room._id) ?? [];

      return {
        segment: room.name,
        users: room.participants?.length ?? 0,
        rooms: 1,
        joins: room.participants?.length ?? 0,
        submissions: roomSubmissions.length,
        approvals: roomSubmissions.filter(
          (submission) =>
            submission.status === "approved" ||
            submission.status === "winner",
        ).length,
        winners: roomSubmissions.filter(
          (submission) => submission.status === "winner",
        ).length,
        xrdm:
          roomSubmissions
            .filter(
              (submission) =>
                submission.onchainAwardStatus === "confirmed",
            )
            .reduce(
              (total, submission) =>
                total + numericValue(submission.awardXrdm),
              0,
            ) +
          roomRewards
            .filter((reward) => reward.onchainStatus === "confirmed")
            .reduce(
              (total, reward) =>
                total +
                numericValue(reward.awardXrdm) * reward.recipients.length,
              0,
            ),
      };
    })
    .sort((left, right) => right.submissions - left.submissions);

  const roomsByHost = new Map<string, RoomRecord[]>();
  for (const room of rooms) {
    const hostRooms = roomsByHost.get(room.hostId) ?? [];
    hostRooms.push(room);
    roomsByHost.set(room.hostId, hostRooms);
  }

  const hostSegments = [...roomsByHost.entries()]
    .map(([hostId, hostRooms]) => {
      const roomIds = new Set(hostRooms.map((room) => room._id));
      const hostSubmissions = submissions.filter((submission) =>
        roomIds.has(submission.roomId),
      );
      const hostRewards = rewards.filter((reward) =>
        roomIds.has(reward.roomId),
      );
      const host = userById.get(hostId);

      return {
        segment: host?.email ?? hostRooms[0]?.hostName ?? hostId,
        users: hostRooms.reduce(
          (total, room) => total + (room.participants?.length ?? 0),
          0,
        ),
        rooms: hostRooms.length,
        joins: hostRooms.reduce(
          (total, room) => total + (room.participants?.length ?? 0),
          0,
        ),
        submissions: hostSubmissions.length,
        approvals: hostSubmissions.filter(
          (submission) =>
            submission.status === "approved" ||
            submission.status === "winner",
        ).length,
        winners: hostSubmissions.filter(
          (submission) => submission.status === "winner",
        ).length,
        xrdm:
          hostSubmissions
            .filter(
              (submission) =>
                submission.onchainAwardStatus === "confirmed",
            )
            .reduce(
              (total, submission) =>
                total + numericValue(submission.awardXrdm),
              0,
            ) +
          hostRewards
            .filter((reward) => reward.onchainStatus === "confirmed")
            .reduce(
              (total, reward) =>
                total +
                numericValue(reward.awardXrdm) * reward.recipients.length,
              0,
            ),
      };
    })
    .sort((left, right) => right.rooms - left.rooms);

  type MutableUserInsight = {
    id: string;
    name: string;
    email: string;
    role: "host" | "member";
    roomsHosted: number;
    roomsJoined: number;
    submissions: number;
    approvals: number;
    rewards: number;
    xrdm: number;
    lastSignal: string;
  };

  const userInsights = users.map<MutableUserInsight>((user) => ({
    id: userRecordId(user),
    name: user.name?.trim() || user.email,
    email: user.email,
    role: user.role === "host" ? "host" : "member",
    roomsHosted: 0,
    roomsJoined: 0,
    submissions: 0,
    approvals: 0,
    rewards: 0,
    xrdm: 0,
    lastSignal: isoDate(user.updatedAt ?? user.createdAt),
  }));
  const insightByKey = new Map<string, MutableUserInsight>();

  for (const insight of userInsights) {
    if (insight.id) {
      insightByKey.set(insight.id, insight);
    }
    insightByKey.set(normalizeAdminEmail(insight.email), insight);
  }

  for (const room of rooms) {
    const hostInsight = insightByKey.get(room.hostId);
    if (hostInsight) {
      hostInsight.roomsHosted += 1;
      hostInsight.lastSignal = latestIso(hostInsight.lastSignal, room.updatedAt);
    }

    for (const participant of room.participants ?? []) {
      const insight =
        insightByKey.get(participant.userId) ??
        insightByKey.get(normalizeAdminEmail(participant.email));
      if (insight) {
        insight.roomsJoined += 1;
        insight.lastSignal = latestIso(
          insight.lastSignal,
          participant.joinedAt,
        );
      }
    }
  }

  for (const submission of submissions) {
    const insight =
      insightByKey.get(submission.participantId) ??
      insightByKey.get(normalizeAdminEmail(submission.participantEmail));
    if (!insight) {
      continue;
    }

    insight.submissions += 1;
    if (
      submission.status === "approved" ||
      submission.status === "winner"
    ) {
      insight.approvals += 1;
    }
    if (submission.onchainAwardStatus === "confirmed") {
      insight.xrdm += numericValue(submission.awardXrdm);
    }
    insight.lastSignal = latestIso(
      insight.lastSignal,
      submission.updatedAt ?? submission.submittedAt,
    );
  }

  for (const reward of rewards) {
    const recipientAward = numericValue(reward.awardXrdm);

    for (const recipient of reward.recipients) {
      const insight =
        insightByKey.get(recipient.userId) ??
        insightByKey.get(normalizeAdminEmail(recipient.email));
      if (!insight) {
        continue;
      }

      if (reward.status === "issued") {
        insight.rewards += 1;
      }
      if (reward.onchainStatus === "confirmed") {
        insight.xrdm += recipientAward;
      }
      insight.lastSignal = latestIso(
        insight.lastSignal,
        reward.issuedAt ?? reward.updatedAt,
      );
    }
  }

  const memberCount = users.filter((user) => user.role !== "host").length;
  const hostCount = users.length - memberCount;
  const roleMetrics = {
    host: {
      segment: "Host",
      users: hostCount,
      rooms: 0,
      joins: 0,
      submissions: 0,
      approvals: 0,
      winners: 0,
      xrdm: 0,
    },
    member: {
      segment: "Member",
      users: memberCount,
      rooms: 0,
      joins: 0,
      submissions: 0,
      approvals: 0,
      winners: 0,
      xrdm: 0,
    },
  };
  const roleFor = (id: string, email?: string) => {
    const user =
      userById.get(id) ??
      (email ? userById.get(normalizeAdminEmail(email)) : undefined);
    return user?.role === "host" ? "host" : "member";
  };
  const roomById = new Map(rooms.map((room) => [room._id, room]));

  for (const user of users) {
    userById.set(normalizeAdminEmail(user.email), user);
  }
  for (const room of rooms) {
    roleMetrics[roleFor(room.hostId)].rooms += 1;
    for (const participant of room.participants ?? []) {
      roleMetrics[roleFor(participant.userId, participant.email)].joins += 1;
    }
  }
  for (const submission of submissions) {
    const participantRole = roleFor(
      submission.participantId,
      submission.participantEmail,
    );
    roleMetrics[participantRole].submissions += 1;
    if (submission.status === "winner") {
      roleMetrics[participantRole].winners += 1;
    }
    if (submission.onchainAwardStatus === "confirmed") {
      roleMetrics[participantRole].xrdm += numericValue(submission.awardXrdm);
    }
    if (
      submission.status === "approved" ||
      submission.status === "winner"
    ) {
      const room = roomById.get(submission.roomId);
      if (room) {
        roleMetrics[roleFor(room.hostId)].approvals += 1;
      }
    }
  }
  for (const reward of rewards) {
    if (reward.onchainStatus !== "confirmed") {
      continue;
    }
    for (const recipient of reward.recipients) {
      roleMetrics[roleFor(recipient.userId, recipient.email)].xrdm +=
        numericValue(reward.awardXrdm);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    dataMode: "live" as const,
    kpis: [
      {
        label: "Total Users",
        value: users.length.toLocaleString("en-US"),
        detail: "Across hosts and participants",
        trend: `${newUsersThisWeek.toLocaleString("en-US")} joined in 7 days`,
        tone: "blue" as const,
      },
      {
        label: "Active Today",
        value: activeUserIds.size.toLocaleString("en-US"),
        detail: "Users with active sessions today",
        trend: "Session-based activity",
        tone: "green" as const,
      },
      {
        label: "Total Rooms",
        value: rooms.length.toLocaleString("en-US"),
        detail: `${
          rooms.filter((room) => room.onchainStatus === "confirmed").length
        } confirmed on-chain`,
        trend: `${newRoomsThisWeek.toLocaleString("en-US")} created in 7 days`,
        tone: "violet" as const,
      },
      {
        label: "Submissions",
        value: submissions.length.toLocaleString("en-US"),
        detail: "All participant submissions",
        trend: `${
          submissions.length
            ? ((approvedSubmissions.length / submissions.length) * 100).toFixed(
                1,
              )
            : "0.0"
        }% approval rate`,
        tone: "green" as const,
      },
      {
        label: "Approved",
        value: approvedSubmissions.length.toLocaleString("en-US"),
        detail: "Approved and winner submissions",
        trend: `${
          submissions.length
            ? ((approvedSubmissions.length / submissions.length) * 100).toFixed(
                1,
              )
            : "0.0"
        }% of submissions`,
        tone: "green" as const,
      },
      {
        label: "XRDM Awarded",
        value: confirmedXrdm.toLocaleString("en-US"),
        detail: "Confirmed rewards only",
        trend: "Submission and reward ledgers",
        tone: "amber" as const,
      },
      {
        label: "Certificates",
        value: certificatesIssued.toLocaleString("en-US"),
        detail: "Issued recipient certificates",
        trend: "Participant and winner records",
        tone: "blue" as const,
      },
      {
        label: "NFT Badges",
        value: nftBadgesIssued.toLocaleString("en-US"),
        detail: "Issued winner badges",
        trend: `${pendingChainEvents.toLocaleString("en-US")} chain events pending`,
        tone: "violet" as const,
      },
      {
        label: "Chain Events",
        value: `${chainSuccessRate.toFixed(1)}%`,
        detail: "Confirmed event success rate",
        trend: `${pendingChainEvents} pending, ${failedChainEvents} failed`,
        tone:
          failedChainEvents > 0
            ? ("red" as const)
            : pendingChainEvents > 0
              ? ("amber" as const)
              : ("green" as const),
      },
    ],
    activity: buildActivity(rooms, submissions, rewards, chainEvents),
    rooms: roomRows,
    movement: buildMovement(users, rooms, submissions),
    activeRooms: roomSegments.slice(0, 6).map((room) => ({
      label: room.segment,
      value: room.submissions,
      meta: `${room.users.toLocaleString("en-US")} participants`,
    })),
    activeHosts: hostSegments.slice(0, 6).map((host) => ({
      label: host.segment,
      value: host.rooms,
      meta: `${host.submissions.toLocaleString("en-US")} submissions`,
    })),
    rewardHealth: [
      {
        label: "Confirmed XRDM",
        value: confirmedXrdm.toLocaleString("en-US"),
        status: "confirmed" as const,
        detail: "Confirmed submission and reward transfers.",
      },
      {
        label: "Pending Chain Events",
        value: pendingChainEvents.toLocaleString("en-US"),
        status: "pending" as const,
        detail: "Waiting for room, reward, or badge confirmation.",
      },
      {
        label: "Failed Chain Events",
        value: failedChainEvents.toLocaleString("en-US"),
        status: "failed" as const,
        detail: "Events requiring operational follow-up.",
      },
      {
        label: "Winners",
        value: winnerSubmissions.length.toLocaleString("en-US"),
        status: "confirmed" as const,
        detail: "Submissions marked as winners by hosts.",
      },
      {
        label: "Certificates",
        value: certificatesIssued.toLocaleString("en-US"),
        status: "confirmed" as const,
        detail: "Participant and winner certificates issued.",
      },
      {
        label: "NFT Badges",
        value: nftBadgesIssued.toLocaleString("en-US"),
        status:
          rewards.some(
            (reward) =>
              reward.kind === "winner_nft_badge" &&
              reward.status === "pending",
          )
            ? ("pending" as const)
            : ("confirmed" as const),
        detail: "Winner NFT badge recipients recorded.",
      },
    ],
    opsHealth: [
      {
        label: "Pending Confirmations",
        value: pendingConfirmations.toLocaleString("en-US"),
        status:
          pendingConfirmations > 0
            ? ("pending" as const)
            : ("confirmed" as const),
        detail: "Chain, XRDM award, and reward records awaiting confirmation.",
      },
      {
        label: "Failed Chain Events",
        value: failedChainEvents.toLocaleString("en-US"),
        status:
          failedChainEvents > 0 ? ("failed" as const) : ("confirmed" as const),
        detail: "Persisted blockchain events with a failed status.",
      },
      {
        label: "Submission Mismatches",
        value: submissionMismatches.toLocaleString("en-US"),
        status:
          submissionMismatches > 0
            ? ("failed" as const)
            : ("confirmed" as const),
        detail: "Approved or winning XRDM awards marked failed on-chain.",
      },
      {
        label: "Reward Mismatches",
        value: rewardMismatches.toLocaleString("en-US"),
        status:
          rewardMismatches > 0 ? ("failed" as const) : ("confirmed" as const),
        detail: "Issued rewards whose on-chain status is failed.",
      },
    ],
    roleSegments: [roleMetrics.host, roleMetrics.member],
    hostSegments,
    roomSegments,
    userInsights: userInsights
      .sort(
        (left, right) =>
          timestamp(right.lastSignal) - timestamp(left.lastSignal),
      )
      .map((insight) => ({
        ...insight,
        xrdm: Math.round(insight.xrdm),
      })),
  };
}

type AdminDashboard = Awaited<ReturnType<typeof loadAdminDashboard>>;

let dashboardCache:
  | {
      data: AdminDashboard;
      expiresAt: number;
    }
  | undefined;
let dashboardRequest: Promise<AdminDashboard> | undefined;

async function getAdminDashboard() {
  if (dashboardCache && dashboardCache.expiresAt > Date.now()) {
    return dashboardCache.data;
  }

  dashboardRequest ??= loadAdminDashboard().then((data) => {
    dashboardCache = {
      data,
      expiresAt: Date.now() + 30_000,
    };
    return data;
  });

  try {
    return await dashboardRequest;
  } finally {
    dashboardRequest = undefined;
  }
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  const email = ctx.session.user.email;

  if (!isAdminEmailAllowed(email, env.ADMIN_ALLOWED_EMAILS)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This email is not authorized for the admin dashboard.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      adminEmail: normalizeAdminEmail(email),
    },
  });
});

export const adminRouter = router({
  access: adminProcedure.query(({ ctx }) => ({
    authorized: true,
    user: {
      email: ctx.adminEmail,
      id: ctx.session.user.id,
      name: ctx.session.user.name,
    },
  })),
  dashboard: adminProcedure.query(async () => getAdminDashboard()),
});
