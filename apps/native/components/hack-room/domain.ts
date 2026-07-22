import { Ionicons } from "@expo/vector-icons";
import type { AppRouter } from "@rdm-hack/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";
import type React from "react";

import { HACK_THEME as theme } from "@/lib/constants";

export type RouterOutputs = inferRouterOutputs<AppRouter>;
export type DashboardData = RouterOutputs["hackRoom"]["dashboard"];
export type HackTask = DashboardData["tasks"][number];
export type HackRoom = DashboardData["hostedRooms"][number];
export type HackSubmission = DashboardData["hostSubmissions"][number];
export type HackReward = DashboardData["rewards"][number];
export type HackNotification = DashboardData["notifications"][number];
export type Role = "member" | "host";
export type TaskKind = "task" | "challenge" | "game" | "special";
export type AssignmentMode = TaskKind | "notification";
export type RoomTab =
  | "assign"
  | "awards"
  | "created"
  | "games"
  | "history"
  | "leaderboard"
  | "participants"
  | "profile"
  | "verify"
  | "winners";
export type ParticipantTab = "games" | "history" | "submit" | "wallet";
export type SubmissionStatus = DashboardData["mySubmissions"][number]["status"];
export type ProofType =
  "github" | "drive" | "file" | "url" | "video" | "deck" | "game_score";
export type RewardKind = HackReward["kind"];
export type GameType = "memory_match" | "breath_timer" | "quick_maths";
export type SubmissionProofItem = {
  type: ProofType;
  value: string;
};
export type MiniGameResult = {
  gameType: GameType;
  notes: string;
  proofValue: string;
  score: number;
  title: string;
};
export type MiniGameSession = {
  mode: "assignment" | "practice";
  task?: HackTask;
  type: GameType;
};
export type RegistrationPlan = Array<{
  address: string;
  userId: string;
}>;
export type Tone =
  "cyan" | "violet" | "gold" | "orange" | "red" | "lime" | "sky";
export type SessionUser = {
  email: string;
  id: string;
  name: string;
};

type HackIconName = React.ComponentProps<typeof Ionicons>["name"];
type ToneColors = {
  bg: string;
  border: string;
  buttonText: string;
  fg: string;
};
type KnownSubmissionStatus = "approved" | "returned" | "submitted" | "winner";

const proofTypeConfig: Record<
  ProofType,
  {
    icon: HackIconName;
    label: string;
    placeholder: string;
  }
> = {
  deck: {
    icon: "easel-outline",
    label: "Deck",
    placeholder: "https://docs.google.com/presentation/...",
  },
  drive: {
    icon: "cloud-outline",
    label: "Drive",
    placeholder: "https://drive.google.com/...",
  },
  file: {
    icon: "document-attach-outline",
    label: "File",
    placeholder: "https://drive.google.com/file/...",
  },
  game_score: {
    icon: "game-controller-outline",
    label: "Game Score",
    placeholder: "Game result will appear here after completion",
  },
  github: {
    icon: "logo-github",
    label: "GitHub",
    placeholder: "https://github.com/team/project",
  },
  url: {
    icon: "link-outline",
    label: "URL",
    placeholder: "https://your-proof-link",
  },
  video: {
    icon: "videocam-outline",
    label: "Video",
    placeholder: "https://loom.com/share/demo",
  },
};
const proofTypeOrder: Array<ProofType> = [
  "github",
  "drive",
  "video",
  "deck",
  "file",
  "url",
  "game_score",
];

