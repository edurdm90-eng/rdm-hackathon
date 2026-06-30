import type { AppRouter } from "@rdm-hack/api/routers/index";
import { Button } from "@rdm-hack/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rdm-hack/ui/components/card";
import { Input } from "@rdm-hack/ui/components/input";
import { Label } from "@rdm-hack/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import {
  ArrowLeft,
  Award,
  Bell,
  Bolt,
  Calculator,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Crown,
  Database,
  Diamond,
  DoorOpen,
  ExternalLink,
  FileText,
  Gamepad2,
  Home,
  KeyRound,
  Leaf,
  LinkIcon,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Presentation,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  User,
  UserCircle,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DashboardData = RouterOutputs["hackRoom"]["dashboard"];
type HackRoom = DashboardData["hostedRooms"][number];
type HackTask = DashboardData["tasks"][number];
type HackSubmission = DashboardData["hostSubmissions"][number];
type HackReward = DashboardData["rewards"][number];
type Role = "host" | "participant";
type RoomEntry = { role: Role; room: HackRoom };
type TaskKind = "task" | "challenge" | "game" | "special";
type AssignmentMode = TaskKind | "notification";
type HostTab =
  | "quick"
  | "assign"
  | "members"
  | "verify"
  | "history"
  | "award"
  | "rewards"
  | "games"
  | "leaderboard"
  | "profile";
type ParticipantTab = "quick" | "submit" | "history" | "games" | "wallet";
type ProofType = "github" | "drive" | "file" | "url" | "video" | "deck" | "game_score";
type RewardKind = HackReward["kind"];
type SubmissionStatus = DashboardData["mySubmissions"][number]["status"];
type GameType = "memory_match" | "breath_timer" | "quick_maths";
type Tone = "cyan" | "violet" | "gold" | "orange" | "red" | "lime" | "sky";
type SessionUser = {
  email: string;
  id: string;
  name: string;
};
type MiniGameResult = {
  gameType: GameType;
  notes: string;
  proofValue: string;
  score: number;
  title: string;
};
type RoomTabSegment =
  | "assignments"
  | "award-xrdm"
  | "awards"
  | "games"
  | "history"
  | "leaderboard"
  | "members"
  | "overview"
  | "profile"
  | "submit"
  | "verify"
  | "wallet";

const proofTypeOptions: Array<{ label: string; value: ProofType }> = [
  { label: "GitHub", value: "github" },
  { label: "Drive", value: "drive" },
  { label: "Video", value: "video" },
  { label: "Deck", value: "deck" },
  { label: "File", value: "file" },
  { label: "URL", value: "url" },
  { label: "Game Score", value: "game_score" },
];
const defaultRegularProofTypes: ProofType[] = ["github", "drive"];
const defaultSpotProofTypes: ProofType[] = ["url"];
const defaultGameProofTypes: ProofType[] = ["game_score"];
const defaultSpecialProofTypes: ProofType[] = ["url"];
const minAssignmentDescriptionLength = 10;
const minNotificationMessageLength = 3;

const gameTypeOptions: Array<{
  description: string;
  icon: typeof Gamepad2;
  label: string;
  value: GameType;
}> = [
  {
    description: "Find matching XRDM cards before your moves stack up.",
    icon: Gamepad2,
    label: "Memory Match",
    value: "memory_match",
  },
  {
    description: "A calm timed breathing loop for between sprint pushes.",
    icon: Leaf,
    label: "Breath Timer",
    value: "breath_timer",
  },
  {
    description: "Answer quick arithmetic rounds against the clock.",
    icon: Calculator,
    label: "Quick Maths",
    value: "quick_maths",
  },
];

const hostTabs: Array<{ id: HostTab; icon: typeof Home; label: string }> = [
  { id: "quick", icon: Bolt, label: "Quick Actions" },
  { id: "assign", icon: ClipboardList, label: "Assignments" },
  { id: "members", icon: Users, label: "Members" },
  { id: "verify", icon: ShieldCheck, label: "Verify" },
  { id: "history", icon: Clock, label: "History" },
  { id: "award", icon: Trophy, label: "Award XRDM" },
  { id: "rewards", icon: Award, label: "Awards" },
  { id: "games", icon: Gamepad2, label: "Games" },
  { id: "leaderboard", icon: Crown, label: "Leaderboard" },
  { id: "profile", icon: UserCircle, label: "Profile" },
];

const participantTabs: Array<{ id: ParticipantTab; icon: typeof Home; label: string }> = [
  { id: "quick", icon: Bolt, label: "Quick Actions" },
  { id: "submit", icon: Send, label: "Submit Task" },
  { id: "history", icon: Clock, label: "History" },
  { id: "games", icon: Gamepad2, label: "Games" },
  { id: "wallet", icon: Wallet, label: "Wallet" },
];

const hostTabSegments: Record<HostTab, RoomTabSegment> = {
  assign: "assignments",
  award: "award-xrdm",
  games: "games",
  history: "history",
  leaderboard: "leaderboard",
  members: "members",
  profile: "profile",
  quick: "overview",
  rewards: "awards",
  verify: "verify",
};

const hostTabsBySegment: Partial<Record<string, HostTab>> = {
  assign: "assign",
  assignments: "assign",
  awards: "rewards",
  "award-xrdm": "award",
  games: "games",
  history: "history",
  leaderboard: "leaderboard",
  members: "members",
  overview: "quick",
  profile: "profile",
  quick: "quick",
  rewards: "rewards",
  verify: "verify",
};

const participantTabSegments: Record<ParticipantTab, RoomTabSegment> = {
  games: "games",
  history: "history",
  quick: "overview",
  submit: "submit",
  wallet: "wallet",
};

const participantTabsBySegment: Partial<Record<string, ParticipantTab>> = {
  assignments: "submit",
  games: "games",
  history: "history",
  overview: "quick",
  quick: "quick",
  submit: "submit",
  wallet: "wallet",
};

const emptyRoomForm = {
  description: "",
  name: "",
};

const emptyTaskForm = {
  assignedToEmail: "",
  description: "",
  dueAt: "",
  gameType: "memory_match" as GameType,
  rewardXrdm: "20",
  title: "",
};

