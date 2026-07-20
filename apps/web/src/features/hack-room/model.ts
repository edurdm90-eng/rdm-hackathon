import type { AppRouter } from "@rdm-hack/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";

import { createNativeIcon, type NativeIconComponent } from "@/lib/native-icons";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DashboardData = RouterOutputs["hackRoom"]["dashboard"];
export type HackRoom = DashboardData["hostedRooms"][number];
export type HackTask = DashboardData["tasks"][number];
export type HackSubmission = DashboardData["hostSubmissions"][number];
export type HackReward = DashboardData["rewards"][number];
export type Role = "host" | "participant";
export type RoomEntry = { role: Role; room: HackRoom };
export type TaskKind = "task" | "challenge" | "game" | "special";
export type AssignmentMode = TaskKind | "notification";
export type HostTab =
  | "assign"
  | "created"
  | "members"
  | "verify"
  | "history"
  | "award"
  | "rewards"
  | "games"
  | "leaderboard"
  | "profile";
export type ParticipantTab = "submit" | "history" | "games" | "wallet";
export type ProofType = "github" | "drive" | "file" | "url" | "video" | "deck" | "game_score";
export type RewardKind = HackReward["kind"];
export type SubmissionStatus = DashboardData["mySubmissions"][number]["status"];
export type GameType = "memory_match" | "breath_timer" | "quick_maths";
export type Tone = "cyan" | "violet" | "gold" | "orange" | "red" | "lime" | "sky";
export type SessionUser = {
  embeddedWalletAddress?: string;
  email: string;
  id: string;
  name: string;
  onchainAddress?: string;
  smartWalletAddress?: string;
  walletAddress?: string;
};
export type ViewerRole = DashboardData["viewerRole"];
export type MiniGameResult = {
  gameType: GameType;
  notes: string;
  proofValue: string;
  score: number;
  title: string;
};
export type RoomTabSegment =
  | "assignments"
  | "award-xrdm"
  | "awards"
  | "created-tasks"
  | "games"
  | "history"
  | "leaderboard"
  | "members"
  | "overview"
  | "profile"
  | "submit"
  | "spot-challenge"
  | "verify"
  | "wallet";

export const proofTypeOptions: Array<{ label: string; value: ProofType }> = [
  { label: "GitHub", value: "github" },
  { label: "Drive", value: "drive" },
  { label: "Video", value: "video" },
  { label: "Deck", value: "deck" },
  { label: "File", value: "file" },
  { label: "URL", value: "url" },
  { label: "Game Score", value: "game_score" },
];

export const defaultRegularProofTypes: ProofType[] = ["github", "drive"];
export const defaultSpotProofTypes: ProofType[] = ["url"];
export const defaultGameProofTypes: ProofType[] = ["game_score"];
export const defaultSpecialProofTypes: ProofType[] = ["url"];
export const minAssignmentDescriptionLength = 10;
export const minNotificationMessageLength = 3;
export const dueAtFutureBufferMs = 60_000;

export function getFriendlyHackRoomErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";

  if (message.includes("Only users with the host role")) {
    return "Only host accounts can create hack rooms. Ask the server/admin owner to make this account a host.";
  }

  if (message.includes("Sync the host smart wallet")) {
    return "Your Privy smart wallet is still syncing. Wait a moment, refresh once, and try Create Room again.";
  }

  if (message.includes("Failed to fetch")) {
    return "API server is not reachable from the browser. Check VITE_SERVER_URL and deployed server CORS.";
  }

  return message;
}

export const gameTypeOptions: Array<{
  description: string;
  icon: NativeIconComponent;
  label: string;
  value: GameType;
}> = [
  {
    description: "Find matching XRDM cards before your moves stack up.",
    icon: createNativeIcon("albums-outline"),
    label: "Memory Match",
    value: "memory_match",
  },
  {
    description: "A calm timed breathing loop for between sprint pushes.",
    icon: createNativeIcon("leaf-outline"),
    label: "Breath Timer",
    value: "breath_timer",
  },
  {
    description: "Answer quick arithmetic rounds against the clock.",
    icon: createNativeIcon("calculator-outline"),
    label: "Quick Maths",
    value: "quick_maths",
  },
];