export const proofTypeOptions: Array<{ label: string; value: ProofType }> = [
  ...proofTypeOrder.map((value) => ({
    label: proofTypeConfig[value].label,
    value,
  })),
];
export const defaultRegularProofTypes: Array<ProofType> = ["github", "drive"];
export const defaultSpotProofTypes: Array<ProofType> = ["url"];
export const defaultGameProofTypes: Array<ProofType> = ["game_score"];
export const defaultSpecialProofTypes: Array<ProofType> = ["url"];
export const gameTypeOptions: Array<{
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: GameType;
}> = [
  {
    description: "Find matching XRDM cards before your moves stack up.",
    icon: "albums-outline",
    label: "Memory Match",
    value: "memory_match",
  },
  {
    description: "A calm timed breathing loop for between sprint pushes.",
    icon: "leaf-outline",
    label: "Breath Timer",
    value: "breath_timer",
  },
  {
    description: "Answer quick arithmetic rounds against the clock.",
    icon: "calculator-outline",
    label: "Quick Maths",
    value: "quick_maths",
  },
];

const toneColorByTone: Record<Tone, ToneColors> = {
  cyan: {
    bg: theme.participantDark,
    border: theme.participantBorder,
    buttonText: "#03120c",
    fg: theme.participant,
  },
  gold: {
    bg: theme.awardDark,
    border: theme.awardBorder,
    buttonText: "#120d00",
    fg: theme.award,
  },
  lime: {
    bg: theme.limeDark,
    border: theme.limeBorder,
    buttonText: "#081000",
    fg: theme.lime,
  },
  orange: {
    bg: theme.warningDark,
    border: theme.warningBorder,
    buttonText: "#170900",
    fg: theme.warning,
  },
  red: {
    bg: theme.dangerDark,
    border: theme.dangerBorder,
    buttonText: "#220302",
    fg: theme.danger,
  },
  sky: {
    bg: theme.skyDark,
    border: theme.skyBorder,
    buttonText: "#02101a",
    fg: theme.sky,
  },
  violet: {
    bg: theme.hostDark,
    border: theme.hostBorder,
    buttonText: "#060214",
    fg: theme.host,
  },
};

const rewardKindConfig: Record<
  RewardKind,
  {
    defaultTitle: string;
    icon: HackIconName;
    label: string;
    tone: Tone;
  }
> = {
  participant_certificate: {
    defaultTitle: "Member Certificate",
    icon: "ribbon-outline",
    label: "Member",
    tone: "cyan",
  },
  winner_certificate: {
    defaultTitle: "Winner Certificate",
    icon: "trophy-outline",
    label: "Winner Cert",
    tone: "violet",
  },
  winner_nft_badge: {
    defaultTitle: "Winner NFT Badge",
    icon: "diamond-outline",
    label: "NFT Badge",
    tone: "gold",
  },
};

const submissionStatusConfig: Record<
  KnownSubmissionStatus,
  {
    holdIcon: HackIconName;
    label: string;
    tone: Tone;
  }
> = {
  approved: {
    holdIcon: "checkmark-circle-outline",
    label: "Verified",
    tone: "cyan",
  },
  returned: {
    holdIcon: "refresh-outline",
    label: "Returned",
    tone: "red",
  },
  submitted: {
    holdIcon: "hourglass-outline",
    label: "Submitted",
    tone: "orange",
  },
  winner: {
    holdIcon: "trophy-outline",
    label: "Winner",
    tone: "gold",
  },
};

const taskKindConfig: Record<
  TaskKind,
  {
    label: string;
    tone: Tone;
  }
> = {
  challenge: {
    label: "Challenge",
    tone: "orange",
  },
  game: {
    label: "Game",
    tone: "lime",
  },
  special: {
    label: "Special",
    tone: "sky",
  },
  task: {
    label: "Task",
    tone: "violet",
  },
};

export const emptyRoomForm = {
  description: "",
  name: "",
};

export type PendingRoomCreate = {
  pendingId: string;
  txHash: string;
};

export const emptyTaskForm = {
  assignedToEmail: "",
  description: "",
  dueAt: "",
  gameType: "memory_match" as GameType,
  rewardXrdm: "20",
  title: "",
};

export const minimumTaskDueOffsetMs = 60_000;