function makeEmptyProofItems(): Record<ProofType, string> {
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

function makeEmptySubmitForm(submitterName = "") {
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

function makeEmptyRewardForm() {
  return {
    awardXrdm: "0",
    description: "",
    kind: "participant_certificate" as RewardKind,
    ledgerNote: "",
    recipientIds: [] as string[],
    sourceSubmissionId: "",
    title: "",
  };
}

function buildRoomEntries(hostedRooms: HackRoom[], joinedRooms: HackRoom[]) {
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

function slugifyRoomName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getRoomRouteParam(room: Pick<HackRoom, "_id" | "inviteCode" | "name">) {
  return slugifyRoomName(room.name) || room.inviteCode || room._id;
}

function matchesRoomRouteParam(room: Pick<HackRoom, "_id" | "inviteCode" | "name">, value: string) {
  const decodedValue = decodeURIComponent(value).toLowerCase();
  return (
    room._id === value ||
    room.inviteCode.toLowerCase() === decodedValue ||
    slugifyRoomName(room.name) === decodedValue
  );
}

export function HackRoomHomePwa({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());

  const stats = dashboard.data?.stats;
  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const recentSubmissions = dashboard.data?.mySubmissions ?? [];
  const allRooms = useMemo(() => buildRoomEntries(hostedRooms, joinedRooms), [hostedRooms, joinedRooms]);
  const firstRoom = allRooms[0]?.room;

  function openRoomOrShelf(room = firstRoom, tab: RoomTabSegment = "overview") {
    if (room) {
      navigate({ to: "/hack-room/$roomId/$tab", params: { roomId: getRoomRouteParam(room), tab } });
      return;
    }
    navigate({ to: "/hack-room" });
  }

  return (
    <WebAppScreen activeNav="home">
      <section className="mb-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-[18px] py-4">
        <h1 className="text-[22px] font-extrabold leading-[30px] tracking-normal text-[#EEE8DE]">Home Hub</h1>
        <p className="mt-2 text-xs leading-[19px] text-[#9C9690]">
          Welcome back, {firstName(user.name)}. Your room activity, pending reviews, and XRDM progress live here.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="cyan">As Participant</Badge>
          <Badge tone="violet">As Organizer</Badge>
          {dashboard.isLoading ? <Badge tone="gold">Syncing</Badge> : null}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
          <Avatar name={user.name} tone="cyan" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-[#EEE8DE]">{user.name}</div>
            <div className="truncate text-xs text-[#626058]">{user.email}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="Hosted" value={stats?.activeRooms ?? hostedRooms.length} tone="violet" />
          <StatBox label="Joined" value={stats?.joinedRooms ?? joinedRooms.length} />
          <StatBox label="Reviews" value={stats?.pendingSubmissions ?? 0} tone="gold" />
        </div>
      </section>

      {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}

      <QuickActionGrid
        actions={[
          {
            icon: ClipboardList,
            label: "Assignments",
            meta: "Due and past work",
            onClick: () => openRoomOrShelf(firstRoom, "assignments"),
            tone: "cyan",
          },
          {
            icon: Bolt,
            label: "Spot Challenge",
            meta: "Live room prompts",
            onClick: () => openRoomOrShelf(firstRoom, "assignments"),
            tone: "orange",
          },
          {
            icon: Gamepad2,
            label: "Games",
            meta: "Play mini games",
            onClick: () => openRoomOrShelf(firstRoom, "games"),
            tone: "lime",
          },
          {
            icon: Wallet,
            label: "Wallet",
            meta: "XRDM, certs, NFTs",
            onClick: () => navigate({ to: "/profile" }),
            tone: "gold",
          },
        ]}
      />

      <SectionCard badge={`${allRooms.length} active`} eyebrow="Overview" title="Hack Room Snapshot">
        <div className="grid gap-2">
          {allRooms.length ? (
            allRooms.slice(0, 4).map((entry) => <RoomEntryLink entry={entry} key={entry.room._id} />)
          ) : (
            <EmptyState icon={<Home />} text="Create or join a hack room from Rooms to start seeing activity here." />
          )}
        </div>
      </SectionCard>

      <SectionCard badge={`${recentSubmissions.length} records`} eyebrow="Proof" title="Recent Submissions" tone="gold">
        <div className="grid gap-2">
          {recentSubmissions.length ? (
            recentSubmissions
              .slice(0, 2)
              .map((submission) => <SubmissionCard key={submission._id} submission={submission} />)
          ) : (
            <EmptyState icon={<CheckCircle2 />} text="Your submitted proof records will appear here after you complete a task." />
          )}
        </div>
      </SectionCard>
    </WebAppScreen>
  );
}

export function HackRoomRoomsPwa({ user: _user }: { user: SessionUser }) {
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const allRooms = useMemo(() => buildRoomEntries(hostedRooms, joinedRooms), [hostedRooms, joinedRooms]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
  };

  const createRoom = useMutation(
    trpc.hackRoom.createRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setMessage({ text: `Created ${room.name} with invite ${room.inviteCode}`, tone: "violet" });
        await invalidateDashboard();
      },
    }),
  );

  const joinRoom = useMutation(
    trpc.hackRoom.joinRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setInviteCode("");
        setMessage({ text: `Joined ${room.name}`, tone: "cyan" });
        await invalidateDashboard();
      },
    }),
  );

  async function shareInvite(room: HackRoom) {
    const text = `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`;
    if (navigator.share) {
      await navigator.share({ text, title: `${room.name} invite` });
      return;
    }
    await navigator.clipboard?.writeText(text);
    setMessage({ text: "Invite copied to clipboard", tone: "cyan" });
  }

  return (
    <WebAppScreen activeNav="rooms">
      {(dashboard.isLoading || createRoom.isPending || joinRoom.isPending) ? (
        <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-xs text-[#9C9690]">
          <Loader2 className="size-4 animate-spin text-[#F0C040]" />
          Syncing Hack Room...
        </div>
      ) : null}

      <RoomCommandCenter
        createRoomPending={createRoom.isPending}
        inviteCode={inviteCode}
        joinRoomPending={joinRoom.isPending}
        onCreateRoom={() => createRoom.mutate(roomForm)}
        onInviteCodeChange={setInviteCode}
        onJoinRoom={() => joinRoom.mutate({ inviteCode })}
        onRoomFormChange={setRoomForm}
        roomForm={roomForm}
        tone="violet"
      />

      {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}
      {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      <SectionCard badge={`${allRooms.length} active`} eyebrow="Hack Rooms" title="Room Shelf">
        <div className="grid gap-2">
          {allRooms.length ? (
            allRooms.map((entry) => (
              <RoomEntryLink entry={entry} key={entry.room._id} onShare={entry.role === "host" ? shareInvite : undefined} />
            ))
          ) : (
            <EmptyState icon={<DoorOpen />} text="Create a room as host or paste an invite code to join as participant." />
          )}
        </div>
      </SectionCard>

    </WebAppScreen>
  );
}

export function HackRoomProfilePwa({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const stats = dashboard.data?.stats;

  async function handleSignOut() {
    await authClient.signOut();
    await queryClient.invalidateQueries();
    navigate({ to: "/login" });
  }

  return (
    <WebAppScreen activeNav="profile">
      <section className="mb-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-[18px] py-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} tone="cyan" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-normal text-[#EEE8DE]">{user.name}</h1>
            <p className="truncate text-xs text-[#626058]">{user.email}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBox label="Rooms" value={(stats?.activeRooms ?? 0) + (stats?.joinedRooms ?? 0)} />
          <StatBox label="Wins" value={stats?.winners ?? 0} tone="gold" />
          <StatBox label="Network" value={stats?.participants ?? 0} tone="violet" />
        </div>
      </section>

      {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}

      <SectionCard badge="Account" eyebrow="Profile" title="Account Details">
        <ProfileField label="Name" value={user.name} />
        <ProfileField label="Email" value={user.email} />
        <ProfileField label="User ID" value={user.id} />
        <Button
          className="mt-3 h-10 w-full rounded-[10px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
          onClick={handleSignOut}
          type="button"
          variant="outline"
        >
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </SectionCard>
    </WebAppScreen>
  );
}

export default function HackRoomPwa({
  roomId,
  roomTab,
  user,
}: {
  roomId?: string;
  roomTab?: string;
  user: SessionUser;
}) {
  const navigate = useNavigate();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [hostTab, setHostTab] = useState<HostTab>("quick");
  const [participantTab, setParticipantTab] = useState<ParticipantTab>("quick");
  const [activeRoomId, setActiveRoomId] = useState("");
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("task");
  const [proofTypes, setProofTypes] = useState<ProofType[]>(defaultRegularProofTypes);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [submitForm, setSubmitForm] = useState(() => makeEmptySubmitForm(user.name));
  const [feedbackBySubmission, setFeedbackBySubmission] = useState<Record<string, string>>({});
  const [awardBySubmission, setAwardBySubmission] = useState<Record<string, string>>({});
  const [rewardForm, setRewardForm] = useState(makeEmptyRewardForm);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const tasks = dashboard.data?.tasks ?? [];
  const mySubmissions = dashboard.data?.mySubmissions ?? [];
  const hostSubmissions = dashboard.data?.hostSubmissions ?? [];
  const visibleWinners = dashboard.data?.visibleWinners ?? [];
  const rewards = dashboard.data?.rewards ?? [];
  const allRooms = useMemo(() => buildRoomEntries(hostedRooms, joinedRooms), [hostedRooms, joinedRooms]);

  const activeSelectionId = roomId ?? activeRoomId;
  const selectedRoomEntry =
    allRooms.find((entry) => matchesRoomRouteParam(entry.room, activeSelectionId)) ?? (roomId ? undefined : allRooms[0]);
  const selectedRoom = selectedRoomEntry?.room;
  const role = selectedRoomEntry?.role ?? "host";
  const selectedRoomId = selectedRoom?._id ?? "";
  const activeHostTab = roomTab ? getHostTabFromSegment(roomTab) : hostTab;
  const activeParticipantTab = roomTab ? getParticipantTabFromSegment(roomTab) : participantTab;

  const roomTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.roomId === selectedRoomId && canViewTaskForRole(task, role, user),
      ),
    [role, selectedRoomId, tasks, user.email, user.id],
  );
  const roomSubmissions = useMemo(
    () => hostSubmissions.filter((submission) => submission.roomId === selectedRoomId),
    [hostSubmissions, selectedRoomId],
  );
  const roomMySubmissions = useMemo(
    () => mySubmissions.filter((submission) => submission.roomId === selectedRoomId),
    [mySubmissions, selectedRoomId],
  );
  const roomRewards = useMemo(
    () => rewards.filter((reward) => reward.roomId === selectedRoomId),
    [rewards, selectedRoomId],
  );
  const roomWinners = useMemo(
    () => visibleWinners.filter((submission) => submission.roomId === selectedRoomId),
    [selectedRoomId, visibleWinners],
  );
  const pendingSubmissions = roomSubmissions.filter((submission) => submission.status === "submitted");
  const approvedSubmissions = roomSubmissions.filter((submission) => submission.status === "approved");
  const historySubmissions = roomSubmissions.filter((submission) =>
    ["approved", "winner", "returned"].includes(submission.status),
  );
  const winnerSubmissions = roomSubmissions.filter((submission) => submission.status === "winner");
  const selectedTask = roomTasks.find((task) => task._id === selectedTaskId);
  const selectedSubmission = selectedTask
    ? roomMySubmissions.find((submission) => submission.taskId === selectedTask._id)
    : undefined;
  const myRoomRewards = roomRewards.filter((reward) =>
    reward.recipients.some((recipient) => recipient.userId === user.id),
  );
  const leaderboard = buildLeaderboard(selectedRoom, roomSubmissions, roomRewards);

  useEffect(() => {
    if (!roomId || !selectedRoom) {
      return;
    }

    const canonicalRoomId = getRoomRouteParam(selectedRoom);
    if (roomId === canonicalRoomId) {
      return;
    }

    navigate({
      params: { roomId: canonicalRoomId, tab: roomTab ?? "overview" },
      replace: true,
      to: "/hack-room/$roomId/$tab",
    });
  }, [navigate, roomId, roomTab, selectedRoom]);

  useEffect(() => {
    if (roomId) {
      return;
    }

    if (!allRooms.length) {
      if (activeRoomId) {
        setActiveRoomId("");
      }
      return;
    }

    if (!activeRoomId || !allRooms.some((entry) => entry.room._id === activeRoomId)) {
      setActiveRoomId(allRooms[0].room._id);
    }
  }, [activeRoomId, allRooms]);

  useEffect(() => {
    if (!selectedTaskId || !roomTasks.some((task) => task._id === selectedTaskId)) {
      setSelectedTaskId(roomTasks[0]?._id ?? "");
    }
  }, [roomTasks, selectedTaskId]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
  };

  const createRoom = useMutation(
    trpc.hackRoom.createRoom.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setActiveRoomId(room._id);
        showMessage(`Created ${room.name} with invite ${room.inviteCode}`, "violet");
        await invalidateDashboard();
      },
    }),
  );

  const joinRoom = useMutation(
    trpc.hackRoom.joinRoom.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async (room) => {
        setInviteCode("");
        setActiveRoomId(room._id);
        showMessage(`Joined ${room.name}`, "cyan");
        await invalidateDashboard();
      },
    }),
  );

  const createTask = useMutation(
    trpc.hackRoom.createTask.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        setTaskForm(emptyTaskForm);
        setAssignmentMode("task");
        setProofTypes(defaultRegularProofTypes);
        showMessage("Room assignment published", "violet");
        await invalidateDashboard();
      },
    }),
  );

  const sendRoomNotification = useMutation(
    trpc.hackRoom.sendRoomNotification.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        setTaskForm(emptyTaskForm);
        setAssignmentMode("task");
        showMessage("Notification sent to room participants", "violet");
        await invalidateDashboard();
      },
    }),
  );

  const submitProof = useMutation(
    trpc.hackRoom.submitProof.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        setSubmitForm(makeEmptySubmitForm(user.name));
        showMessage("Proof submitted for host review", "cyan");
        await invalidateDashboard();
      },
    }),
  );

  const approveSubmission = useMutation(
    trpc.hackRoom.approveSubmission.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        showMessage("Proof verified and added to room history", "cyan");
        await invalidateDashboard();
      },
    }),
  );

  const returnSubmission = useMutation(
    trpc.hackRoom.returnSubmission.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        showMessage("Submission returned with feedback", "orange");
        await invalidateDashboard();
      },
    }),
  );

  const selectWinner = useMutation(
    trpc.hackRoom.selectWinner.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        showMessage("Winner announced and XRDM recorded", "gold");
        await invalidateDashboard();
      },
    }),
  );

  const issueReward = useMutation(
    trpc.hackRoom.issueReward.mutationOptions({
      onError: (error) => showMessage(error.message, "red"),
      onSuccess: async () => {
        setRewardForm(makeEmptyRewardForm());
        showMessage("Reward issued to the in-app ledger", "gold");
        await invalidateDashboard();
      },
    }),
  );

  const isBusy =
    dashboard.isLoading ||
    createRoom.isPending ||
    joinRoom.isPending ||
    createTask.isPending ||
    sendRoomNotification.isPending ||
    submitProof.isPending ||
    approveSubmission.isPending ||
    returnSubmission.isPending ||
    selectWinner.isPending ||
    issueReward.isPending;

  function showMessage(text: string, tone: Tone) {
    const friendlyText = friendlyMutationMessage(text);
    setMessage({ text: friendlyText, tone });
    if (tone === "red") {
      toast.error(friendlyText);
    } else {
      toast.success(friendlyText);
    }
  }

  function handleAssignmentModeChange(nextMode: AssignmentMode) {
    setAssignmentMode(nextMode);
    if (nextMode === "task") {
      setProofTypes(defaultRegularProofTypes);
      setTaskForm((current) => ({ ...current, rewardXrdm: current.rewardXrdm || "20" }));
    } else if (nextMode === "challenge") {
      setProofTypes(defaultSpotProofTypes);
      setTaskForm((current) => ({ ...current, rewardXrdm: current.rewardXrdm || "20" }));
    } else if (nextMode === "game") {
      setProofTypes(defaultGameProofTypes);
      setTaskForm((current) => ({ ...current, rewardXrdm: current.rewardXrdm || "20" }));
    } else if (nextMode === "special") {
      setProofTypes(defaultSpecialProofTypes);
      setTaskForm((current) => ({ ...current, rewardXrdm: current.rewardXrdm || "20" }));
    }
  }

  function handleCreateTask() {
    if (!selectedRoom) {
      showMessage("Create or select a room first", "red");
      return;
    }
    if (role !== "host") {
      showMessage("Only the host can publish inside this room", "red");
      return;
    }

    const title = taskForm.title.trim();
    const description = taskForm.description.trim();

    if (title.length < 3) {
      showMessage("Add a title with at least 3 characters", "red");
      return;
    }

    if (assignmentMode === "notification") {
      if (description.length < minNotificationMessageLength) {
        showMessage("Add a message with at least 3 characters", "red");
        return;
      }

      sendRoomNotification.mutate({
        message: description,
        roomId: selectedRoom._id,
        title,
      });
      return;
    }

    if (description.length < minAssignmentDescriptionLength) {
      showMessage(`Add a description with at least ${minAssignmentDescriptionLength} characters`, "red");
      return;
    }

    if (!taskForm.dueAt.trim()) {
      showMessage("Choose a due date and time", "red");
      return;
    }

    if (assignmentMode === "special" && !taskForm.assignedToEmail.trim()) {
      showMessage("Enter the participant email for this special task", "red");
      return;
    }

    createTask.mutate({
      assignedToEmail: assignmentMode === "special" ? taskForm.assignedToEmail.trim() : undefined,
      description,
      dueAt: taskForm.dueAt,
      gameType: assignmentMode === "game" ? taskForm.gameType : undefined,
      kind: assignmentMode,
      proofTypes: normalizeTaskProofTypes(assignmentMode, proofTypes),
      rewardXrdm: Number(taskForm.rewardXrdm || 0),
      roomId: selectedRoom._id,
      title,
    });
  }

  function handleSubmitProof() {
    if (!selectedTask) {
      showMessage("Choose an assignment before submitting proof", "red");
      return;
    }

    const submitterName = submitForm.submitterName.trim();
    const teamName = submitForm.teamName.trim();
    const submissionDescription = submitForm.description.trim();
    const rawTeamMateEmails = [
      ...submitForm.teamMateEmails,
      ...getEmailTokens(submitForm.teamMateEmailDraft),
    ];
    const invalidTeamMateEmails = rawTeamMateEmails.filter((email) => !isEmailLike(email));
    const teamMateEmails = normalizeEmails(rawTeamMateEmails);
    const proofItems = buildProofItemsForTask(selectedTask, submitForm);
    const missingProofTypes = proofItems
      .filter((item) => !item.value.trim())
      .map((item) => proofTypeLabel(item.type));

    if (!submitterName || !teamName || !submissionDescription) {
      showMessage("Add your name, team name, and submission description", "red");
      return;
    }

    if (invalidTeamMateEmails.length) {
      showMessage(`Check team mate email: ${invalidTeamMateEmails[0]}`, "red");
      return;
    }

    if (missingProofTypes.length) {
      showMessage(`Add required proof: ${missingProofTypes.join(", ")}`, "red");
      return;
    }

    submitProof.mutate({
      notes: submitForm.notes,
      proofItems,
      proofUrl: proofItems[0]?.value ?? "",
      roomId: selectedTask.roomId,
      submissionDescription,
      submitterName,
      taskId: selectedTask._id,
      teamMateEmails,
      teamName,
    });
  }

  function handleApproveSubmission(submission: HackSubmission) {
    approveSubmission.mutate({
      hostFeedback:
        feedbackBySubmission[submission._id] ||
        submission.hostFeedback ||
        "Verified. Clear proof and solid contribution.",
      submissionId: submission._id,
    });
  }

  function handleReturnSubmission(submission: HackSubmission) {
    returnSubmission.mutate({
      hostFeedback:
        feedbackBySubmission[submission._id] ||
        submission.hostFeedback ||
        "Thanks for the submission. Please add clearer proof and resubmit.",
      submissionId: submission._id,
    });
  }

  function handleSelectWinner(submission: HackSubmission) {
    selectWinner.mutate({
      awardXrdm: Number(awardBySubmission[submission._id] || submission.awardXrdm || submission.rewardXrdm || 20),
      hostFeedback:
        feedbackBySubmission[submission._id] ||
        submission.hostFeedback ||
        "Strong contribution and clear proof of participation.",
      submissionId: submission._id,
    });
  }

  function handleIssueReward(kind: RewardKind) {
    if (!selectedRoom) {
      showMessage("Create or select a room first", "red");
      return;
    }
    if (role !== "host") {
      showMessage("Only the host can issue room rewards", "red");
      return;
    }

    issueReward.mutate({
      awardXrdm: Number(rewardForm.awardXrdm || 0),
      description: rewardForm.description,
      kind,
      ledgerNote: rewardForm.ledgerNote,
      recipientIds: kind === "participant_certificate" ? rewardForm.recipientIds : [],
      roomId: selectedRoom._id,
      sourceSubmissionId:
        kind === "participant_certificate"
          ? undefined
          : rewardForm.sourceSubmissionId || winnerSubmissions[0]?._id,
      title: rewardForm.title || rewardKindLabel(kind),
    });
  }

  async function copyInviteCode(room: HackRoom) {
    await navigator.clipboard?.writeText(room.inviteCode);
    showMessage(`Copied ${room.inviteCode}`, "cyan");
  }

  async function shareInvite(room: HackRoom) {
    const message = `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`;
    if (navigator.share) {
      await navigator.share({ text: message, title: `${room.name} invite` });
      return;
    }
    await navigator.clipboard?.writeText(message);
    showMessage("Invite copied to clipboard", "cyan");
  }

  async function handleSignOut() {
    await authClient.signOut();
    await queryClient.invalidateQueries();
    window.location.assign("/login");
  }

  function selectHostTab(tab: HostTab) {
    if (roomId) {
      navigate({
        to: "/hack-room/$roomId/$tab",
        params: { roomId: selectedRoom ? getRoomRouteParam(selectedRoom) : roomId, tab: hostTabSegments[tab] },
      });
      return;
    }

    setHostTab(tab);
  }

  function selectParticipantTab(tab: ParticipantTab) {
    if (roomId) {
      navigate({
        to: "/hack-room/$roomId/$tab",
        params: { roomId: selectedRoom ? getRoomRouteParam(selectedRoom) : roomId, tab: participantTabSegments[tab] },
      });
      return;
    }

    setParticipantTab(tab);
  }

  return (
    <WebAppScreen activeNav="rooms">
        {roomId ? (
          <button
            className="mb-3 flex items-center gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-left"
            onClick={() => navigate({ to: "/hack-room" })}
            type="button"
          >
            <ArrowLeft className="size-4 text-[#9C9690]" />
            <span className="text-sm font-medium text-[#EEE8DE]">Hack Rooms</span>
          </button>
        ) : (
          <RoomSwitcher
            activeRoomId={activeRoomId}
            allRooms={allRooms}
            onRoomChange={setActiveRoomId}
          />
        )}

        <RoomHero
          role={role}
          room={selectedRoom}
          stats={{
            participants: selectedRoom?.participants.length ?? 0,
            tasks: roomTasks.length,
            winners: roomWinners.length,
          }}
        />

        {isBusy ? (
          <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-xs text-[#9C9690]">
            <Loader2 className="size-4 animate-spin text-[#F0C040]" />
            Syncing Hack Room...
          </div>
        ) : null}

        {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

        {roomId && !selectedRoom && !dashboard.isLoading ? (
          <SectionCard eyebrow="Room" title="Room Not Found" tone="red">
            <EmptyState
              icon={<DoorOpen />}
              text="This room is not available for your account. Go back and choose one of your rooms."
            />
            <Button
              className="mt-3 h-10 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
              onClick={() => navigate({ to: "/hack-room" })}
              type="button"
            >
              <ArrowLeft className="size-4" />
              Back to Hack Rooms
            </Button>
          </SectionCard>
        ) : role === "host" ? (
          <HostSurface
            activeTab={activeHostTab}
            approvedSubmissions={approvedSubmissions}
            assignmentMode={assignmentMode}
            createRoomPending={createRoom.isPending}
            createTaskPending={createTask.isPending}
            feedbackBySubmission={feedbackBySubmission}
            hostSubmissions={roomSubmissions}
            hostedRooms={hostedRooms}
            inviteCode={inviteCode}
            issueRewardPending={issueReward.isPending}
            joinRoomPending={joinRoom.isPending}
            leaderboard={leaderboard}
            onApproveSubmission={handleApproveSubmission}
            onAssignmentModeChange={handleAssignmentModeChange}
            onAwardChange={(submissionId, value) =>
              setAwardBySubmission((current) => ({ ...current, [submissionId]: value }))
            }
            onCopyInvite={copyInviteCode}
            onCreateRoom={() => createRoom.mutate(roomForm)}
            onCreateTask={handleCreateTask}
            onFeedbackChange={(submissionId, value) =>
              setFeedbackBySubmission((current) => ({ ...current, [submissionId]: value }))
            }
            onInviteCodeChange={setInviteCode}
            onIssueReward={handleIssueReward}
            onJoinRoom={() => joinRoom.mutate({ inviteCode })}
            onReturnSubmission={handleReturnSubmission}
            onRewardFormChange={setRewardForm}
            onRoomFormChange={setRoomForm}
            onSelectTab={selectHostTab}
            onSelectWinner={handleSelectWinner}
            onShareInvite={shareInvite}
            onSignOut={handleSignOut}
            pendingSubmissions={pendingSubmissions}
            proofTypes={proofTypes}
            rewardForm={rewardForm}
            rewards={roomRewards}
            room={selectedRoom}
            roomForm={roomForm}
            sendNotificationPending={sendRoomNotification.isPending}
            setProofTypes={setProofTypes}
            setTaskForm={setTaskForm}
            showRoomSetup={!roomId}
            taskForm={taskForm}
            tasks={roomTasks}
            user={user}
            winnerSubmissions={winnerSubmissions}
            historySubmissions={historySubmissions}
          />
        ) : (
          <ParticipantSurface
            activeTab={activeParticipantTab}
            inviteCode={inviteCode}
            joinRoomPending={joinRoom.isPending}
            joinedRooms={joinedRooms}
            myRewards={myRoomRewards}
            mySubmissions={roomMySubmissions}
            onInviteCodeChange={setInviteCode}
            onJoinRoom={() => joinRoom.mutate({ inviteCode })}
            onSelectTab={selectParticipantTab}
            onSelectTask={setSelectedTaskId}
            onSubmitFormChange={setSubmitForm}
            onSubmitProof={handleSubmitProof}
            room={selectedRoom}
            selectedSubmission={selectedSubmission}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            showJoinTrack={!roomId}
            submitForm={submitForm}
            submitProofPending={submitProof.isPending}
            tasks={roomTasks}
            user={user}
          />
        )}
    </WebAppScreen>
  );
}

function WebAppScreen({
  activeNav,
  children,
}: {
  activeNav: "home" | "profile" | "rooms";
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full overflow-auto bg-[#0A0C0F] pb-24 text-[#EEE8DE]">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-5 pt-3 sm:px-0">{children}</div>
      <AppBottomNav active={activeNav} />
    </main>
  );
}

function AppBottomNav({ active }: { active: "home" | "profile" | "rooms" }) {
  const navigate = useNavigate();

  return (
    <BottomNav
      active={active}
      onHome={() => navigate({ to: "/dashboard" })}
      onProfile={() => navigate({ to: "/profile" })}
      onRooms={() => navigate({ to: "/hack-room" })}
    />
  );
}

function RoomEntryLink({
  entry,
  onShare,
}: {
  entry: RoomEntry;
  onShare?: (room: HackRoom) => void;
}) {
  return (
    <div className="flex items-stretch gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <Link
        className="flex min-w-0 flex-1 items-start gap-3"
        params={{ roomId: getRoomRouteParam(entry.room), tab: "overview" }}
        to="/hack-room/$roomId/$tab"
      >
        <Avatar name={entry.room.name} tone={entry.role === "host" ? "violet" : "cyan"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[#EEE8DE]">{entry.room.name}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#9C9690]">
                {entry.room.description || `Hosted by ${entry.room.hostName}`}
              </p>
            </div>
            <Badge tone={entry.role === "host" ? "violet" : "cyan"}>
              {entry.role === "host" ? "Host" : "Participant"}
            </Badge>
          </div>
          <div className="mt-1 font-mono text-[10px] text-[#626058]">
            {entry.room.participants.length} participants - {entry.room.inviteCode}
          </div>
        </div>
      </Link>
      {onShare ? (
        <IconButton label="Share invite" onClick={() => onShare(entry.room)}>
          <Copy className="size-4" />
        </IconButton>
      ) : null}
    </div>
  );
}

function RoomSwitcher({
  activeRoomId,
  allRooms,
  onRoomChange,
}: {
  activeRoomId: string;
  allRooms: RoomEntry[];
  onRoomChange: (roomId: string) => void;
}) {
  if (!allRooms.length) {
    return null;
  }

  const activeEntry = allRooms.find((entry) => entry.room._id === activeRoomId) ?? allRooms[0];
  const tone = activeEntry.role === "host" ? "violet" : "cyan";
  const colors =
    activeEntry.role === "host"
      ? "border-[#4A1A90] text-[#CECBF6]"
      : "border-[#1EEAB0] text-[#1EEAB0]";

  return (
    <label className="mb-3 grid gap-2 rounded-[12px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#626058]">
          Active Room
        </span>
        <Badge tone={tone}>{activeEntry.role === "host" ? "Host View" : "Participant View"}</Badge>
      </span>
      <select
        className={`h-10 rounded-[9px] border bg-[#141618] px-2 text-xs font-medium outline-none ${colors}`}
        onChange={(event) => onRoomChange(event.target.value)}
        value={activeEntry.room._id}
      >
        {allRooms.map((entry) => (
          <option key={entry.room._id} value={entry.room._id}>
            {entry.role === "host" ? "Host" : "Participant"} - {entry.room.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoomHero({
  role,
  room,
  stats,
}: {
  role: Role;
  room?: HackRoom;
  stats: { participants: number; tasks: number; winners: number };
}) {
  return (
    <section className="mb-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-[18px] py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#626058]">
            Inside Hack Room
          </div>
          <h1 className="text-lg font-extrabold tracking-normal text-[#EEE8DE]">
            {room?.name ?? "Create or join a room"}
          </h1>
          <p className="mt-1 text-xs leading-5 text-[#626058]">
            {room?.description ||
              "Hosts create invite rooms, participants submit proof, and winners receive XRDM records."}
          </p>
        </div>
        <Badge tone={role === "host" ? "violet" : "cyan"}>{role}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Participants" value={stats.participants} />
        <StatBox label="Tasks" value={stats.tasks} />
        <StatBox label="Winners" value={stats.winners} />
      </div>
    </section>
  );
}

function HostSurface({
  activeTab,
  approvedSubmissions,
  assignmentMode,
  createRoomPending,
  createTaskPending,
  feedbackBySubmission,
  historySubmissions,
  hostedRooms,
  inviteCode,
  issueRewardPending,
  joinRoomPending,
  leaderboard,
  onApproveSubmission,
  onAssignmentModeChange,
  onAwardChange,
  onCopyInvite,
  onCreateRoom,
  onCreateTask,
  onFeedbackChange,
  onInviteCodeChange,
  onIssueReward,
  onJoinRoom,
  onReturnSubmission,
  onRewardFormChange,
  onRoomFormChange,
  onSelectTab,
  onSelectWinner,
  onShareInvite,
  onSignOut,
  pendingSubmissions,
  proofTypes,
  rewardForm,
  rewards,
  room,
  roomForm,
  sendNotificationPending,
  setProofTypes,
  setTaskForm,
  showRoomSetup = true,
  taskForm,
  tasks,
  user,
  winnerSubmissions,
  hostSubmissions,
}: {
  activeTab: HostTab;
  approvedSubmissions: HackSubmission[];
  assignmentMode: AssignmentMode;
  createRoomPending: boolean;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  historySubmissions: HackSubmission[];
  hostedRooms: HackRoom[];
  inviteCode: string;
  issueRewardPending: boolean;
  joinRoomPending: boolean;
  leaderboard: Array<{ email: string; name: string; points: number; wins: number }>;
  onApproveSubmission: (submission: HackSubmission) => void;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  onAwardChange: (submissionId: string, value: string) => void;
  onCopyInvite: (room: HackRoom) => void;
  onCreateRoom: () => void;
  onCreateTask: () => void;
  onFeedbackChange: (submissionId: string, value: string) => void;
  onInviteCodeChange: (value: string) => void;
  onIssueReward: (kind: RewardKind) => void;
  onJoinRoom: () => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRewardFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  onSelectTab: (tab: HostTab) => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareInvite: (room: HackRoom) => void;
  onSignOut: () => void;
  pendingSubmissions: HackSubmission[];
  proofTypes: ProofType[];
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: HackReward[];
  room?: HackRoom;
  roomForm: typeof emptyRoomForm;
  sendNotificationPending: boolean;
  setProofTypes: React.Dispatch<React.SetStateAction<ProofType[]>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  showRoomSetup?: boolean;
  taskForm: typeof emptyTaskForm;
  tasks: HackTask[];
  user: SessionUser;
  winnerSubmissions: HackSubmission[];
  hostSubmissions: HackSubmission[];
}) {
  return (
    <section>
      <Tabs activeTab={activeTab} onSelect={onSelectTab} tabs={hostTabs} />

      {activeTab === "quick" && showRoomSetup ? (
        <div className="mt-3 grid gap-3">
          <RoomCommandCenter
            createRoomPending={createRoomPending}
            inviteCode={inviteCode}
            joinRoomPending={joinRoomPending}
            onCreateRoom={onCreateRoom}
            onInviteCodeChange={onInviteCodeChange}
            onJoinRoom={onJoinRoom}
            onRoomFormChange={onRoomFormChange}
            roomForm={roomForm}
            tone="violet"
          />
          <SectionCard eyebrow="Host Rooms" title="Your Room Shelf" badge={`${hostedRooms.length} hosted`}>
            <div className="grid gap-2">
              {hostedRooms.length ? (
                hostedRooms.map((hostedRoom) => (
                  <RoomRow key={hostedRoom._id} room={hostedRoom} role="host" />
                ))
              ) : (
                <EmptyState icon={<DoorOpen />} text="Create a hack room to unlock host actions." />
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "assign" ? (
        <ActionScreen title="Assignments" onBack={() => onSelectTab("quick")}>
          <AssignmentComposer
            assignmentMode={assignmentMode}
            createTaskPending={createTaskPending}
            onAssignmentModeChange={onAssignmentModeChange}
            onCreateTask={onCreateTask}
            proofTypes={proofTypes}
            room={room}
            sendNotificationPending={sendNotificationPending}
            setProofTypes={setProofTypes}
            setTaskForm={setTaskForm}
            taskForm={taskForm}
          />
          <CreatedTasks tasks={tasks} />
        </ActionScreen>
      ) : null}

      {activeTab === "members" ? (
        <ActionScreen title="Members" onBack={() => onSelectTab("quick")}>
          <SectionCard badge={`${room?.participants.length ?? 0} joined`} eyebrow="Host Menu" title="Participants">
            {room ? (
              <>
                <div className="mb-3 flex items-center justify-between rounded-[9px] border border-[#1EEAB0] bg-[#0D0F12] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2 font-mono text-sm font-semibold text-[#1EEAB0]">
                    <KeyRound className="size-4 shrink-0" />
                    <span className="truncate">{room.inviteCode}</span>
                  </div>
                  <div className="flex gap-2">
                    <IconButton label="Copy invite" onClick={() => onCopyInvite(room)}>
                      <Copy className="size-4" />
                    </IconButton>
                    <Button
                      className="h-8 rounded-[8px] border-[#1EEAB0] bg-[#061F18] text-[11px] text-[#1EEAB0] hover:bg-[#061F18]/80"
                      onClick={() => onShareInvite(room)}
                      type="button"
                      variant="outline"
                    >
                      Share Invite
                    </Button>
                  </div>
                </div>
                <MemberList room={room} />
              </>
            ) : (
              <EmptyState icon={<Users />} text="Create or select a hosted room first." />
            )}
          </SectionCard>
        </ActionScreen>
      ) : null}

      {activeTab === "verify" ? (
        <ActionScreen title="Verify" onBack={() => onSelectTab("quick")}>
          <ReviewQueue
            feedbackBySubmission={feedbackBySubmission}
            onApproveSubmission={onApproveSubmission}
            onFeedbackChange={onFeedbackChange}
            onReturnSubmission={onReturnSubmission}
            pendingSubmissions={pendingSubmissions}
          />
        </ActionScreen>
      ) : null}

      {activeTab === "history" ? (
        <ActionScreen title="History" onBack={() => onSelectTab("quick")}>
          <SubmissionList
            emptyText="Verified, returned, and winner records will appear here after review."
            submissions={historySubmissions}
            title="Verified Proof"
            tone="gold"
          />
        </ActionScreen>
      ) : null}

      {activeTab === "award" ? (
        <ActionScreen title="Award XRDM" onBack={() => onSelectTab("quick")}>
          <AwardPanel
            approvedSubmissions={approvedSubmissions}
            awardBySubmission={{}}
            feedbackBySubmission={feedbackBySubmission}
            hostSubmissions={hostSubmissions}
            onAwardChange={onAwardChange}
            onFeedbackChange={onFeedbackChange}
            onSelectWinner={onSelectWinner}
          />
        </ActionScreen>
      ) : null}

      {activeTab === "rewards" ? (
        <ActionScreen title="Awards" onBack={() => onSelectTab("quick")}>
          <RewardsPanel
            issueRewardPending={issueRewardPending}
            onIssueReward={onIssueReward}
            onRewardFormChange={onRewardFormChange}
            rewardForm={rewardForm}
            rewards={rewards}
            room={room}
            winnerSubmissions={winnerSubmissions}
          />
        </ActionScreen>
      ) : null}

      {activeTab === "games" ? (
        <ActionScreen title="Games" onBack={() => onSelectTab("quick")}>
          <AssignmentComposer
            assignmentMode={assignmentMode === "game" || assignmentMode === "challenge" ? assignmentMode : "challenge"}
            createTaskPending={createTaskPending}
            onAssignmentModeChange={onAssignmentModeChange}
            onCreateTask={onCreateTask}
            proofTypes={proofTypes}
            room={room}
            sendNotificationPending={sendNotificationPending}
            setProofTypes={setProofTypes}
            setTaskForm={setTaskForm}
            taskForm={taskForm}
          />
          <MiniGameArena onUseResult={() => undefined} />
        </ActionScreen>
      ) : null}

      {activeTab === "leaderboard" ? (
        <ActionScreen title="Leaderboard" onBack={() => onSelectTab("quick")}>
          <LeaderboardPanel leaderboard={leaderboard} />
        </ActionScreen>
      ) : null}

      {activeTab === "profile" ? (
        <ActionScreen title="Profile" onBack={() => onSelectTab("quick")}>
          <RoomProfile
            onShareInvite={onShareInvite}
            onSignOut={onSignOut}
            room={room}
            user={user}
          />
        </ActionScreen>
      ) : null}
    </section>
  );
}

function ParticipantSurface({
  activeTab,
  inviteCode,
  joinRoomPending,
  joinedRooms,
  myRewards,
  mySubmissions,
  onInviteCodeChange,
  onJoinRoom,
  onSelectTab,
  onSelectTask,
  onSubmitFormChange,
  onSubmitProof,
  room,
  selectedSubmission,
  selectedTask,
  selectedTaskId,
  showJoinTrack = true,
  submitForm,
  submitProofPending,
  tasks,
  user,
}: {
  activeTab: ParticipantTab;
  inviteCode: string;
  joinRoomPending: boolean;
  joinedRooms: HackRoom[];
  myRewards: HackReward[];
  mySubmissions: DashboardData["mySubmissions"];
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onSelectTab: (tab: ParticipantTab) => void;
  onSelectTask: (taskId: string) => void;
  onSubmitFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  onSubmitProof: () => void;
  room?: HackRoom;
  selectedSubmission?: DashboardData["mySubmissions"][number];
  selectedTask?: HackTask;
  selectedTaskId: string;
  showJoinTrack?: boolean;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
  submitProofPending: boolean;
  tasks: HackTask[];
  user: SessionUser;
}) {
  const submitTasks = tasks.filter(isParticipantSubmitTask);
  const submitSelectedTask =
    selectedTask && isParticipantSubmitTask(selectedTask) ? selectedTask : undefined;
  const submitSelectedSubmission = submitSelectedTask ? selectedSubmission : undefined;

  return (
    <section>
      <Tabs activeTab={activeTab} onSelect={onSelectTab} tabs={participantTabs} />

      {activeTab === "quick" && showJoinTrack ? (
        <div className="grid gap-3">
          <SectionCard eyebrow="Participant Track" title="Join a Hack Room" badge={`${joinedRooms.length} joined`}>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                onJoinRoom();
              }}
            >
              <Field label="Invite Code">
                <Input
                  className="h-10 rounded-[9px] border-[#1EEAB0] bg-[#0D0F12] font-mono text-sm uppercase text-[#1EEAB0]"
                  onChange={(event) => onInviteCodeChange(event.target.value)}
                  placeholder="HR-ABC123"
                  value={inviteCode}
                />
              </Field>
              <Button
                className="h-10 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
                disabled={!inviteCode.trim() || joinRoomPending}
                type="submit"
              >
                <DoorOpen className="size-4" />
                Join Room
              </Button>
            </form>
            <div className="mt-3 grid gap-2">
              {joinedRooms.length ? (
                joinedRooms.map((joinedRoom) => (
                  <RoomRow key={joinedRoom._id} room={joinedRoom} role="participant" />
                ))
              ) : (
                <EmptyState icon={<KeyRound />} text="Paste the invite code from your organizer." />
              )}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "submit" ? (
        <ActionScreen title="Submit Task" onBack={() => onSelectTab("quick")}>
          <ParticipantSubmitPanel
            mySubmissions={mySubmissions}
            onSelectTask={onSelectTask}
            onSubmitFormChange={onSubmitFormChange}
            onSubmitProof={onSubmitProof}
            selectedSubmission={submitSelectedSubmission}
            selectedTask={submitSelectedTask}
            selectedTaskId={selectedTaskId}
            submitForm={submitForm}
            submitProofPending={submitProofPending}
            tasks={submitTasks}
            user={user}
          />
        </ActionScreen>
      ) : null}

      {activeTab === "history" ? (
        <ActionScreen title="History" onBack={() => onSelectTab("quick")}>
          <ParticipantHistoryPanel mySubmissions={mySubmissions} tasks={tasks} />
        </ActionScreen>
      ) : null}

      {activeTab === "games" ? (
        <ActionScreen title="Games" onBack={() => onSelectTab("quick")}>
          <ParticipantGamesPanel
            mySubmissions={mySubmissions}
            onSelectTask={onSelectTask}
            onSubmitFormChange={onSubmitFormChange}
            onSubmitProof={onSubmitProof}
            selectedSubmission={selectedSubmission}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            submitForm={submitForm}
            submitProofPending={submitProofPending}
            tasks={tasks}
          />
        </ActionScreen>
      ) : null}

      {activeTab === "wallet" ? (
        <ActionScreen title="Wallet" onBack={() => onSelectTab("quick")}>
          <WalletPanel myRewards={myRewards} mySubmissions={mySubmissions} room={room} />
        </ActionScreen>
      ) : null}
    </section>
  );
}

function RoomCommandCenter({
  createRoomPending,
  inviteCode,
  joinRoomPending,
  onCreateRoom,
  onInviteCodeChange,
  onJoinRoom,
  onRoomFormChange,
  roomForm,
  tone: _tone,
}: {
  createRoomPending: boolean;
  inviteCode: string;
  joinRoomPending: boolean;
  onCreateRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  roomForm: typeof emptyRoomForm;
  tone: "cyan" | "violet";
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <SectionCard badge="Invite Only" eyebrow="Lobby" title="Join Hack Room">
      <div className="grid gap-3">
        <form
          className="grid gap-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onJoinRoom();
          }}
        >
          <Field label="Invite Code">
            <Input
              className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#141618] font-mono text-sm uppercase text-[#EEE8DE] placeholder:text-[#626058] focus-visible:border-[#1EEAB0]"
              onChange={(event) => onInviteCodeChange(event.target.value)}
              placeholder="HR-ABC123"
              value={inviteCode}
            />
          </Field>
          <Button
            className="h-10 self-end rounded-[9px] bg-[#1EEAB0] px-4 text-[#03120C] hover:bg-[#1EEAB0]/85"
            disabled={!inviteCode.trim() || joinRoomPending}
            type="submit"
          >
            <DoorOpen className="size-4" />
            Join
          </Button>
        </form>

        <button
          className="flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#4A1A90] bg-[#160A2A] px-3 text-xs font-extrabold text-[#A060FF] transition hover:bg-[#160A2A]/80"
          onClick={() => setCreateOpen((open) => !open)}
          type="button"
        >
          <Plus className="size-4" />
          {createOpen ? "Hide Create Room" : "Create Hack Room"}
        </button>

        {createOpen ? (
          <form
            className="grid gap-3 rounded-[11px] border border-[#4A1A90] bg-[#160A2A] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              onCreateRoom();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#A060FF]">
                  Host
                </div>
                <div className="mt-0.5 text-sm font-bold text-[#EEE8DE]">Create Hack Room</div>
              </div>
              <Badge tone="violet">Host Owns Room</Badge>
            </div>

            <Field label="Room Name">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-sm text-[#EEE8DE] placeholder:text-[#626058] focus-visible:border-[#A060FF]"
                onChange={(event) => onRoomFormChange((current) => ({ ...current, name: event.target.value }))}
                placeholder="AI Agents Sprint"
                value={roomForm.name}
              />
            </Field>
            <Field label="Room Brief">
              <TextArea
                onChange={(value) => onRoomFormChange((current) => ({ ...current, description: value }))}
                placeholder="Participants build and submit working demos by deadline."
                value={roomForm.description}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="h-10 rounded-[9px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
                onClick={() => setCreateOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="h-10 rounded-[9px] bg-[#A060FF] text-[#060214] hover:bg-[#A060FF]/85"
                disabled={!roomForm.name.trim() || createRoomPending}
                type="submit"
              >
                <Plus className="size-4" />
                Create Room
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </SectionCard>
  );
}

function AssignmentComposer({
  assignmentMode,
  createTaskPending,
  onAssignmentModeChange,
  onCreateTask,
  proofTypes,
  room,
  sendNotificationPending,
  setProofTypes,
  setTaskForm,
  taskForm,
}: {
  assignmentMode: AssignmentMode;
  createTaskPending: boolean;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  onCreateTask: () => void;
  proofTypes: ProofType[];
  room?: HackRoom;
  sendNotificationPending: boolean;
  setProofTypes: React.Dispatch<React.SetStateAction<ProofType[]>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  taskForm: typeof emptyTaskForm;
}) {
  const isNotification = assignmentMode === "notification";
  const isSpecial = assignmentMode === "special";
  const isGame = assignmentMode === "game";
  const effectiveProofTypes = isNotification ? [] : normalizeTaskProofTypes(assignmentMode, proofTypes);
  const descriptionLength = taskForm.description.trim().length;
  const minimumDescriptionLength = isNotification
    ? minNotificationMessageLength
    : minAssignmentDescriptionLength;
  const canSubmit =
    room &&
    taskForm.title.trim().length >= 3 &&
    descriptionLength >= minimumDescriptionLength &&
    (isNotification || taskForm.dueAt.trim()) &&
    (!isSpecial || taskForm.assignedToEmail.trim()) &&
    !createTaskPending &&
    !sendNotificationPending;

  return (
    <SectionCard
      badge={isSpecial ? "One participant" : isNotification ? "Room nudge" : "All Participants"}
      eyebrow="Organizer Track"
      title={isNotification ? "Send Notification" : "Create Assignment"}
    >
      <div className="mb-3 grid grid-cols-2 gap-[7px]">
        <TaskKindButton
          active={assignmentMode === "task"}
          icon={<ClipboardList className="size-4" />}
          label="Regular Task"
          onClick={() => onAssignmentModeChange("task")}
          tone="cyan"
        />
        <TaskKindButton
          active={assignmentMode === "challenge"}
          icon={<Bolt className="size-4" />}
          label="Spot Challenge"
          onClick={() => onAssignmentModeChange("challenge")}
          tone="cyan"
        />
        <TaskKindButton
          active={assignmentMode === "special"}
          icon={<Star className="size-4" />}
          label="Special Task"
          onClick={() => onAssignmentModeChange("special")}
          tone="orange"
        />
        <TaskKindButton
          active={assignmentMode === "notification"}
          icon={<Bell className="size-4" />}
          label="Notification"
          onClick={() => onAssignmentModeChange("notification")}
          tone="violet"
        />
      </div>

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateTask();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isNotification ? "Notification Title" : isGame ? "Game Name" : "Assignment Title"}>
            <Input
              className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-sm text-[#CCC6BA]"
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={isNotification ? "Demo check-in" : "Build a working prototype"}
              value={taskForm.title}
            />
          </Field>
          {!isNotification ? (
            <Field label="Due Date and Time">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-sm text-[#CCC6BA]"
                onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))}
                type="datetime-local"
                value={taskForm.dueAt}
              />
            </Field>
          ) : (
            <Field label="Audience">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-sm text-[#626058]"
                disabled
                value={`${room?.participants.length ?? 0} participants`}
              />
            </Field>
          )}
        </div>

        {isSpecial ? (
          <Field label="Participant Email">
            <Input
              className="h-10 rounded-[9px] border-[#FF8820] bg-[#241000] text-sm text-[#FF8820]"
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, assignedToEmail: event.target.value }))
              }
              placeholder="student@example.com"
              value={taskForm.assignedToEmail}
            />
          </Field>
        ) : null}

        {isGame ? (
          <Field label="Game Type">
            <div className="grid gap-2 sm:grid-cols-3">
              {gameTypeOptions.map((option) => {
                const Icon = option.icon;
                const active = taskForm.gameType === option.value;
                return (
                  <button
                    className={`rounded-[9px] border px-3 py-2 text-left text-xs transition ${
                      active
                        ? "border-[#F0C040] bg-[#241A00] text-[#F0C040]"
                        : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690]"
                    }`}
                    key={option.value}
                    onClick={() => setTaskForm((current) => ({ ...current, gameType: option.value }))}
                    type="button"
                  >
                    <Icon className="mb-2 size-4" />
                    <span className="block font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}

        <Field label={isNotification ? "Message" : "Description"}>
          <TextArea
            onChange={(value) => setTaskForm((current) => ({ ...current, description: value }))}
            placeholder={
              isNotification
                ? "Share a reminder, deadline update, or room-wide nudge."
                : "Submit a functional demo. GitHub and Drive proof are mandatory."
            }
            value={taskForm.description}
          />
          <p
            className={`text-[11px] ${
              descriptionLength && descriptionLength < minimumDescriptionLength
                ? "text-[#FF5A4A]"
                : "text-[#626058]"
            }`}
          >
            {descriptionLength}/{minimumDescriptionLength} characters minimum
          </p>
        </Field>

        {!isNotification ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="Expected Proof">
              <div className="flex flex-wrap gap-2">
                {proofTypeOptions
                  .filter((option) => (isGame ? option.value === "game_score" : option.value !== "game_score"))
                  .map((option) => {
                    const locked = assignmentMode === "task" && defaultRegularProofTypes.includes(option.value);
                    const active = effectiveProofTypes.includes(option.value);
                    return (
                      <button
                        className={`rounded-[7px] border px-3 py-1.5 font-mono text-[10px] uppercase transition ${
                          active
                            ? "border-[#1EEAB0] bg-[#061F18] text-[#1EEAB0]"
                            : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#626058]"
                        } ${locked ? "cursor-default" : ""}`}
                        disabled={locked || isGame}
                        key={option.value}
                        onClick={() =>
                          setProofTypes((current) =>
                            current.includes(option.value)
                              ? current.filter((item) => item !== option.value)
                              : [...current, option.value],
                          )
                        }
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
              </div>
            </Field>
            <Field label="XRDM Reward">
              <Input
                className="h-10 rounded-[9px] border-[#F0C040] bg-[#241A00] font-mono text-sm text-[#F0C040]"
                min={0}
                onChange={(event) => setTaskForm((current) => ({ ...current, rewardXrdm: event.target.value }))}
                type="number"
                value={taskForm.rewardXrdm}
              />
            </Field>
          </div>
        ) : null}

        <Button
          className="h-11 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
          disabled={!canSubmit}
          type="submit"
        >
          {isNotification ? <Bell className="size-4" /> : <Send className="size-4" />}
          {isNotification ? "Send Notification" : "Create Assignment"}
        </Button>
      </form>
    </SectionCard>
  );
}

function ParticipantSubmitPanel({
  mySubmissions,
  onSelectTask,
  onSubmitFormChange,
  onSubmitProof,
  selectedSubmission,
  selectedTask,
  selectedTaskId,
  submitForm,
  submitProofPending,
  tasks,
  user,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  onSelectTask: (taskId: string) => void;
  onSubmitFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  onSubmitProof: () => void;
  selectedSubmission?: DashboardData["mySubmissions"][number];
  selectedTask?: HackTask;
  selectedTaskId: string;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
  submitProofPending: boolean;
  tasks: HackTask[];
  user: SessionUser;
}) {
  const canSubmit =
    selectedTask &&
    submitForm.submitterName.trim() &&
    submitForm.teamName.trim() &&
    submitForm.description.trim() &&
    hasRequiredProofItems(selectedTask, submitForm) &&
    !submitProofPending;
  const canShowForm = !selectedSubmission || selectedSubmission.status === "returned";

  return (
    <SectionCard badge={`${tasks.length} tasks`} eyebrow="Participant" title="Submit Task">
      <div className="mb-3 grid gap-2">
        {tasks.length ? (
          tasks.map((task) => {
            const submission = mySubmissions.find((item) => item.taskId === task._id);
            return (
              <TaskCard
                key={task._id}
                onSelect={() => onSelectTask(task._id)}
                selected={selectedTaskId === task._id}
                status={submission?.status}
                task={task}
              />
            );
          })
        ) : (
          <EmptyState icon={<ClipboardList />} text="The host has not assigned work yet." />
        )}
      </div>

      {selectedSubmission?.status === "returned" ? (
        <StatusBanner
          message={selectedSubmission.hostFeedback || "Proof returned. Update the fields and resubmit."}
          tone="red"
        />
      ) : null}

      {!canShowForm && selectedSubmission ? (
        <SubmissionHoldCard submission={selectedSubmission} />
      ) : (
        <form
          className="rounded-[11px] border border-[#1EEAB0] bg-[#0D0F12] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitProof();
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#1EEAB0]">
                Submit Proof
              </div>
              <div className="mt-1 text-sm font-medium text-[#EEE8DE]">
                {selectedTask?.title ?? "Select an assignment"}
              </div>
            </div>
            {selectedTask ? <Badge tone="gold">+{selectedTask.rewardXrdm} XRDM</Badge> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your Name">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#061F18] text-sm text-[#EEE8DE]"
                onChange={(event) =>
                  onSubmitFormChange((current) => ({ ...current, submitterName: event.target.value }))
                }
                placeholder={user.name}
                value={submitForm.submitterName}
              />
            </Field>
            <Field label="Team Name">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#061F18] text-sm text-[#EEE8DE]"
                onChange={(event) =>
                  onSubmitFormChange((current) => ({ ...current, teamName: event.target.value }))
                }
                placeholder="Team XRDM"
                value={submitForm.teamName}
              />
            </Field>
          </div>
          <TeamMateEmailComposer setSubmitForm={onSubmitFormChange} submitForm={submitForm} />
          <Field label="Description">
            <TextArea
              onChange={(value) => onSubmitFormChange((current) => ({ ...current, description: value }))}
              placeholder="Summarize what your team built, changed, or completed."
              value={submitForm.description}
            />
          </Field>
          <ProofRequirementFields
            selectedTask={selectedTask}
            setSubmitForm={onSubmitFormChange}
            submitForm={submitForm}
          />
          <Field label="Note to Host">
            <TextArea
              onChange={(value) => onSubmitFormChange((current) => ({ ...current, notes: value }))}
              placeholder="Mention branch, demo timestamp, game result, or implementation notes."
              value={submitForm.notes}
            />
          </Field>
          <Button
            className="mt-3 h-11 w-full rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
            disabled={!canSubmit}
            type="submit"
          >
            <Send className="size-4" />
            {selectedTask?.kind === "game" ? "Submit Game Proof" : "Submit Proof"}
          </Button>
        </form>
      )}
    </SectionCard>
  );
}

function ParticipantGamesPanel({
  mySubmissions,
  onSelectTask,
  onSubmitFormChange,
  onSubmitProof,
  selectedSubmission,
  selectedTask,
  selectedTaskId,
  submitForm,
  submitProofPending,
  tasks,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  onSelectTask: (taskId: string) => void;
  onSubmitFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  onSubmitProof: () => void;
  selectedSubmission?: DashboardData["mySubmissions"][number];
  selectedTask?: HackTask;
  selectedTaskId: string;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
  submitProofPending: boolean;
  tasks: HackTask[];
}) {
  const gameTasks = tasks.filter((task) => task.kind === "game");
  const challengeTasks = tasks.filter((task) => task.kind === "challenge");

  return (
    <div className="grid gap-3">
      <SectionCard badge={`${gameTasks.length} live`} eyebrow="Participant" title="Games">
        <MiniGameArena
          onUseResult={(result) => {
            onSubmitFormChange((current) => ({
              ...current,
              notes: result.notes,
              proofItems: { ...current.proofItems, game_score: result.proofValue },
            }));
          }}
        />
      </SectionCard>

      <SectionCard badge={`${gameTasks.length + challengeTasks.length} assignments`} eyebrow="Play Proof" title="Game and Spot Tasks">
        <div className="grid gap-2">
          {[...gameTasks, ...challengeTasks].length ? (
            [...gameTasks, ...challengeTasks].map((task) => {
              const submission = mySubmissions.find((item) => item.taskId === task._id);
              return (
                <TaskCard
                  key={task._id}
                  onSelect={() => onSelectTask(task._id)}
                  selected={selectedTaskId === task._id}
                  status={submission?.status}
                  task={task}
                />
              );
            })
          ) : (
            <EmptyState icon={<Gamepad2 />} text="Game assignments and spot challenges will appear here." />
          )}
        </div>
        {selectedTask?.kind === "game" || selectedTask?.kind === "challenge" ? (
          <div className="mt-3">
            <ParticipantSubmitPanel
              mySubmissions={mySubmissions}
              onSelectTask={onSelectTask}
              onSubmitFormChange={onSubmitFormChange}
              onSubmitProof={onSubmitProof}
              selectedSubmission={selectedSubmission}
              selectedTask={selectedTask}
              selectedTaskId={selectedTaskId}
              submitForm={submitForm}
              submitProofPending={submitProofPending}
              tasks={[selectedTask]}
              user={{ email: "", id: "", name: submitForm.submitterName }}
            />
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function MiniGameArena({ onUseResult }: { onUseResult: (result: MiniGameResult) => void }) {
  const [gameType, setGameType] = useState<GameType>("memory_match");
  const [latestResult, setLatestResult] = useState<MiniGameResult | null>(null);
  const gameInfo = getGameTypeInfo(gameType);
  const Icon = gameInfo.icon;

  function handleComplete(result: MiniGameResult) {
    setLatestResult(result);
    onUseResult(result);
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {gameTypeOptions.map((option) => {
          const OptionIcon = option.icon;
          const active = gameType === option.value;
          return (
            <button
              className={`rounded-[9px] border p-2 text-left text-xs transition ${
                active ? "border-[#F0C040] bg-[#241A00] text-[#F0C040]" : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690]"
              }`}
              key={option.value}
              onClick={() => setGameType(option.value)}
              type="button"
            >
              <OptionIcon className="mb-1 size-4" />
              <span className="block font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[12px] border border-[#F0C040] bg-[#241A00] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[8px] border border-[#8A6A00] bg-[#0D0F12]">
              <Icon className="size-4 text-[#F0C040]" />
            </span>
            <div>
              <div className="text-sm font-medium text-[#EEE8DE]">{gameInfo.label}</div>
              <div className="text-[10px] text-[#626058]">Practice or generate score proof</div>
            </div>
          </div>
          <Badge tone="gold">Active</Badge>
        </div>
        {gameType === "memory_match" ? (
          <MemoryMatchGame onComplete={handleComplete} />
        ) : gameType === "breath_timer" ? (
          <BreathTimerGame onComplete={handleComplete} />
        ) : (
          <QuickMathsGame onComplete={handleComplete} />
        )}
      </div>

      {latestResult ? (
        <div className="rounded-[10px] border border-[#1EEAB0] bg-[#061F18] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-[#1EEAB0]">{latestResult.title} proof ready</div>
              <p className="mt-1 text-xs leading-5 text-[#1EEAB0]">{latestResult.notes}</p>
            </div>
            <Badge tone="gold">{latestResult.score} pts</Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemoryMatchGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [cards, setCards] = useState(makeMemoryCards);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const timeout = window.setTimeout(() => {
      const [firstIndex, secondIndex] = flipped;
      const firstCard = cards[firstIndex];
      const secondCard = cards[secondIndex];
      setMoves((current) => current + 1);
      if (firstCard?.value && firstCard.value === secondCard?.value) {
        setMatched((current) => [...current, firstCard.value]);
      }
      setFlipped([]);
    }, 550);
    return () => window.clearTimeout(timeout);
  }, [cards, flipped]);

  useEffect(() => {
    if (matched.length === 4 && !completed) {
      const score = Math.max(40, 120 - moves * 8);
      setCompleted(true);
      onComplete(makeMiniGameResult("memory_match", score, `${moves} moves, 4 pairs matched`));
    }
  }, [completed, matched.length, moves, onComplete]);

  function reset() {
    setCards(makeMemoryCards());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setCompleted(false);
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Moves" value={moves} tone="gold" />
        <StatBox label="Matched" value={matched.length} tone="gold" />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((card, index) => {
          const visible = flipped.includes(index) || matched.includes(card.value);
          return (
            <button
              className={`grid h-[52px] place-items-center rounded-[8px] border text-lg font-medium transition ${
                visible
                  ? "border-[#F0C040] bg-[#241A00] text-[#F0C040]"
                  : "border-[#8A6A00] bg-[#0D0F12] text-[#626058]"
              }`}
              disabled={completed}
              key={card.id}
              onClick={() => {
                if (visible || flipped.length >= 2) return;
                setFlipped((current) => [...current, index]);
              }}
              type="button"
            >
              {visible ? card.label : "?"}
            </button>
          );
        })}
      </div>
      <Button className="h-9 rounded-[9px] border-[#F0C040] bg-[#0D0F12] text-[#F0C040]" onClick={reset} type="button" variant="outline">
        <RefreshCcw className="size-4" />
        Reset Game
      </Button>
    </div>
  );
}

function BreathTimerGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [seconds, setSeconds] = useState(30);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (seconds <= 0) {
      setRunning(false);
      onComplete(makeMiniGameResult("breath_timer", 60, "30 second focus loop completed"));
      return;
    }
    const timeout = window.setTimeout(() => setSeconds((current) => current - 1), 1000);
    return () => window.clearTimeout(timeout);
  }, [onComplete, running, seconds]);

  return (
    <div className="grid gap-3 text-center">
      <div className="rounded-[12px] border border-[#8A6A00] bg-[#0D0F12] p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#626058]">Breathe</div>
        <div className="mt-2 text-4xl font-medium text-[#F0C040]">{seconds}</div>
        <div className="mt-2 text-xs text-[#9C9690]">{seconds % 8 < 4 ? "Inhale" : "Exhale"}</div>
      </div>
      <Button
        className="h-9 rounded-[9px] bg-[#F0C040] text-[#120d00] hover:bg-[#F0C040]/85"
        onClick={() => {
          if (seconds <= 0) setSeconds(30);
          setRunning((current) => !current);
        }}
        type="button"
      >
        {running ? "Pause" : "Start"}
      </Button>
    </div>
  );
}

function QuickMathsGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState(() => makeMathQuestion(0));
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);

  function submitAnswer() {
    const correct = Number(answer) === question.answer;
    const nextScore = correct ? score + 20 : score;
    const nextRound = round + 1;
    setScore(nextScore);
    setAnswer("");
    if (nextRound >= 5) {
      onComplete(makeMiniGameResult("quick_maths", nextScore, `${nextScore / 20} of 5 answers correct`));
      setRound(0);
      setScore(0);
      setQuestion(makeMathQuestion(0));
      return;
    }
    setRound(nextRound);
    setQuestion(makeMathQuestion(nextRound));
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submitAnswer();
      }}
    >
      <div className="rounded-[12px] border border-[#8A6A00] bg-[#0D0F12] p-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#626058]">Round {round + 1} of 5</div>
        <div className="mt-2 text-4xl font-medium text-[#F0C040]">{question.prompt}</div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input
          className="h-10 rounded-[9px] border-[#F0C040] bg-[#0D0F12] text-center font-mono text-sm text-[#F0C040]"
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Answer"
          type="number"
          value={answer}
        />
        <Button className="h-10 rounded-[9px] bg-[#F0C040] text-[#120d00]" disabled={!answer.trim()} type="submit">
          Check
        </Button>
      </div>
      <StatBox label="Score" value={score} tone="gold" />
    </form>
  );
}

function RewardsPanel({
  issueRewardPending,
  onIssueReward,
  onRewardFormChange,
  rewardForm,
  rewards,
  room,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  onRewardFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: HackReward[];
  room?: HackRoom;
  winnerSubmissions: HackSubmission[];
}) {
  return (
    <div className="grid gap-3">
      <SectionCard badge={`${room?.participants.length ?? 0} members`} eyebrow="Issue" title="Certificates and NFT Badges">
        <div className="mb-3 grid grid-cols-3 gap-2">
          {(["participant_certificate", "winner_certificate", "winner_nft_badge"] as RewardKind[]).map((kind) => (
            <TaskKindButton
              active={rewardForm.kind === kind}
              icon={kind === "winner_nft_badge" ? <Diamond className="size-4" /> : <Award className="size-4" />}
              key={kind}
              label={rewardKindLabel(kind)}
              onClick={() => onRewardFormChange((current) => ({ ...current, kind }))}
              tone="gold"
            />
          ))}
        </div>
        {rewardForm.kind === "participant_certificate" && room ? (
          <RecipientSelector
            onRewardFormChange={onRewardFormChange}
            room={room}
            selectedRecipientIds={rewardForm.recipientIds.length ? rewardForm.recipientIds : room.participants.map((p) => p.userId)}
          />
        ) : null}
        {rewardForm.kind !== "participant_certificate" ? (
          <WinnerSourceSelector
            onRewardFormChange={onRewardFormChange}
            rewardForm={rewardForm}
            winnerSubmissions={winnerSubmissions}
          />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Award Title">
            <Input
              className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-sm text-[#CCC6BA]"
              onChange={(event) => onRewardFormChange((current) => ({ ...current, title: event.target.value }))}
              placeholder={rewardKindLabel(rewardForm.kind)}
              value={rewardForm.title}
            />
          </Field>
          <Field label="XRDM Attached">
            <Input
              className="h-10 rounded-[9px] border-[#F0C040] bg-[#241A00] font-mono text-sm text-[#F0C040]"
              min={0}
              onChange={(event) => onRewardFormChange((current) => ({ ...current, awardXrdm: event.target.value }))}
              type="number"
              value={rewardForm.awardXrdm}
            />
          </Field>
        </div>
        <Field label="Description">
          <TextArea
            onChange={(value) => onRewardFormChange((current) => ({ ...current, description: value }))}
            placeholder="Issued for verified participation in this hack room."
            value={rewardForm.description}
          />
        </Field>
        <Field label="Ledger Note">
          <TextArea
            onChange={(value) => onRewardFormChange((current) => ({ ...current, ledgerNote: value }))}
            placeholder="Record details for the So.Good ledger."
            value={rewardForm.ledgerNote}
          />
        </Field>
        <Button
          className="mt-3 h-11 w-full rounded-[10px] bg-[#F0C040] text-[#120d00] hover:bg-[#F0C040]/85"
          disabled={issueRewardPending || !room}
          onClick={() => onIssueReward(rewardForm.kind)}
          type="button"
        >
          <Send className="size-4" />
          Issue {rewardKindLabel(rewardForm.kind)}
        </Button>
      </SectionCard>

      <SectionCard badge={`${rewards.length} issued`} eyebrow="Ledger" title="Issued Awards">
        <div className="grid gap-2">
          {rewards.length ? (
            rewards.map((reward) => <RewardCard key={reward._id} reward={reward} />)
          ) : (
            <EmptyState icon={<Award />} text="Certificates and NFT badge records will appear here." />
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function AwardPanel({
  approvedSubmissions,
  feedbackBySubmission,
  hostSubmissions,
  onAwardChange,
  onFeedbackChange,
  onSelectWinner,
}: {
  approvedSubmissions: HackSubmission[];
  awardBySubmission: Record<string, string>;
  feedbackBySubmission: Record<string, string>;
  hostSubmissions: HackSubmission[];
  onAwardChange: (submissionId: string, value: string) => void;
  onFeedbackChange: (submissionId: string, value: string) => void;
  onSelectWinner: (submission: HackSubmission) => void;
}) {
  const candidates = approvedSubmissions.length ? approvedSubmissions : hostSubmissions;

  return (
    <SectionCard badge={`${candidates.length} ready`} eyebrow="Announcement" title="Announce Winners">
      <div className="grid gap-2">
        {candidates.length ? (
          candidates.map((submission) => (
            <ReviewCard
              feedback={feedbackBySubmission[submission._id] || submission.hostFeedback || "Strong contribution and clear proof."}
              key={submission._id}
              onFeedbackChange={(value) => onFeedbackChange(submission._id, value)}
              submission={submission}
              trailing={
                <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                  <Field label="XRDM Award">
                    <Input
                      className="h-10 rounded-[9px] border-[#F0C040] bg-[#241A00] font-mono text-sm text-[#F0C040]"
                      min={0}
                      onChange={(event) => onAwardChange(submission._id, event.target.value)}
                      type="number"
                      value={String(submission.awardXrdm ?? submission.rewardXrdm ?? 20)}
                    />
                  </Field>
                  <Button
                    className="mt-auto h-10 rounded-[10px] bg-[#F0C040] text-[#120d00] hover:bg-[#F0C040]/85"
                    onClick={() => onSelectWinner(submission)}
                    type="button"
                  >
                    <Trophy className="size-4" />
                    Award XRDM
                  </Button>
                </div>
              }
            />
          ))
        ) : (
          <EmptyState icon={<Trophy />} text="Verify submissions before announcing winners." />
        )}
      </div>
    </SectionCard>
  );
}

function ReviewQueue({
  feedbackBySubmission,
  onApproveSubmission,
  onFeedbackChange,
  onReturnSubmission,
  pendingSubmissions,
}: {
  feedbackBySubmission: Record<string, string>;
  onApproveSubmission: (submission: HackSubmission) => void;
  onFeedbackChange: (submissionId: string, value: string) => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  pendingSubmissions: HackSubmission[];
}) {
  return (
    <SectionCard badge={`${pendingSubmissions.length} pending`} eyebrow="Verification" title="Review Queue">
      <div className="grid gap-2">
        {pendingSubmissions.length ? (
          pendingSubmissions.map((submission) => (
            <ReviewCard
              feedback={
                feedbackBySubmission[submission._id] ||
                submission.hostFeedback ||
                "Verified. Clear proof and solid contribution."
              }
              key={submission._id}
              onFeedbackChange={(value) => onFeedbackChange(submission._id, value)}
              submission={submission}
              trailing={
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-10 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
                    onClick={() => onApproveSubmission(submission)}
                    type="button"
                  >
                    <Check className="size-4" />
                    Verify
                  </Button>
                  <Button
                    className="h-10 rounded-[10px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
                    onClick={() => onReturnSubmission(submission)}
                    type="button"
                    variant="outline"
                  >
                    <X className="size-4" />
                    Return
                  </Button>
                </div>
              }
            />
          ))
        ) : (
          <EmptyState icon={<ShieldCheck />} text="Submitted proof from participants will appear here." />
        )}
      </div>
    </SectionCard>
  );
}

function ReviewCard({
  feedback,
  onFeedbackChange,
  submission,
  trailing,
}: {
  feedback: string;
  onFeedbackChange: (value: string) => void;
  submission: HackSubmission;
  trailing?: React.ReactNode;
}) {
  return (
    <article className="rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={submission.participantName} tone="cyan" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-[#EEE8DE]">
              {submission.participantName}
            </div>
            <div className="truncate text-[11px] text-[#626058]">
              {submission.roomName} - {submission.taskTitle}
            </div>
          </div>
        </div>
        <Badge tone={statusTone(submission.status)}>{submissionStatusLabel(submission.status)}</Badge>
      </div>
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      {submission.submissionDescription ? (
        <p className="mt-2 text-xs leading-5 text-[#9C9690]">{submission.submissionDescription}</p>
      ) : null}
      {submission.notes ? <p className="mt-2 text-xs leading-5 text-[#626058]">{submission.notes}</p> : null}
      <Field label="Host Feedback">
        <TextArea onChange={onFeedbackChange} value={feedback} />
      </Field>
      {trailing ? <div className="mt-3">{trailing}</div> : null}
    </article>
  );
}

function ParticipantHistoryPanel({
  mySubmissions,
  tasks,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  tasks: HackTask[];
}) {
  return (
    <SectionCard badge={`${mySubmissions.length} records`} eyebrow="Participant" title="History">
      <div className="mb-3 grid grid-cols-2 gap-2">
        <StatBox label="Room Tasks" value={tasks.length} />
        <StatBox label="Proof Records" value={mySubmissions.length} />
      </div>
      <div className="grid gap-2">
        {mySubmissions.length ? (
          mySubmissions.map((submission) => <SubmissionCard key={submission._id} submission={submission} />)
        ) : (
          <EmptyState icon={<CheckCircle2 />} text="Submitted, returned, verified, and winner records will appear here." />
        )}
      </div>
    </SectionCard>
  );
}

function WalletPanel({
  myRewards,
  mySubmissions,
  room,
}: {
  myRewards: HackReward[];
  mySubmissions: DashboardData["mySubmissions"];
  room?: HackRoom;
}) {
  const balance =
    mySubmissions.reduce((total, submission) => total + (submission.awardXrdm ?? (submission.status === "winner" ? submission.rewardXrdm ?? 0 : 0)), 0) +
    myRewards.reduce((total, reward) => total + (reward.awardXrdm ?? 0), 0);
  const verifiedCount = mySubmissions.filter((submission) =>
    ["approved", "winner"].includes(submission.status),
  ).length;
  const nftCount = myRewards.filter((reward) => reward.kind === "winner_nft_badge").length;
  const certificateCount = myRewards.filter((reward) => reward.kind !== "winner_nft_badge").length;

  return (
    <div className="grid gap-3">
      <div className="rounded-[14px] border border-[#F0C040] bg-[#241A00] p-4 text-center">
        <div className="mx-auto mb-2 grid size-10 place-items-center rounded-[10px] border border-[#8A6A00] bg-[#0D0F12]">
          <Wallet className="size-5 text-[#F0C040]" />
        </div>
        <div className="text-[15px] font-medium text-[#F0C040]">XRDM Wallet</div>
        <p className="mt-2 text-xs leading-5 text-[#9C9690]">
          Certificates, NFT badges, winner awards, and verified proof issued on the in-app So.Good Ledger.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 rounded-[8px] border border-[#F0C040] bg-[#241A00] px-3 py-1 font-mono text-[10px] uppercase text-[#F0C040]">
          <Database className="size-3" />
          Issued - Ledger
        </div>
      </div>

      <SectionCard eyebrow="My XRDM Balance" title={room?.name ?? "Wallet"} badge={`${balance} XRDM`}>
        <div className="mb-3 flex items-baseline gap-2">
          <div className="text-[32px] font-medium text-[#EEE8DE]">{balance}</div>
          <div className="text-sm font-medium text-[#626058]">XRDM</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="Verified" value={verifiedCount} tone="gold" />
          <StatBox label="Certificates" value={certificateCount} tone="gold" />
          <StatBox label="NFTs" value={nftCount} tone="gold" />
        </div>
      </SectionCard>

      <SectionCard badge={`${myRewards.length + mySubmissions.length} rows`} eyebrow="Ledger" title="So.Good Ledger Rows">
        <div className="grid gap-2">
          {mySubmissions.map((submission) => (
            <LedgerRow
              key={submission._id}
              label={submission.taskTitle}
              meta={`${submissionStatusLabel(submission.status)} - ${formatDate(submission.submittedAt)}`}
              value={`+${submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM`}
            />
          ))}
          {myRewards.map((reward) => (
            <LedgerRow
              key={reward._id}
              label={reward.title}
              meta={`${rewardKindLabel(reward.kind)} - ${formatDate(reward.issuedAt)}`}
              value={reward.awardXrdm ? `+${reward.awardXrdm} XRDM` : "Issued"}
            />
          ))}
          {!mySubmissions.length && !myRewards.length ? (
            <EmptyState icon={<Database />} text="Verified proof, certificates, NFT badges, and XRDM records will appear here." />
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

function LeaderboardPanel({
  leaderboard,
}: {
  leaderboard: Array<{ email: string; name: string; points: number; wins: number }>;
}) {
  return (
    <SectionCard badge={`${leaderboard.length} ranked`} eyebrow="Room Rank" title="Leaderboard">
      <div className="grid gap-2">
        {leaderboard.length ? (
          leaderboard.map((entry, index) => (
            <div
              className="flex items-center gap-3 rounded-[10px] border border-[#8A6A00] bg-[#241A00] px-3 py-3"
              key={entry.email}
            >
              <div className="w-7 font-mono text-sm font-semibold text-[#F0C040]">#{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#EEE8DE]">{entry.name}</div>
                <div className="truncate text-[11px] text-[#626058]">{entry.email}</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-semibold text-[#1EEAB0]">+{entry.points} XRDM</div>
                <div className="text-[10px] text-[#626058]">{entry.wins} wins</div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={<Crown />} text="Leaderboard starts once participants join or win XRDM." />
        )}
      </div>
    </SectionCard>
  );
}

function RoomProfile({
  onShareInvite,
  onSignOut,
  room,
  user,
}: {
  onShareInvite: (room: HackRoom) => void;
  onSignOut: () => void;
  room?: HackRoom;
  user: SessionUser;
}) {
  return (
    <SectionCard eyebrow="Room" title="Profile" badge={room?.status ?? "active"}>
      {room ? (
        <>
          <ProfileField label="Room Name" value={room.name} />
          <ProfileField label="Host" value={room.hostName} />
          <ProfileField label="Invite Code" value={room.inviteCode} tone="cyan" />
          <ProfileField label="Status" value={room.status} tone="cyan" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              className="h-10 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
              onClick={() => onShareInvite(room)}
              type="button"
            >
              <Copy className="size-4" />
              Share Invite
            </Button>
            <Button
              className="h-10 rounded-[10px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
              onClick={onSignOut}
              type="button"
              variant="outline"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </>
      ) : (
        <>
          <ProfileField label="Name" value={user.name} />
          <ProfileField label="Email" value={user.email} />
          <Button
            className="mt-3 h-10 w-full rounded-[10px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A]"
            onClick={onSignOut}
            type="button"
            variant="outline"
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </>
      )}
    </SectionCard>
  );
}

function CreatedTasks({ tasks }: { tasks: HackTask[] }) {
  return (
    <SectionCard badge={`${tasks.length} tasks`} eyebrow="Published" title="Created Tasks">
      <div className="grid gap-2">
        {tasks.length ? (
          tasks.map((task) => (
            <TaskCard key={task._id} selected={false} task={task} />
          ))
        ) : (
          <EmptyState icon={<ClipboardList />} text="Created assignments, challenges, games, and special tasks will appear here." />
        )}
      </div>
    </SectionCard>
  );
}

function SubmissionList({
  emptyText,
  submissions,
  title,
  tone,
}: {
  emptyText: string;
  submissions: HackSubmission[];
  title: string;
  tone: Tone;
}) {
  return (
    <SectionCard badge={`${submissions.length} records`} eyebrow={title} title="History" tone={tone}>
      <div className="grid gap-2">
        {submissions.length ? (
          submissions.map((submission) => <SubmissionCard key={submission._id} submission={submission} />)
        ) : (
          <EmptyState icon={<Clock />} text={emptyText} />
        )}
      </div>
    </SectionCard>
  );
}

function MemberList({ room }: { room: HackRoom }) {
  return (
    <div className="grid gap-1.5">
      {room.participants.length ? (
        room.participants.map((participant, index) => (
          <div
            className="flex items-center gap-3 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2"
            key={participant.userId}
          >
            <Avatar name={participant.name} tone={index % 2 ? "violet" : "cyan"} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-[#EEE8DE]">{participant.name}</div>
              <div className="truncate text-[11px] text-[#626058]">{participant.email}</div>
            </div>
            <div className="text-[11px] text-[#626058]">{formatDate(participant.joinedAt)}</div>
          </div>
        ))
      ) : (
        <EmptyState icon={<Users />} text="No participants yet. Share the invite code to fill the room." />
      )}
    </div>
  );
}

function RecipientSelector({
  onRewardFormChange,
  room,
  selectedRecipientIds,
}: {
  onRewardFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  room: HackRoom;
  selectedRecipientIds: string[];
}) {
  const allIds = room.participants.map((participant) => participant.userId);

  return (
    <Field label="Recipients">
      <div className="mb-3 flex flex-wrap gap-2">
        <ChipButton
          active={selectedRecipientIds.length === allIds.length}
          label="All participants"
          onClick={() => onRewardFormChange((current) => ({ ...current, recipientIds: allIds }))}
        />
        {room.participants.map((participant) => {
          const active = selectedRecipientIds.includes(participant.userId);
          return (
            <ChipButton
              active={active}
              key={participant.userId}
              label={participant.name}
              onClick={() =>
                onRewardFormChange((current) => {
                  const currentIds = current.recipientIds.length ? current.recipientIds : allIds;
                  return {
                    ...current,
                    recipientIds: active
                      ? currentIds.filter((id) => id !== participant.userId)
                      : [...currentIds, participant.userId],
                  };
                })
              }
            />
          );
        })}
      </div>
    </Field>
  );
}

function WinnerSourceSelector({
  onRewardFormChange,
  rewardForm,
  winnerSubmissions,
}: {
  onRewardFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  winnerSubmissions: HackSubmission[];
}) {
  return (
    <Field label="Winner Source">
      <div className="mb-3 flex flex-wrap gap-2">
        {winnerSubmissions.length ? (
          winnerSubmissions.map((submission) => (
            <ChipButton
              active={(rewardForm.sourceSubmissionId || winnerSubmissions[0]?._id) === submission._id}
              key={submission._id}
              label={submission.taskTitle}
              onClick={() =>
                onRewardFormChange((current) => ({ ...current, sourceSubmissionId: submission._id }))
              }
            />
          ))
        ) : (
          <EmptyState icon={<Trophy />} text="Announce a winner before issuing winner certificates or NFT badges." />
        )}
      </div>
    </Field>
  );
}

function TeamMateEmailComposer({
  setSubmitForm,
  submitForm,
}: {
  setSubmitForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
}) {
  function addDraftEmails() {
    setSubmitForm((current) => {
      const tokens = getEmailTokens(current.teamMateEmailDraft);
      if (!tokens.length) return current;
      const validEmails = tokens.filter(isEmailLike);
      const invalidEmails = tokens.filter((email) => !isEmailLike(email));
      return {
        ...current,
        teamMateEmailDraft: invalidEmails.join(", "),
        teamMateEmails: normalizeEmails([...current.teamMateEmails, ...validEmails]),
      };
    });
  }

  return (
    <Field label="Team Mate Emails">
      <div className="mb-3 rounded-[9px] border border-[#1EEAB0] bg-[#061F18] p-2">
        {submitForm.teamMateEmails.length ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {submitForm.teamMateEmails.map((email) => (
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#1EEAB0] bg-[#0D0F12] px-2 py-1 font-mono text-[10px] text-[#1EEAB0]"
                key={email}
              >
                <span className="truncate">{email}</span>
                <button
                  aria-label={`Remove ${email}`}
                  onClick={() =>
                    setSubmitForm((current) => ({
                      ...current,
                      teamMateEmails: current.teamMateEmails.filter((item) => item !== email),
                    }))
                  }
                  type="button"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            className="h-9 rounded-[8px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-xs text-[#EEE8DE]"
            onChange={(event) => {
              const value = event.target.value;
              if (/[,\n;]/.test(value)) {
                setSubmitForm((current) => ({
                  ...current,
                  teamMateEmailDraft: "",
                  teamMateEmails: normalizeEmails([...current.teamMateEmails, ...getEmailTokens(value).filter(isEmailLike)]),
                }));
                return;
              }
              setSubmitForm((current) => ({ ...current, teamMateEmailDraft: value }));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addDraftEmails();
              }
            }}
            placeholder="teammate@domain.com"
            value={submitForm.teamMateEmailDraft}
          />
          <Button className="h-9 rounded-[8px] bg-[#1EEAB0] text-[#03120C]" onClick={addDraftEmails} type="button">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </Field>
  );
}

function ProofRequirementFields({
  selectedTask,
  setSubmitForm,
  submitForm,
}: {
  selectedTask?: HackTask;
  setSubmitForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
}) {
  if (!selectedTask) {
    return <EmptyState icon={<ClipboardList />} text="Select an assignment to see required proof." />;
  }

  return (
    <div className="grid gap-3">
      {getTaskProofTypes(selectedTask).map((proofType) => (
        <Field key={proofType} label={`${proofTypeLabel(proofType)} Proof`}>
          <Input
            className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#061F18] text-sm text-[#EEE8DE]"
            onChange={(event) =>
              setSubmitForm((current) => ({
                ...current,
                proofItems: {
                  ...current.proofItems,
                  [proofType]: event.target.value,
                },
              }))
            }
            placeholder={proofTypePlaceholder(proofType)}
            value={submitForm.proofItems[proofType] ?? ""}
          />
        </Field>
      ))}
    </div>
  );
}

function Tabs<T extends string>({
  activeTab,
  onSelect,
  tabs,
}: {
  activeTab: T;
  onSelect: (tab: T) => void;
  tabs: Array<{ id: T; icon: typeof Home; label: string }>;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-[5px]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            className={`inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-xs transition ${
              active
                ? "border-[#1EEAB0] bg-[#061F18] font-medium text-[#1EEAB0]"
                : "border-[rgba(238,232,222,0.12)] bg-[#141618] text-[#626058] hover:text-[#9C9690]"
            }`}
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            type="button"
          >
            <Icon className="size-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ActionScreen({
  children,
  onBack,
  title,
}: {
  children: React.ReactNode;
  onBack: () => void;
  title: string;
}) {
  return (
    <div className="grid gap-3">
      <button
        className="flex items-center gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-left"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft className="size-4 text-[#9C9690]" />
        <span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#626058]">
            Host Action
          </span>
          <span className="block text-base font-medium text-[#EEE8DE]">{title}</span>
        </span>
      </button>
      {children}
    </div>
  );
}

function QuickActionGrid({
  actions,
  columns = 4,
}: {
  actions: Array<{ icon: typeof Home; label: string; meta?: string; onClick: () => void; tone?: Tone }>;
  columns?: 2 | 4;
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#626058]">
        Quick Actions
      </div>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {actions.map((action) => {
          const Icon = action.icon;
          const tone = action.tone ?? "cyan";
          const hasMeta = Boolean(action.meta);
          return (
            <button
              className={
                hasMeta
                  ? `flex min-h-[92px] flex-col items-start justify-center rounded-[11px] border p-[11px] text-left transition hover:brightness-110 ${tonePanelSurface(tone)}`
                  : `flex min-h-[72px] flex-col items-center justify-center gap-[5px] rounded-[11px] border border-[rgba(238,232,222,0.12)] border-t-2 bg-[#222528] px-2 py-[9px] text-center transition hover:bg-[#2A2E32] ${toneTopBorder(tone)}`
              }
              key={action.label}
              onClick={action.onClick}
              type="button"
            >
              {hasMeta ? (
                <Icon className={`size-[18px] ${toneText(tone)}`} />
              ) : (
                <span className="grid size-8 place-items-center rounded-[12px] border border-[rgba(238,232,222,0.12)] bg-[#222528]">
                  <Icon className="size-[18px] text-[#CCC6BA]" />
                </span>
              )}
              <span className={`${hasMeta ? `mt-2 text-xs ${toneText(tone)}` : "text-[10px] text-[#9C9690]"} font-extrabold`}>
                {action.label}
              </span>
              {action.meta ? (
                <span className="mt-0.5 line-clamp-2 text-[10px] leading-[14px] text-[#9C9690]">
                  {action.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  badge,
  children,
  eyebrow,
  title,
  tone = "cyan",
}: {
  badge?: string;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  tone?: Tone;
}) {
  return (
    <Card className={`mb-3 gap-0 rounded-[11px] border py-0 text-[#EEE8DE] ring-0 ${tonePanelSurface(tone)}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div>
          <div className={`font-mono text-[10px] uppercase tracking-[0.12em] ${toneText(tone, true)}`}>
            {eyebrow}
          </div>
          <CardTitle className="mt-0.5 text-sm font-bold tracking-normal text-[#EEE8DE]">{title}</CardTitle>
        </div>
        {badge ? <Badge tone={tone}>{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="px-4 pb-3.5">{children}</CardContent>
    </Card>
  );
}

function TaskCard({
  onSelect,
  selected = false,
  status,
  task,
}: {
  onSelect?: () => void;
  selected?: boolean;
  status?: SubmissionStatus;
  task: HackTask;
}) {
  const Component = onSelect ? "button" : "article";
  return (
    <Component
      className={`w-full rounded-[10px] border p-3 text-left transition ${
        selected
          ? "border-[#1EEAB0] bg-[#061F18]"
          : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] hover:border-[#1EEAB0]"
      }`}
      onClick={onSelect}
      type={onSelect ? "button" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[#EEE8DE]">{task.title}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-[#626058]">
            {task.roomName} - Due {formatDate(task.dueAt)}
          </div>
        </div>
        <Badge tone={status ? statusTone(status) : "gold"}>
          {status ? submissionStatusLabel(status) : `+${task.rewardXrdm} XRDM`}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#9C9690]">{task.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ProofTag label={kindLabel(task.kind ?? "task")} />
        {getTaskProofTypes(task).map((proofType) => (
          <ProofTag key={proofType} label={proofTypeLabel(proofType)} />
        ))}
      </div>
    </Component>
  );
}

function SubmissionCard({
  submission,
}: {
  submission: DashboardData["mySubmissions"][number] | HackSubmission;
}) {
  return (
    <article className="rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[#EEE8DE]">{submission.taskTitle}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-[#626058]">{submission.roomName}</div>
        </div>
        <Badge tone={statusTone(submission.status)}>{submissionStatusLabel(submission.status)}</Badge>
      </div>
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] text-[#626058]">{formatDate(submission.submittedAt)}</div>
        <div className="font-mono text-xs font-semibold text-[#F0C040]">
          +{submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM
        </div>
      </div>
      {submission.hostFeedback ? (
        <p className="mt-2 border-t border-[rgba(238,232,222,0.12)] pt-2 text-xs leading-5 text-[#9C9690]">
          {submission.hostFeedback}
        </p>
      ) : null}
    </article>
  );
}

function SubmissionHoldCard({ submission }: { submission: DashboardData["mySubmissions"][number] }) {
  return (
    <div className={`rounded-[11px] border p-3 ${toneSurface(statusTone(submission.status))}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{submissionStatusHeadline(submission.status)}</div>
          <p className="mt-1 text-xs leading-5 text-[#9C9690]">
            {submission.status === "submitted"
              ? "Your proof is with the host. This form reopens if the host returns it."
              : "This proof is locked into your room history."}
          </p>
        </div>
        <Badge tone={statusTone(submission.status)}>{submissionStatusLabel(submission.status)}</Badge>
      </div>
      <SubmissionCard submission={submission} />
    </div>
  );
}

function RewardCard({ reward }: { reward: HackReward }) {
  return (
    <article className="rounded-[10px] border border-[#8A6A00] bg-[#241A00] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-[#EEE8DE]">{reward.title}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-[#626058]">
            {reward.roomName} - {formatDate(reward.issuedAt)}
          </div>
        </div>
        <Badge tone="gold">{rewardKindLabel(reward.kind)}</Badge>
      </div>
      {reward.description ? <p className="mt-2 text-xs leading-5 text-[#9C9690]">{reward.description}</p> : null}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[#626058]">{reward.recipientCount} recipients</span>
        <span className="font-mono font-semibold text-[#F0C040]">
          {reward.awardXrdm ? `+${reward.awardXrdm} XRDM` : "Issued"}
        </span>
      </div>
    </article>
  );
}

function ProofItemsList({ proofItems }: { proofItems: Array<{ type: ProofType; value: string }> }) {
  if (!proofItems.length) {
    return <EmptyState icon={<LinkIcon />} text="No proof links were attached." />;
  }

  return (
    <div className="mt-3 grid gap-1.5">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#626058]">
        Submitted Proof
      </div>
      {proofItems.map((proofItem, index) => {
        const Icon = proofTypeIcon(proofItem.type);
        const isLinkProof = proofItem.type !== "game_score";
        return (
          <a
            className="flex items-center justify-between gap-3 rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-2.5 py-2"
            href={isLinkProof ? toExternalUrl(proofItem.value) : undefined}
            key={`${proofItem.type}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[#0D0F12]">
                <Icon className="size-4 text-[#9C9690]" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-[#CCC6BA]">
                  {proofTypeLabel(proofItem.type)} {index + 1}
                </span>
                <span className="block truncate text-[10px] text-[#626058]">{proofItem.value}</span>
              </span>
            </span>
            <span className="text-[11px] font-medium text-[#1EEAB0]">
              {isLinkProof ? "Open" : "Result"}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function LedgerRow({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2">
      <span className="size-2 shrink-0 rounded-full bg-[#1EEAB0]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-[#EEE8DE]">{label}</span>
        <span className="block truncate text-[10px] text-[#626058]">{meta}</span>
      </span>
      <span className="font-mono text-xs font-semibold text-[#F0C040]">{value}</span>
    </div>
  );
}

function BottomNav({
  active,
  onHome,
  onProfile,
  onRooms,
}: {
  active: "home" | "profile" | "rooms";
  onHome: () => void;
  onProfile: () => void;
  onRooms: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-[#0A0C0F] px-3 pb-2.5 pt-1.5">
      <div className="mx-auto grid min-h-[54px] w-full max-w-[560px] grid-cols-3 gap-1 rounded-[14px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-1 shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
        <BottomNavButton
          active={active === "home"}
          icon={<Home className="size-[18px]" />}
          label="Home"
          onClick={onHome}
          tone="cyan"
        />
        <BottomNavButton
          active={active === "rooms"}
          icon={<Bolt className="size-[18px]" />}
          label="Rooms"
          onClick={onRooms}
          tone="violet"
        />
        <BottomNavButton
          active={active === "profile"}
          icon={<User className="size-[18px]" />}
          label="Profile"
          onClick={onProfile}
          tone="gold"
        />
      </div>
    </nav>
  );
}

function BottomNavButton({
  active = false,
  icon,
  label,
  onClick,
  tone,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: Tone;
}) {
  return (
    <button
      className={`flex min-h-[44px] flex-col items-center justify-center gap-px rounded-[10px] border px-2 py-1 text-[9px] transition ${
        active
          ? `border-[rgba(238,232,222,0.12)] bg-[#222528] font-extrabold ${toneText(tone)}`
          : "border-transparent font-semibold text-[#626058] hover:text-[#9C9690]"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <Label className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#626058]">
        {label}
      </Label>
      {children}
    </label>
  );
}

function TextArea({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <textarea
      className="min-h-[72px] w-full resize-none rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2 text-sm leading-6 text-[#CCC6BA] outline-none placeholder:text-[#626058] focus:border-[#1EEAB0]"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  );
}

function TaskKindButton({
  active,
  icon,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: Tone;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-xs transition ${
        active ? toneSurface(tone) : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690] hover:border-[rgba(238,232,222,0.2)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: Tone | SubmissionStatus | string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[8px] border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${toneSurface(
        tone,
      )}`}
    >
      {children}
    </span>
  );
}

function ProofTag({ label }: { label: string }) {
  return (
    <span className="rounded-[7px] border border-[#1EEAB0] bg-[#0D0F12] px-2 py-1 font-mono text-[10px] uppercase text-[#1EEAB0]">
      {label}
    </span>
  );
}

function ChipButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`max-w-full truncate rounded-[7px] border px-3 py-1.5 font-mono text-[10px] uppercase ${
        active ? "border-[#1EEAB0] bg-[#061F18] text-[#1EEAB0]" : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#626058]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid size-8 place-items-center rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#141618] text-[#9C9690] transition hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
      onClick={onClick}
      type="button"
      title={label}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[9px] border border-dashed border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3 text-xs leading-5 text-[#9C9690]">
      <div className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#141618] text-[#626058] [&_svg]:size-4">
        {icon}
      </div>
      <span>{text}</span>
    </div>
  );
}

function StatusBanner({ message, tone }: { message: string; tone: Tone }) {
  return (
    <div className={`mb-3 flex items-start gap-2 rounded-[10px] border px-3 py-2 text-xs leading-5 ${toneSurface(tone)}`}>
      {tone === "red" ? <X className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
      <span>{message}</span>
    </div>
  );
}

function StatBox({ label, tone = "cyan", value }: { label: string; tone?: Tone; value: number | string }) {
  return (
    <div className={`min-h-[76px] rounded-[10px] border p-2.5 ${tonePanelSurface(tone)}`}>
      <div className="mt-1 text-xl font-extrabold tracking-normal text-[#EEE8DE]">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-normal text-[#9C9690]">{label}</div>
    </div>
  );
}

function Avatar({ name, tone }: { name: string; tone: "cyan" | "violet" }) {
  return (
    <div
      className={`grid size-8 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-bold ${
        tone === "cyan"
          ? "border-[#0B8060] bg-[#061F18] text-[#1EEAB0]"
          : "border-[#4A1A90] bg-[#160A2A] text-[#A060FF]"
      }`}
    >
      {getInitials(name)}
    </div>
  );
}

function RoomRow({ role, room }: { role: Role; room: HackRoom }) {
  return (
    <div className="flex items-start gap-3 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <Avatar name={room.name} tone={role === "host" ? "violet" : "cyan"} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[#EEE8DE]">{room.name}</div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#9C9690]">
          {room.description || `Hosted by ${room.hostName}`}
        </p>
        <div className="mt-1 font-mono text-[10px] text-[#626058]">
          {room.participants.length} participants - {room.inviteCode}
        </div>
      </div>
    </div>
  );
}

function ProfileField({ label, tone, value }: { label: string; tone?: Tone; value: string }) {
  return (
    <div className="mb-1.5 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#626058]">{label}</div>
      <div className={`mt-0.5 text-[13px] font-medium ${tone ? toneText(tone) : "text-[#EEE8DE]"}`}>{value}</div>
    </div>
  );
}

function getTone(tone: Tone | SubmissionStatus | string): Tone {
  if (tone === "submitted") return "violet";
  if (tone === "approved") return "cyan";
  if (tone === "winner") return "gold";
  if (tone === "returned") return "red";
  if (["cyan", "violet", "gold", "orange", "red", "lime", "sky"].includes(tone)) {
    return tone as Tone;
  }
  return "gold";
}

function toneSurface(tone: Tone | SubmissionStatus | string) {
  const normalizedTone = getTone(tone);
  return `${tonePanelSurface(normalizedTone)} ${toneText(normalizedTone)}`;
}

function tonePanelSurface(tone: Tone | SubmissionStatus | string) {
  const normalizedTone = getTone(tone);
  if (normalizedTone === "violet") return "border-[#4A1A90] bg-[#160A2A]";
  if (normalizedTone === "gold") return "border-[#8A6A00] bg-[#241A00]";
  if (normalizedTone === "orange") return "border-[#904200] bg-[#241000]";
  if (normalizedTone === "red") return "border-[#901E14] bg-[#280A08]";
  if (normalizedTone === "lime") return "border-[#3A6A10] bg-[#0E1C04]";
  if (normalizedTone === "sky") return "border-[#0C5888] bg-[#061428]";
  return "border-[#0B8060] bg-[#061F18]";
}

function toneText(tone: Tone, dim = false) {
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

function toneTopBorder(tone: Tone) {
  if (tone === "violet") return "border-t-[#4A1A90]";
  if (tone === "gold") return "border-t-[#8A6A00]";
  if (tone === "orange") return "border-t-[#904200]";
  if (tone === "red") return "border-t-[#901E14]";
  if (tone === "lime") return "border-t-[#3A6A10]";
  if (tone === "sky") return "border-t-[#0C5888]";
  return "border-t-[#0B8060]";
}

function normalizeTaskProofTypes(kind: TaskKind | AssignmentMode, proofTypes: ProofType[]) {
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

function getTaskProofTypes(task?: Pick<HackTask, "kind" | "proofTypes">) {
  if (task?.kind === "game") return defaultGameProofTypes;
  return normalizeTaskProofTypes(task?.kind ?? "task", task?.proofTypes ?? []);
}

function canViewTaskForRole(task: HackTask, role: Role, user: SessionUser) {
  if (role === "host") {
    return true;
  }

  if ((task.kind ?? "task") !== "special") {
    return true;
  }

  return (
    task.assignedToUserId === user.id ||
    task.assignedToEmail?.toLowerCase() === user.email.toLowerCase()
  );
}

function getHostTabFromSegment(segment: string): HostTab {
  return hostTabsBySegment[segment] ?? "quick";
}

function getParticipantTabFromSegment(segment: string): ParticipantTab {
  return participantTabsBySegment[segment] ?? "quick";
}

function isParticipantSubmitTask(task: HackTask) {
  return ["task", "special"].includes(task.kind ?? "task");
}

function buildProofItemsForTask(task: HackTask, submitForm: ReturnType<typeof makeEmptySubmitForm>) {
  return getTaskProofTypes(task).map((proofType) => ({
    type: proofType,
    value: submitForm.proofItems[proofType]?.trim() ?? "",
  }));
}

function hasRequiredProofItems(task: HackTask, submitForm: ReturnType<typeof makeEmptySubmitForm>) {
  return buildProofItemsForTask(task, submitForm).every((item) => item.value.trim().length >= 3);
}

function getSubmissionProofItems(
  submission: { proofItems?: Array<{ type: ProofType; value: string }>; proofUrl?: string },
) {
  if (submission.proofItems?.length) {
    return submission.proofItems;
  }
  return submission.proofUrl ? [{ type: "url" as const, value: submission.proofUrl }] : [];
}

function proofTypeLabel(proofType: ProofType) {
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

function proofTypePlaceholder(proofType: ProofType) {
  if (proofType === "github") return "https://github.com/team/project";
  if (proofType === "drive") return "https://drive.google.com/...";
  if (proofType === "video") return "https://youtu.be/...";
  if (proofType === "deck") return "https://slides.example.com/...";
  if (proofType === "game_score") return "Memory Match result - score 100";
  return "https://demo.example.com";
}

function proofTypeIcon(proofType: ProofType) {
  if (proofType === "github") return ExternalLink;
  if (proofType === "drive") return Database;
  if (proofType === "video") return Sparkles;
  if (proofType === "deck") return Presentation;
  if (proofType === "file") return FileText;
  if (proofType === "game_score") return Gamepad2;
  return LinkIcon;
}

function kindLabel(kind: TaskKind) {
  if (kind === "challenge") return "Challenge";
  if (kind === "game") return "Game";
  if (kind === "special") return "Special";
  return "Task";
}

function submissionStatusLabel(status: SubmissionStatus) {
  if (status === "approved") return "Verified";
  if (status === "winner") return "Winner";
  if (status === "returned") return "Returned";
  return "Submitted";
}

function submissionStatusHeadline(status: SubmissionStatus) {
  if (status === "approved") return "Proof verified";
  if (status === "winner") return "Winner announced";
  if (status === "returned") return "Proof returned";
  return "Proof sent for verification";
}

function statusTone(status?: SubmissionStatus): Tone {
  if (status === "approved") return "cyan";
  if (status === "winner") return "gold";
  if (status === "returned") return "red";
  if (status === "submitted") return "violet";
  return "gold";
}

function rewardKindLabel(kind: RewardKind) {
  if (kind === "participant_certificate") return "Certificate";
  if (kind === "winner_certificate") return "Winner Certificate";
  return "NFT Badge";
}

function buildLeaderboard(room: HackRoom | undefined, submissions: HackSubmission[], rewards: HackReward[]) {
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
    existing.points += submission.awardXrdm ?? (submission.status === "winner" ? submission.rewardXrdm ?? 0 : 0);
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

function getGameTypeInfo(gameType: GameType) {
  return gameTypeOptions.find((option) => option.value === gameType) ?? gameTypeOptions[0];
}

function makeMiniGameResult(gameType: GameType, score: number, detail: string): MiniGameResult {
  const gameInfo = getGameTypeInfo(gameType);
  return {
    gameType,
    notes: `Completed ${gameInfo.label}. ${detail}. Score: ${score}.`,
    proofValue: `${gameInfo.label} result - ${detail} - score ${score}`,
    score,
    title: gameInfo.label,
  };
}

function makeMemoryCards() {
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

function makeMathQuestion(seed: number) {
  const left = 8 + seed * 3 + Math.floor(Math.random() * 9);
  const right = 4 + seed * 2 + Math.floor(Math.random() * 7);
  if (seed % 3 === 2) {
    const smallLeft = 2 + (seed % 4);
    const smallRight = 5 + Math.floor(Math.random() * 5);
    return { answer: smallLeft * smallRight, prompt: `${smallLeft} x ${smallRight}` };
  }
  return { answer: left + right, prompt: `${left} + ${right}` };
}

function getEmailTokens(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmails(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(isEmailLike))];
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function friendlyMutationMessage(message: string) {
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

function toTitleCase(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function getInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "HR";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "Soon";
  }
  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

function toExternalUrl(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return `https://${value}`;
}