export const hostTabs: Array<{ id: HostTab; icon: NativeIconComponent; label: string }> = [
  { id: "assign", icon: createNativeIcon("clipboard-outline"), label: "Assignments" },
  { id: "created", icon: createNativeIcon("layers-outline"), label: "Created Tasks" },
  { id: "members", icon: createNativeIcon("people-outline"), label: "Members" },
  { id: "verify", icon: createNativeIcon("shield-checkmark-outline"), label: "Verify" },
  { id: "history", icon: createNativeIcon("time-outline"), label: "History" },
  { id: "award", icon: createNativeIcon("trophy-outline"), label: "Award XRDM" },
  { id: "rewards", icon: createNativeIcon("ribbon-outline"), label: "Awards" },
  { id: "games", icon: createNativeIcon("game-controller-outline"), label: "Games" },
  { id: "leaderboard", icon: createNativeIcon("podium-outline"), label: "Leaderboard" },
  { id: "profile", icon: createNativeIcon("person-circle-outline"), label: "Profile" },
];

export const participantTabs: Array<{ id: ParticipantTab; icon: NativeIconComponent; label: string }> = [
  { id: "submit", icon: createNativeIcon("send-outline"), label: "Submit Task" },
  { id: "history", icon: createNativeIcon("time-outline"), label: "History" },
  { id: "games", icon: createNativeIcon("game-controller-outline"), label: "Games" },
  { id: "wallet", icon: createNativeIcon("wallet-outline"), label: "Wallet" },
];

export const hostTabSegments: Record<HostTab, RoomTabSegment> = {
  assign: "assignments",
  award: "award-xrdm",
  created: "created-tasks",
  games: "games",
  history: "history",
  leaderboard: "leaderboard",
  members: "members",
  profile: "profile",

  rewards: "awards",
  verify: "verify",
};

const hostTabsBySegment: Partial<Record<string, HostTab>> = {
  assign: "assign",
  assignments: "assign",
  awards: "rewards",
  "award-xrdm": "award",
  created: "created",
  "created-tasks": "created",
  games: "games",
  history: "history",
  leaderboard: "leaderboard",
  members: "members",
  overview: "assign",
  profile: "profile",
  rewards: "rewards",
  "spot-challenge": "assign",
  verify: "verify",
};

export const participantTabSegments: Record<ParticipantTab, RoomTabSegment> = {
  games: "games",
  history: "history",

  submit: "submit",
  wallet: "wallet",
};

const participantTabsBySegment: Partial<Record<string, ParticipantTab>> = {
  assignments: "submit",
  games: "games",
  history: "history",
  overview: "submit",
  submit: "submit",
  wallet: "wallet",
};

export const emptyRoomForm = {
  description: "",
  name: "",
};

export const emptyTaskForm = {
  assignedToEmail: "",
  description: "",
  dueAt: "",
  gameType: "memory_match" as GameType,
  rewardXrdm: "20",
  title: "",
};

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

export function getMinimumDueAtInputValue(date = new Date()) {
  const minimum = new Date(date.getTime() + dueAtFutureBufferMs);
  return `${minimum.getFullYear()}-${padDatePart(minimum.getMonth() + 1)}-${padDatePart(minimum.getDate())}T${padDatePart(minimum.getHours())}:${padDatePart(minimum.getMinutes())}`;
}