export function makeEmptyRewardForm() {
  return {
    awardXrdm: "0",
    description: "",
    ledgerNote: "",
    recipientEmailDraft: "",
    recipientEmails: [] as Array<string>,
    sourceSubmissionId: "",
    title: "",
  };
}

export type RewardForm = ReturnType<typeof makeEmptyRewardForm>;
export type RewardFormsByKind = Record<RewardKind, RewardForm>;
export type RewardFormSetter = React.Dispatch<React.SetStateAction<RewardForm>>;

export function makeEmptyRewardForms(): RewardFormsByKind {
  return {
    participant_certificate: makeEmptyRewardForm(),
    winner_certificate: makeEmptyRewardForm(),
    winner_nft_badge: makeEmptyRewardForm(),
  };
}

export function countNativeNetworkParticipants(
  rooms: Array<HackRoom>,
  currentUser: SessionUser,
) {
  const networkParticipantIds = new Set<string>();
  const currentEmail = currentUser.email.trim().toLowerCase();

  rooms.forEach((room) => {
    room.participants.forEach((participant) => {
      const participantEmail = participant.email.trim().toLowerCase();
      if (
        participant.userId === currentUser.id ||
        participant.userId === room.hostId ||
        participantEmail === currentEmail
      ) {
        return;
      }

      networkParticipantIds.add(participant.userId);
    });
  });

  return networkParticipantIds.size;
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
    proofUrl: "",
    submitterName,
    teamMateEmailDraft: "",
    teamMateEmails: [] as Array<string>,
    teamName: "",
  };
}

export const emptySubmitForm = makeEmptySubmitForm();

export function getToneColors(tone: Tone) {
  return toneColorByTone[tone];
}

export function getGameTypeInfo(gameType: GameType) {
  return (
    gameTypeOptions.find((option) => option.value === gameType) ??
    gameTypeOptions[0]
  );
}

export function getTaskGameType(task: Pick<HackTask, "gameType">): GameType {
  return (task.gameType ?? "memory_match") as GameType;
}

export function makeMiniGameResult(
  gameType: GameType,
  score: number,
  detail: string,
): MiniGameResult {
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
  const multiply = seed % 3 === 2;
  if (multiply) {
    const smallLeft = 2 + (seed % 4);
    const smallRight = 5 + Math.floor(Math.random() * 5);
    return {
      answer: smallLeft * smallRight,
      prompt: `${smallLeft} x ${smallRight}`,
    };
  }

  return {
    answer: left + right,
    prompt: `${left} + ${right}`,
  };
}

export function normalizeTaskProofTypes(
  kind: TaskKind,
  proofTypes: Array<ProofType>,
) {
  if (kind === "task") {
    return [...new Set([...defaultRegularProofTypes, ...proofTypes])];
  }

  if (kind === "game") {
    return defaultGameProofTypes;
  }

  if (kind === "special") {
    return proofTypes.length
      ? [...new Set(proofTypes)]
      : defaultSpecialProofTypes;
  }

  return proofTypes.length ? [...new Set(proofTypes)] : defaultSpotProofTypes;
}

export function getTaskProofTypes(
  task?: Pick<HackTask, "kind" | "proofTypes">,
) {
  if (task?.kind === "game") {
    return defaultGameProofTypes;
  }

  if (task?.kind === "special") {
    return task.proofTypes?.length ? task.proofTypes : defaultSpecialProofTypes;
  }

  return task?.proofTypes?.length ? task.proofTypes : defaultSpotProofTypes;
}

export function getEmailTokens(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizeEmails(values: Array<string>) {
  return [
    ...new Set(
      values.map((email) => email.trim().toLowerCase()).filter(isEmailLike),
    ),
  ];
}

export function getInvalidEmails(values: Array<string>) {
  return values
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .filter((email) => !isEmailLike(email));
}

export function buildProofItemsForTask(
  task: HackTask,
  submitForm: typeof emptySubmitForm,
): Array<SubmissionProofItem> {
  return getTaskProofTypes(task).map((proofType, index) => ({
    type: proofType,
    value: (
      submitForm.proofItems[proofType] ||
      (index === 0 ? submitForm.proofUrl : "")
    ).trim(),
  }));
}

export function isLinkProofType(proofType: ProofType) {
  return proofType !== "game_score";
}

export function isHttpsProofUrl(value: string) {
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

export function hasRequiredProofItems(
  task: HackTask,
  submitForm: typeof emptySubmitForm,
) {
  return buildProofItemsForTask(task, submitForm).every((proofItem) =>
    proofItem.value.trim(),
  );
}

export function canShowProofSubmitCard(status?: SubmissionStatus) {
  return !status || status === "returned";
}

export function getSubmissionProofItems(submission: {
  proofItems?: Array<SubmissionProofItem>;
  proofUrl: string;
}) {
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

export function proofTypeLabel(proofType: ProofType) {
  return proofTypeConfig[proofType].label;
}

export function proofTypePlaceholder(proofType: ProofType) {
  return proofTypeConfig[proofType].placeholder;
}

export function proofTypeIcon(
  proofType: ProofType,
): React.ComponentProps<typeof Ionicons>["name"] {
  return proofTypeConfig[proofType].icon;
}

export function defaultRewardTitle(kind: RewardKind) {
  return rewardKindConfig[kind].defaultTitle;
}

export function rewardKindLabel(kind: RewardKind) {
  return rewardKindConfig[kind].label;
}

export function rewardKindIcon(
  kind: RewardKind,
): React.ComponentProps<typeof Ionicons>["name"] {
  return rewardKindConfig[kind].icon;
}

export function rewardKindTone(kind: RewardKind): Tone {
  return rewardKindConfig[kind].tone;
}

export function submissionStatusLabel(status: SubmissionStatus) {
  return (
    submissionStatusConfig[status as KnownSubmissionStatus]?.label ?? status
  );
}

export function statusTone(status?: SubmissionStatus) {
  return (
    submissionStatusConfig[status as KnownSubmissionStatus]?.tone ?? "gold"
  );
}

export function submissionHoldIcon(
  status: SubmissionStatus,
): React.ComponentProps<typeof Ionicons>["name"] {
  return (
    submissionStatusConfig[status as KnownSubmissionStatus]?.holdIcon ??
    "hourglass-outline"
  );
}

export function taskKindTone(kind: TaskKind): Tone {
  return taskKindConfig[kind].tone;
}

export function kindLabel(kind: TaskKind) {
  return taskKindConfig[kind].label;
}

export function notificationBannerMessage(
  notifications: Array<HackNotification>,
) {
  if (!notifications.length) {
    return "No new notifications right now";
  }

  const latest = notifications[0];
  return `${latest.title} - ${latest.roomName}: ${latest.message}`;
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

export function firstName(name: string) {
  return name.split(" ").filter(Boolean)[0] ?? "Hacker";
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

export function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

export function getMinimumTaskDueDate(date = new Date()) {
  return new Date(date.getTime() + minimumTaskDueOffsetMs);
}

export function getTaskDueDateError(value: string, date = new Date()) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  const timestamp = new Date(trimmedValue).getTime();
  if (Number.isNaN(timestamp)) {
    return "Choose a valid due date and time";
  }

  if (timestamp <= getMinimumTaskDueDate(date).getTime()) {
    return "Due date and time must be in the future";
  }

  return null;
}

export function parseDateTimeValue(value: string) {
  const parsedDate = value ? new Date(value) : new Date();
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }
  return parsedDate;
}

export function mergeDateParts(baseDate: Date, selectedDate: Date) {
  const nextDate = new Date(baseDate);
  nextDate.setFullYear(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  return nextDate;
}

export function mergeTimeParts(baseDate: Date, selectedDate: Date) {
  const nextDate = new Date(baseDate);
  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return nextDate;
}

export function formatDateTimeValue(value: string) {
  const date = parseDateTimeValue(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}