export function parseDueAtInputValue(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isFutureDueAt(value: string, date = new Date()) {
  const timestamp = parseDueAtInputValue(value);
  return timestamp !== null && timestamp >= date.getTime() + dueAtFutureBufferMs;
}

export function makeEmptyProofItems(): Record<ProofType, string> {
  return {
    deck: "",
    drive: "",
    file: "",
    game_score: "",
    github: "",
    url: "",
    video: "",
  };
}

export function makeEmptySubmitForm(submitterName = "") {
  return {
    description: "",
    notes: "",
    proofItems: makeEmptyProofItems(),
    submitterName,
    teamMateEmailDraft: "",
    teamMateEmails: [] as string[],
    teamName: "",
  };
}

export function makeEmptyRewardForm() {
  return {
    awardXrdm: "0",
    description: "",
    kind: "participant_certificate" as RewardKind,
    ledgerNote: "",
    recipientEmailDraft: "",
    recipientEmails: [] as string[],
    recipientIds: [] as string[],
    recipientMode: "all" as "all" | "individual",
    sourceSubmissionId: "",
    title: "",
  };
}

export function buildRoomEntries(hostedRooms: HackRoom[], joinedRooms: HackRoom[]) {
  const seen = new Set<string>();
  const rooms: RoomEntry[] = [];

  hostedRooms.forEach((room) => {
    seen.add(room._id);
    rooms.push({ role: "host", room });
  });
  joinedRooms.forEach((room) => {
    if (!seen.has(room._id)) {
      rooms.push({ role: "participant", room });
    }
  });

  return rooms;
}

export function countUniqueNetworkParticipants(rooms: HackRoom[], currentUserId: string) {
  const participantIds = new Set<string>();
  rooms.forEach((room) => {
    room.participants.forEach((participant) => {
      if (participant.userId !== currentUserId && participant.userId !== room.hostId) {
        participantIds.add(participant.userId);
      }
    });
  });
  return participantIds.size;
}

export function slugifyRoomName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getRoomRouteParam(room: Pick<HackRoom, "_id" | "inviteCode" | "name">) {
  return slugifyRoomName(room.name) || room.inviteCode || room._id;
}

export function matchesRoomRouteParam(room: Pick<HackRoom, "_id" | "inviteCode" | "name">, value: string) {
  const decodedValue = decodeURIComponent(value).toLowerCase();
  return (
    room._id === value ||
    room.inviteCode.toLowerCase() === decodedValue ||
    slugifyRoomName(room.name) === decodedValue
  );
}

export function getTone(tone: Tone | SubmissionStatus | string): Tone {
  if (tone === "submitted") return "violet";
  if (tone === "approved") return "cyan";
  if (tone === "winner") return "gold";
  if (tone === "returned") return "red";
  if (["cyan", "violet", "gold", "orange", "red", "lime", "sky"].includes(tone)) {
    return tone as Tone;
  }
  return "gold";
}

export function toneSurface(tone: Tone | SubmissionStatus | string) {
  const normalizedTone = getTone(tone);
  return `${tonePanelSurface(normalizedTone)} ${toneText(normalizedTone)}`;
}

export function tonePanelSurface(tone: Tone | SubmissionStatus | string) {
  const normalizedTone = getTone(tone);
  if (normalizedTone === "violet") return "border-[#4A1A90] bg-[#160A2A]";
  if (normalizedTone === "gold") return "border-[#8A6A00] bg-[#241A00]";
  if (normalizedTone === "orange") return "border-[#904200] bg-[#241000]";
  if (normalizedTone === "red") return "border-[#901E14] bg-[#280A08]";
  if (normalizedTone === "lime") return "border-[#3A6A10] bg-[#0E1C04]";
  if (normalizedTone === "sky") return "border-[#0C5888] bg-[#061428]";
  return "border-[#0B8060] bg-[#061F18]";
}

export function toneText(tone: Tone, dim = false) {
  if (dim) {
    if (tone === "gold") return "text-[#F0C040]";
    if (tone === "violet") return "text-[#A060FF]";
    if (tone === "orange") return "text-[#FF8820]";
    if (tone === "red") return "text-[#FF5A4A]";
    if (tone === "lime") return "text-[#80E040]";
    if (tone === "sky") return "text-[#38B8FF]";
    if (tone === "cyan") return "text-[#1EEAB0]";
    return "text-[#626058]";
  }
  if (tone === "gold") return "text-[#F0C040]";
  if (tone === "violet") return "text-[#A060FF]";
  if (tone === "orange") return "text-[#FF8820]";
  if (tone === "red") return "text-[#FF5A4A]";
  if (tone === "lime") return "text-[#80E040]";
  if (tone === "sky") return "text-[#38B8FF]";
  return "text-[#1EEAB0]";
}

export function toneTopBorder(tone: Tone) {
  if (tone === "violet") return "border-t-[#4A1A90]";
  if (tone === "gold") return "border-t-[#8A6A00]";
  if (tone === "orange") return "border-t-[#904200]";
  if (tone === "red") return "border-t-[#901E14]";
  if (tone === "lime") return "border-t-[#3A6A10]";
  if (tone === "sky") return "border-t-[#0C5888]";
  return "border-t-[#0B8060]";
}

export function normalizeTaskProofTypes(kind: TaskKind | AssignmentMode, proofTypes: ProofType[]) {
  if (kind === "task") {
    return [...new Set([...defaultRegularProofTypes, ...proofTypes])];
  }
  if (kind === "game") {
    return defaultGameProofTypes;
  }
  if (kind === "special") {
    return proofTypes.length ? [...new Set(proofTypes)] : defaultSpecialProofTypes;
  }
  return proofTypes.length ? [...new Set(proofTypes)] : defaultSpotProofTypes;
}

export function getTaskProofTypes(task?: Pick<HackTask, "kind" | "proofTypes">) {
  if (task?.kind === "game") return defaultGameProofTypes;
  return normalizeTaskProofTypes(task?.kind ?? "task", task?.proofTypes ?? []);
}

export function canViewTaskForRole(task: HackTask, role: Role, user: SessionUser) {
  if (role === "host") {
    return true;
  }

  if ((task.kind ?? "task") !== "special") {
    return true;
  }

  return task.assignedToUserId === user.id || task.assignedToEmail?.toLowerCase() === user.email.toLowerCase();
}

export function getHostTabFromSegment(segment: string): HostTab {
  return hostTabsBySegment[segment] ?? "assign";
}

export function getParticipantTabFromSegment(segment: string): ParticipantTab {
  return participantTabsBySegment[segment] ?? "submit";
}

export function isParticipantSubmitTask(task: HackTask) {
  return ["task", "special"].includes(task.kind ?? "task");
}

export function buildProofItemsForTask(task: HackTask, submitForm: ReturnType<typeof makeEmptySubmitForm>) {
  return getTaskProofTypes(task).map((proofType) => ({
    type: proofType,
    value: submitForm.proofItems[proofType]?.trim() ?? "",
  }));
}

export function hasRequiredProofItems(task: HackTask, submitForm: ReturnType<typeof makeEmptySubmitForm>) {
  return buildProofItemsForTask(task, submitForm).every((item) => item.value.trim().length >= 3);
}

export function getSubmissionProofItems(
  submission: { proofItems?: Array<{ type: ProofType; value: string }>; proofUrl?: string },
) {
  if (submission.proofItems?.length) {
    return submission.proofItems;
  }
  return submission.proofUrl ? [{ type: "url" as const, value: submission.proofUrl }] : [];
}

export function proofTypeLabel(proofType: ProofType) {
  const labels: Record<ProofType, string> = {
    deck: "Deck",
    drive: "Drive",
    file: "File",
    game_score: "Score",
    github: "GitHub",
    url: "URL",
    video: "Video",
  };
  return labels[proofType];
}

export function proofTypePlaceholder(proofType: ProofType) {
  if (proofType === "github") return "https://github.com/team/project";
  if (proofType === "drive") return "https://drive.google.com/...";
  if (proofType === "video") return "https://youtu.be/...";
  if (proofType === "deck") return "https://slides.example.com/...";
  if (proofType === "game_score") return "Memory Match result - score 100";
  return "https://demo.example.com";
}

export function proofTypeIcon(proofType: ProofType): NativeIconComponent {
  if (proofType === "github") return createNativeIcon("logo-github");
  if (proofType === "drive") return createNativeIcon("cloud-outline");
  if (proofType === "video") return createNativeIcon("videocam-outline");
  if (proofType === "deck") return createNativeIcon("easel-outline");
  if (proofType === "file") return createNativeIcon("document-attach-outline");
  if (proofType === "game_score") return createNativeIcon("game-controller-outline");
  return createNativeIcon("link-outline");
}

export function kindLabel(kind: TaskKind) {
  if (kind === "challenge") return "Challenge";
  if (kind === "game") return "Game";
  if (kind === "special") return "Special";
  return "Task";
}

export function submissionStatusLabel(status: SubmissionStatus) {
  if (status === "approved") return "Verified";
  if (status === "winner") return "Winner";
  if (status === "returned") return "Returned";
  return "Submitted";
}

export function submissionStatusHeadline(status: SubmissionStatus) {
  if (status === "approved") return "Proof verified";
  if (status === "winner") return "Winner announced";
  if (status === "returned") return "Proof returned";
  return "Proof sent for verification";
}

export function statusTone(status?: SubmissionStatus): Tone {
  if (status === "approved") return "cyan";
  if (status === "winner") return "gold";
  if (status === "returned") return "red";
  if (status === "submitted") return "violet";
  return "gold";
}

export function rewardKindLabel(kind: RewardKind) {
  if (kind === "participant_certificate") return "Certificate";
  if (kind === "winner_certificate") return "Winner Certificate";
  return "NFT Badge";
}

export function getSubmissionLedgerXrdm(
  submission: Pick<HackSubmission, "awardXrdm" | "rewardXrdm">,
) {
  return submission.awardXrdm ?? submission.rewardXrdm ?? 0;
}

export function buildLeaderboard(room: HackRoom | undefined, submissions: HackSubmission[], rewards: HackReward[]) {
  const entries = new Map<string, { email: string; name: string; points: number; wins: number }>();
  room?.participants.forEach((participant) => {
    entries.set(participant.userId, {
      email: participant.email,
      name: participant.name,
      points: 0,
      wins: 0,
    });
  });
  submissions.forEach((submission) => {
    const existing =
      entries.get(submission.participantId) ??
      {
        email: submission.participantEmail,
        name: submission.participantName,
        points: 0,
        wins: 0,
      };
    existing.points += getSubmissionLedgerXrdm(submission);
    existing.wins += submission.status === "winner" ? 1 : 0;
    entries.set(submission.participantId, existing);
  });
  rewards.forEach((reward) => {
    reward.recipients.forEach((recipient) => {
      const existing =
        entries.get(recipient.userId) ??
        {
          email: recipient.email,
          name: recipient.name,
          points: 0,
          wins: 0,
        };
      existing.points += reward.awardXrdm ?? 0;
      entries.set(recipient.userId, existing);
    });
  });
  return [...entries.values()].sort((left, right) => right.points - left.points || right.wins - left.wins);
}

export function getGameTypeInfo(gameType: GameType) {
  return gameTypeOptions.find((option) => option.value === gameType) ?? gameTypeOptions[0];
}

export function makeMiniGameResult(gameType: GameType, score: number, detail: string): MiniGameResult {
  const gameInfo = getGameTypeInfo(gameType);
  return {
    gameType,
    notes: `Completed ${gameInfo.label}. ${detail}. Score: ${score}.`,
    proofValue: `${gameInfo.label} result - ${detail} - score ${score}`,
    score,
    title: gameInfo.label,
  };
}

export function makeMemoryCards() {
  const pairs = [
    { label: "AI", value: "ai" },
    { label: "UX", value: "ux" },
    { label: "API", value: "api" },
    { label: "XR", value: "xr" },
  ];
  return pairs
    .flatMap((card) => [
      { ...card, id: `${card.value}-a` },
      { ...card, id: `${card.value}-b` },
    ])
    .sort(() => Math.random() - 0.5);
}

export function makeMathQuestion(seed: number) {
  const left = 8 + seed * 3 + Math.floor(Math.random() * 9);
  const right = 4 + seed * 2 + Math.floor(Math.random() * 7);
  if (seed % 3 === 2) {
    const smallLeft = 2 + (seed % 4);
    const smallRight = 5 + Math.floor(Math.random() * 5);
    return { answer: smallLeft * smallRight, prompt: `${smallLeft} x ${smallRight}` };
  }
  return { answer: left + right, prompt: `${left} + ${right}` };
}

export function getEmailTokens(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeEmails(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(isEmailLike))];
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

export function friendlyMutationMessage(message: string) {
  const trimmed = message.trim();

  if (!trimmed.startsWith("[")) {
    return message;
  }

  try {
    const issues = JSON.parse(trimmed) as Array<{
      code?: string;
      message?: string;
      minimum?: number;
      path?: string[];
    }>;
    const issue = issues[0];
    const field = issue?.path?.at(-1);

    if (field === "description" && issue?.code === "too_small") {
      return `Description must be at least ${issue.minimum ?? minAssignmentDescriptionLength} characters.`;
    }

    if (field === "title" && issue?.code === "too_small") {
      return `Title must be at least ${issue.minimum ?? 3} characters.`;
    }

    if (field && issue?.message) {
      return `${toTitleCase(field)}: ${issue.message}`;
    }
  } catch {
    return message;
  }

  return message;
}

export function toTitleCase(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "HR";
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Soon";
  }
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

export function toExternalUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}
