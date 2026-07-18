import type { AppRouter } from "@rdm-hack/api/routers/index";
import { Ionicons } from "@expo/vector-icons";
import { useLoginWithEmail, usePrivy } from "@privy-io/expo";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { useNativePrivyBridge } from "@/components/privy-provider";
import { HACK_THEME as theme } from "@/lib/constants";
import { queryClient, trpc } from "@/utils/trpc";

const rdmLogo = require("@/assets/logo/rdm-logo.png");
const SCREEN_WIDTH = Dimensions.get("window").width;

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DashboardData = RouterOutputs["hackRoom"]["dashboard"];
type HackTask = DashboardData["tasks"][number];
type HackRoom = DashboardData["hostedRooms"][number];
type HackSubmission = DashboardData["hostSubmissions"][number];
type HackReward = DashboardData["rewards"][number];
type HackNotification = DashboardData["notifications"][number];
type Role = "member" | "host";
type TaskKind = "task" | "challenge" | "game" | "special";
type AssignmentMode = TaskKind | "notification";
type RoomTab =
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
type ParticipantTab = "games" | "history" | "submit" | "wallet";
type SubmissionStatus = DashboardData["mySubmissions"][number]["status"];
type ProofType = "github" | "drive" | "file" | "url" | "video" | "deck" | "game_score";
type RewardKind = HackReward["kind"];
type GameType = "memory_match" | "breath_timer" | "quick_maths";
type SubmissionProofItem = {
  type: ProofType;
  value: string;
};
type MiniGameResult = {
  gameType: GameType;
  notes: string;
  proofValue: string;
  score: number;
  title: string;
};
type MiniGameSession = {
  mode: "assignment" | "practice";
  task?: HackTask;
  type: GameType;
};
type Tone = "cyan" | "violet" | "gold" | "orange" | "red" | "lime" | "sky";
type SessionUser = {
  email: string;
  id: string;
  name: string;
};

const proofTypeOptions: Array<{ label: string; value: ProofType }> = [
  { label: "GitHub", value: "github" },
  { label: "Drive", value: "drive" },
  { label: "Video", value: "video" },
  { label: "Deck", value: "deck" },
  { label: "File", value: "file" },
  { label: "URL", value: "url" },
  { label: "Game Score", value: "game_score" },
];
const defaultRegularProofTypes: Array<ProofType> = ["github", "drive"];
const defaultSpotProofTypes: Array<ProofType> = ["url"];
const defaultGameProofTypes: Array<ProofType> = ["game_score"];
const defaultSpecialProofTypes: Array<ProofType> = ["url"];
const gameTypeOptions: Array<{
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

const privyEmailSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

const privyCodeSchema = privyEmailSchema.extend({
  code: z.string().trim().min(4, "Enter the code from your email").max(12, "Code is too long"),
});

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

function makeEmptyRewardForm() {
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
    proofUrl: "",
    submitterName,
    teamMateEmailDraft: "",
    teamMateEmails: [] as Array<string>,
    teamName: "",
  };
}

const emptySubmitForm = makeEmptySubmitForm();

export function NativeHomeScreen() {
  return <AuthenticatedRoute>{(user) => <HomeDashboard user={user} />}</AuthenticatedRoute>;
}

export function AuthenticatedTabs({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={theme.participant} />
        <Text style={styles.loadingText}>Opening Hack Room...</Text>
      </View>
    );
  }

  if (!session?.user) {
    return <AuthGateway />;
  }

  return children;
}

export function HackRoomHome() {
  return <HackRoomScreen />;
}

export function HackRoomScreen() {
  return <AuthenticatedRoute>{(user) => <HackRoomDashboard user={user} />}</AuthenticatedRoute>;
}

export function HackRoomDetailScreen({ roomId }: { roomId: string }) {
  return (
    <AuthenticatedRoute>
      {(user) => <HackRoomDetailDashboard roomId={roomId} user={user} />}
    </AuthenticatedRoute>
  );
}

export function ProfileScreen() {
  return <AuthenticatedRoute>{(user) => <ProfileDashboard user={user} />}</AuthenticatedRoute>;
}

function AuthenticatedRoute({
  children,
}: {
  children: (user: SessionUser) => React.ReactNode;
}) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={theme.participant} />
        <Text style={styles.loadingText}>Opening Hack Room...</Text>
      </View>
    );
  }

  if (!session?.user) {
    return <AuthGateway />;
  }

  return children(session.user);
}

function AuthGateway() {
  const { isReady, logout, user } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { clearLastError, isSyncing, lastError, retrySync } = useNativePrivyBridge();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [hasSentCode, setHasSentCode] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const resetError = () => {
    if (formError) {
      setFormError(null);
    }
    if (lastError) {
      clearLastError();
    }
  };

  const handleSendCode = async () => {
    const parsed = privyEmailSchema.safeParse({ email });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }

    setIsSendingCode(true);
    setFormError(null);
    clearLastError();

    try {
      await sendCode({ email: parsed.data.email });
      setHasSentCode(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to send an email code.");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    const parsed = privyCodeSchema.safeParse({ code, email });

    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Enter the code from your email");
      return;
    }

    setIsVerifyingCode(true);
    setFormError(null);
    clearLastError();

    try {
      await loginWithCode({
        code: parsed.data.code,
        email: parsed.data.email,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to verify the email code.");
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleUseDifferentEmail = async () => {
    setCode("");
    setHasSentCode(false);
    setFormError(null);
    clearLastError();

    const results = await Promise.allSettled([authClient.signOut(), logout()]);
    const failedReset = results.find((result) => result.status === "rejected");

    if (failedReset) {
      setFormError(
        failedReset.reason instanceof Error
          ? failedReset.reason.message
          : "Unable to reset sign-in.",
      );
    }
  };

  const isBusy = isSendingCode || isVerifyingCode || isSyncing;
  const isPrivyAuthenticated = Boolean(user);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.authScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.authBrandBlock}>
          <View style={styles.authLogoFrame}>
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="contain"
              source={rdmLogo}
              style={styles.authLogo}
            />
          </View>
          <View style={styles.authBrandText}>
            <Text style={styles.authEyebrow}>RDM Hack Room</Text>
            <Text style={styles.authHeadline}>Welcome back</Text>
          </View>
        </View>

        <View style={styles.authCard}>
          <View style={styles.authCardHeader}>
            <View style={styles.authIconBadge}>
              <Ionicons name="mail-unread-outline" size={20} color={theme.participant} />
            </View>
            <View style={styles.authTitleBlock}>
              <Text style={styles.formTitle}>Email access</Text>
            </View>
          </View>

          {!isReady ? (
            <StatusBanner message="Preparing secure sign-in..." tone="cyan" />
          ) : null}
          {isPrivyAuthenticated && isSyncing ? (
            <StatusBanner message="Creating your Hack Room session..." tone="violet" />
          ) : null}
          {formError ? <ErrorBanner message={formError} /> : null}
          {lastError ? <ErrorBanner message={lastError} /> : null}

          <Field label="Email">
            <HackTextInput
              autoCapitalize="none"
              editable={!hasSentCode && !isPrivyAuthenticated && !isBusy}
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                resetError();
              }}
              onSubmitEditing={handleSendCode}
              placeholder="you@example.com"
              style={styles.authInput}
              value={email}
            />
          </Field>

          {hasSentCode ? (
            <Field label="Email code">
              <HackTextInput
                autoCapitalize="none"
                editable={!isPrivyAuthenticated && !isBusy}
                keyboardType="number-pad"
                onChangeText={(value) => {
                  setCode(value);
                  resetError();
                }}
                onSubmitEditing={handleVerifyCode}
                placeholder="123456"
                style={styles.authInput}
                value={code}
              />
            </Field>
          ) : null}

          {hasSentCode ? (
            <HackButton
              disabled={!isReady || !code.trim() || isBusy || isPrivyAuthenticated}
              icon="checkmark-circle-outline"
              label={isSyncing ? "Syncing Session" : "Verify Code"}
              loading={isVerifyingCode || isSyncing}
              onPress={handleVerifyCode}
              tone="cyan"
            />
          ) : (
            <HackButton
              disabled={!isReady || !email.trim() || isBusy}
              icon="mail-outline"
              label="Send Email Code"
              loading={isSendingCode}
              onPress={handleSendCode}
              tone="cyan"
            />
          )}

          {hasSentCode || isPrivyAuthenticated ? (
            <View style={styles.authSecondaryActions}>
              {lastError ? (
                <HackButton
                  disabled={isSyncing}
                  icon="refresh-outline"
                  label="Retry Session"
                  loading={isSyncing}
                  onPress={() => {
                    void retrySync();
                  }}
                  tone="violet"
                />
              ) : null}
              <HackButton
                disabled={isBusy}
                icon="swap-horizontal-outline"
                label="Use Different Email"
                onPress={handleUseDifferentEmail}
                tone="red"
              />
            </View>
          ) : null}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeDashboard({ user }: { user: SessionUser }) {
  const router = useRouter();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  const stats = dashboard.data?.stats;
  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const recentSubmissions = dashboard.data?.mySubmissions ?? [];
  const notifications = dashboard.data?.notifications ?? [];

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(notifications),
      tone: notifications.length ? "violet" : "cyan",
    });
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={notifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardHero}>
          <Text style={styles.dashboardHeadline}>Home Hub</Text>
          <Text style={styles.dashboardCopy}>
            Welcome back, {firstName(user.name)}. Your room activity, pending reviews, and XRDM
            progress live here.
          </Text>

          <View style={styles.homeRoleTabs}>
            <View style={[styles.homeRoleTab, styles.homeRoleTabParticipant]}>
              <Ionicons name="person-outline" size={14} color={theme.participant} />
              <Text style={[styles.homeRoleTabText, styles.homeRoleTabTextParticipant]}>
                As Member
              </Text>
            </View>
            <View style={[styles.homeRoleTab, styles.homeRoleTabHost]}>
              <Ionicons name="trophy-outline" size={14} color={theme.host} />
              <Text style={[styles.homeRoleTabText, styles.homeRoleTabTextHost]}>
                As Organizer
              </Text>
            </View>
          </View>

          <View style={styles.profileCard}>
            <Avatar name={user.name} tone="cyan" />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            {dashboard.isLoading ? <ActivityIndicator color={theme.award} /> : null}
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="shield-checkmark-outline"
              label="Hosted"
              tone="violet"
              value={stats?.activeRooms ?? 0}
            />
            <MetricCard
              icon="enter-outline"
              label="Joined"
              tone="cyan"
              value={stats?.joinedRooms ?? 0}
            />
            <MetricCard
              icon="hourglass-outline"
              label="Reviews"
              tone="gold"
              value={stats?.pendingSubmissions ?? 0}
            />
          </View>

          <View style={styles.homeHubGrid}>
            <HomeHubTile
              icon="clipboard-outline"
              label="Assignments"
              meta="Due and past work"
              onPress={() => router.push("/hack-room")}
              tone="cyan"
            />
            <HomeHubTile
              icon="flash-outline"
              label="Spot Challenge"
              meta="Live room prompts"
              onPress={() => router.push("/hack-room")}
              tone="orange"
            />
            <HomeHubTile
              icon="game-controller-outline"
              label="Games"
              meta="Play mini games"
              onPress={() => router.push("/hack-room")}
              tone="lime"
            />
            <HomeHubTile
              icon="diamond-outline"
              label="Wallet"
              meta="XRDM, certs, NFTs"
              onPress={() => router.push("/profile")}
              tone="gold"
            />
          </View>
        </View>

        {dashboard.error ? <ErrorBanner message={dashboard.error.message} /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

        <Panel eyebrow="Overview" icon="grid-outline" title="Hack Room Snapshot" tone="cyan">
          <View style={styles.listStack}>
            {joinedRooms.length || hostedRooms.length ? (
              <>
                {hostedRooms.slice(0, 2).map((room) => (
                  <RoomCard key={room._id} role="host" room={room} />
                ))}
                {joinedRooms.slice(0, 2).map((room) => (
                  <RoomCard key={room._id} role="member" room={room} />
                ))}
              </>
            ) : (
              <EmptyState
                icon="home-outline"
                text="Create or join a hack room from the Hack Room tab to start seeing activity here."
              />
            )}
          </View>
        </Panel>

        <Panel eyebrow="Proof" icon="checkmark-circle-outline" title="Recent Submissions" tone="gold">
          <View style={styles.listStack}>
            {recentSubmissions.length ? (
              recentSubmissions
                .slice(0, 2)
                .map((submission) => <SubmissionCard key={submission._id} submission={submission} />)
            ) : (
              <EmptyState
                icon="checkmark-circle-outline"
                text="Your submitted proof records will appear here after you complete a task."
              />
            )}
          </View>
        </Panel>
      </ScrollView>
    </View>
  );
}

function ProfileDashboard({ user }: { user: SessionUser }) {
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const { logout } = usePrivy();
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  const stats = dashboard.data?.stats;
  const notifications = dashboard.data?.notifications ?? [];

  const handleSignOut = async () => {
    await Promise.allSettled([authClient.signOut(), logout()]);
    await queryClient.invalidateQueries();
  };

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(notifications),
      tone: notifications.length ? "violet" : "cyan",
    });
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={notifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardHero}>
          <View style={styles.profileHero}>
            <Avatar name={user.name} tone="cyan" />
            <View style={styles.profileText}>
              <Text style={styles.dashboardHeadline}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="flash-outline"
              label="Rooms"
              tone="cyan"
              value={(stats?.activeRooms ?? 0) + (stats?.joinedRooms ?? 0)}
            />
            <MetricCard
              icon="trophy-outline"
              label="Wins"
              tone="gold"
              value={stats?.winners ?? 0}
            />
            <MetricCard
              icon="people-outline"
              label="Network"
              tone="violet"
              value={stats?.participants ?? 0}
            />
          </View>
        </View>

        {dashboard.error ? <ErrorBanner message={dashboard.error.message} /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

        <Panel eyebrow="Account" icon="person-circle-outline" title="Profile" tone="cyan">
          <View style={styles.profileDetails}>
            <ProfileRow label="Name" value={user.name} />
            <ProfileRow label="Email" value={user.email} />
            <ProfileRow label="User ID" value={user.id} />
          </View>
          <HackButton icon="log-out-outline" label="Sign Out" onPress={handleSignOut} tone="red" />
        </Panel>
      </ScrollView>
    </View>
  );
}

function HackRoomDashboard({ user: _user }: { user: SessionUser }) {
  const router = useRouter();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const notifications = dashboard.data?.notifications ?? [];
  const viewerRole = dashboard.data?.viewerRole ?? "member";
  const canCreateRoom = viewerRole === "host";
  const allRooms = useMemo(() => {
    const seen = new Set<string>();
    const rooms: Array<{ role: Role; room: HackRoom }> = [];

    hostedRooms.forEach((room) => {
      seen.add(room._id);
      rooms.push({ role: "host", room });
    });
    joinedRooms.forEach((room) => {
      if (!seen.has(room._id)) {
        rooms.push({ role: "member", room });
      }
    });

    return rooms;
  }, [hostedRooms, joinedRooms]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
  };

  const createRoom = useMutation(
    trpc.hackRoom.createRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setCreateRoomModalOpen(false);
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

  const isBusy =
    createRoom.isPending ||
    joinRoom.isPending;

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(notifications),
      tone: notifications.length ? "violet" : "cyan",
    });
  };

  const handleShareCode = async (room: HackRoom) => {
    await Share.share({
      message: `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`,
      title: `${room.name} invite`,
    });
  };

  const handleCopyInviteCode = async (room: HackRoom) => {
    await copyInviteCodeToClipboard(room, setMessage);
  };

  const handleOpenRoom = (roomId: string) => {
    router.push({
      pathname: "/hack-room/[roomId]",
      params: { roomId },
    });
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={notifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isBusy ? (
          <View style={styles.compactBusyRow}>
            <ActivityIndicator color={theme.award} />
            <Text style={styles.mutedText}>Syncing Hack Room...</Text>
          </View>
        ) : null}


        <RoomCommandCenter
          createRoomPending={createRoom.isPending}
          createRoomModalOpen={createRoomModalOpen}
          inviteCode={inviteCode}
          joinRoomPending={joinRoom.isPending}
          canCreateRoom={canCreateRoom}
          onCreateRoom={() => {
            if (!canCreateRoom) {
              return;
            }

            createRoom.mutate(roomForm);
          }}
          onInviteCodeChange={setInviteCode}
          onJoinRoom={() => joinRoom.mutate({ inviteCode })}
          onRoomFormChange={setRoomForm}
          onSetCreateRoomModalOpen={setCreateRoomModalOpen}
          roomForm={roomForm}
        />

        <RoomShelf
          allRooms={allRooms}
          onCopyInvite={handleCopyInviteCode}
          onSelectRoom={handleOpenRoom}
          onShareRoom={handleShareCode}
        />

        {dashboard.isLoading ? (
          <Panel
            eyebrow="Sync"
            icon="cloud-download-outline"
            title="Loading Hack Room Data"
            tone="cyan"
          >
            <View style={styles.loadingInline}>
              <ActivityIndicator color={theme.participant} />
              <Text style={styles.mutedText}>Fetching rooms, tasks, and proof records.</Text>
            </View>
          </Panel>
        ) : null}

        {dashboard.error ? <ErrorBanner message={dashboard.error.message} /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      </ScrollView>
    </View>
  );
}

function HackRoomDetailDashboard({
  roomId,
  user,
}: {
  roomId: string;
  user: SessionUser;
}) {
  const router = useRouter();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [activeRoomTab, setActiveRoomTab] = useState<RoomTab | null>(null);
  const [activeParticipantTab, setActiveParticipantTab] = useState<ParticipantTab | null>(null);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskKind, setTaskKind] = useState<TaskKind>("task");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("task");
  const [proofTypes, setProofTypes] = useState<Array<ProofType>>(defaultRegularProofTypes);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [submitForm, setSubmitForm] = useState(() => makeEmptySubmitForm(user.name));
  const [rewardForm, setRewardForm] = useState(makeEmptyRewardForm());
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  const [feedbackBySubmission, setFeedbackBySubmission] = useState<Record<string, string>>({});
  const [awardBySubmission, setAwardBySubmission] = useState<Record<string, string>>({});

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const tasks = dashboard.data?.tasks ?? [];
  const mySubmissions = dashboard.data?.mySubmissions ?? [];
  const hostSubmissions = dashboard.data?.hostSubmissions ?? [];
  const visibleWinners = dashboard.data?.visibleWinners ?? [];
  const rewards = dashboard.data?.rewards ?? [];
  const notifications = dashboard.data?.notifications ?? [];
  const allRooms = useMemo(() => {
    const seen = new Set<string>();
    const rooms: Array<{ role: Role; room: HackRoom }> = [];

    hostedRooms.forEach((room) => {
      seen.add(room._id);
      rooms.push({ role: "host", room });
    });
    joinedRooms.forEach((room) => {
      if (!seen.has(room._id)) {
        rooms.push({ role: "member", room });
      }
    });

    return rooms;
  }, [hostedRooms, joinedRooms]);
  const selectedRoomEntry = allRooms.find((entry) => entry.room._id === roomId);
  const selectedRoom = selectedRoomEntry?.room;
  const selectedRoomRole = selectedRoomEntry?.role ?? "member";
  const roomTasks = useMemo(
    () => tasks.filter((task) => task.roomId === roomId),
    [roomId, tasks],
  );
  const roomSubmissions = useMemo(
    () => hostSubmissions.filter((submission) => submission.roomId === roomId),
    [hostSubmissions, roomId],
  );
  const roomMySubmissions = useMemo(
    () => mySubmissions.filter((submission) => submission.roomId === roomId),
    [mySubmissions, roomId],
  );
  const roomWinners = useMemo(
    () => visibleWinners.filter((submission) => submission.roomId === roomId),
    [roomId, visibleWinners],
  );
  const roomRewards = useMemo(
    () => rewards.filter((reward) => reward.roomId === roomId),
    [rewards, roomId],
  );
  const roomNotifications = useMemo(
    () => notifications.filter((notification) => notification.roomId === roomId),
    [notifications, roomId],
  );
  const myRoomRewards = useMemo(
    () => roomRewards.filter((reward) =>
      reward.recipients.some((recipient) => recipient.userId === user.id),
    ),
    [roomRewards, user.id],
  );
  const selectedTask = roomTasks.find((task) => task._id === selectedTaskId);
  const pendingHostSubmissions = roomSubmissions.filter(
    (submission) => submission.status === "submitted",
  );
  const approvedHostSubmissions = roomSubmissions.filter(
    (submission) => submission.status === "approved",
  );
  const historySubmissions = roomSubmissions.filter((submission) =>
    ["approved", "winner"].includes(submission.status),
  );
  const winnerSubmissions = roomSubmissions.filter((submission) => submission.status === "winner");

  useEffect(() => {
    if (!roomTasks.length) {
      if (selectedTaskId) {
        setSelectedTaskId("");
      }
      return;
    }

    if (!selectedTaskId || !roomTasks.some((task) => task._id === selectedTaskId)) {
      setSelectedTaskId(roomTasks[0]?._id ?? "");
    }
  }, [roomTasks, selectedTaskId]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
  };

  const createTask = useMutation(
    trpc.hackRoom.createTask.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setTaskForm(emptyTaskForm);
        setAssignmentMode("task");
        setTaskKind("task");
        setProofTypes(defaultRegularProofTypes);
        setMessage({ text: "Room assignment published", tone: "violet" });
        await invalidateDashboard();
      },
    }),
  );

  const sendRoomNotification = useMutation(
    trpc.hackRoom.sendRoomNotification.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setTaskForm(emptyTaskForm);
        setAssignmentMode("task");
        setMessage({ text: "Notification nudged to all room members", tone: "violet" });
        await invalidateDashboard();
      },
    }),
  );

  const submitProof = useMutation(
    trpc.hackRoom.submitProof.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setSubmitForm(makeEmptySubmitForm(user.name));
        setMessage({ text: "Proof submitted for host review", tone: "cyan" });
        await invalidateDashboard();
      },
    }),
  );

  const approveSubmission = useMutation(
    trpc.hackRoom.approveSubmission.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setMessage({ text: "Proof verified and added to room history", tone: "cyan" });
        await invalidateDashboard();
      },
    }),
  );

  const selectWinner = useMutation(
    trpc.hackRoom.selectWinner.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setMessage({ text: "Winner announced and XRDM award recorded", tone: "gold" });
        await invalidateDashboard();
      },
    }),
  );

  const returnSubmission = useMutation(
    trpc.hackRoom.returnSubmission.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setMessage({ text: "Submission returned with feedback", tone: "orange" });
        await invalidateDashboard();
      },
    }),
  );

  const issueReward = useMutation(
    trpc.hackRoom.issueReward.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setRewardForm(makeEmptyRewardForm());
        setMessage({ text: "Reward issued to the in-app ledger", tone: "gold" });
        await invalidateDashboard();
      },
    }),
  );

  const isBusy =
    createTask.isPending ||
    submitProof.isPending ||
    approveSubmission.isPending ||
    selectWinner.isPending ||
    returnSubmission.isPending ||
    issueReward.isPending ||
    sendRoomNotification.isPending;

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(roomNotifications),
      tone: roomNotifications.length ? "violet" : "cyan",
    });
  };

  const handleBackToRooms = () => {
    router.replace("/hack-room");
  };

  const handleShareCode = async (room: HackRoom) => {
    await Share.share({
      message: `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`,
      title: `${room.name} invite`,
    });
  };

  const handleCopyInviteCode = async (room: HackRoom) => {
    await copyInviteCodeToClipboard(room, setMessage);
  };

  const handleCreateTask = (kind: TaskKind) => {
    if (!selectedRoom) {
      setMessage({ text: "Room is still loading", tone: "red" });
      return;
    }
    if (selectedRoomRole !== "host") {
      setMessage({ text: "Only the host can publish inside this room", tone: "red" });
      return;
    }

    const taskProofTypes = normalizeTaskProofTypes(kind, proofTypes);

    createTask.mutate({
      assignedToEmail: kind === "special" ? taskForm.assignedToEmail : undefined,
      description: taskForm.description,
      dueAt: taskForm.dueAt,
      gameType: kind === "game" ? taskForm.gameType : undefined,
      kind,
      proofTypes: taskProofTypes,
      rewardXrdm: Number(taskForm.rewardXrdm),
      roomId: selectedRoom._id,
      title: taskForm.title,
    });
  };

  const handleSendRoomNotification = () => {
    if (!selectedRoom) {
      setMessage({ text: "Room is still loading", tone: "red" });
      return;
    }
    if (selectedRoomRole !== "host") {
      setMessage({ text: "Only the host can nudge this room", tone: "red" });
      return;
    }

    sendRoomNotification.mutate({
      message: taskForm.description,
      roomId: selectedRoom._id,
      title: taskForm.title,
    });
  };

  const handleSubmitProof = () => {
    if (!selectedTask) {
      setMessage({ text: "Choose an assignment before submitting proof", tone: "red" });
      return;
    }

    const submitterName = submitForm.submitterName.trim();
    const teamName = submitForm.teamName.trim();
    const submissionDescription = submitForm.description.trim();
    const rawTeamMateEmails = [
      ...submitForm.teamMateEmails,
      ...getEmailTokens(submitForm.teamMateEmailDraft),
    ];
    const invalidTeamMateEmails = getInvalidEmails(rawTeamMateEmails);
    const teamMateEmails = normalizeEmails(rawTeamMateEmails);

    if (!submitterName || !teamName || !submissionDescription) {
      setMessage({ text: "Add your name, team name, and submission description", tone: "red" });
      return;
    }

    if (invalidTeamMateEmails.length) {
      setMessage({
        text: `Check team mate email: ${invalidTeamMateEmails[0]}`,
        tone: "red",
      });
      return;
    }

    if (teamMateEmails.length > 20) {
      setMessage({ text: "Add up to 20 team mate emails", tone: "red" });
      return;
    }

    const proofItems = buildProofItemsForTask(selectedTask, submitForm);
    const missingProofTypes = proofItems
      .filter((item) => !item.value.trim())
      .map((item) => proofTypeLabel(item.type));

    if (missingProofTypes.length) {
      setMessage({ text: `Add required proof: ${missingProofTypes.join(", ")}`, tone: "red" });
      return;
    }

    submitProof.mutate({
      submissionDescription,
      submitterName,
      teamMateEmails,
      teamName,
      notes: submitForm.notes,
      proofItems,
      proofUrl: proofItems[0]?.value ?? "",
      roomId: selectedTask.roomId,
      taskId: selectedTask._id,
    });
  };

  const handleApproveSubmission = (submission: HackSubmission) => {
    const feedback =
      feedbackBySubmission[submission._id] ||
      submission.hostFeedback ||
      "Verified. Clear proof and solid contribution.";
    approveSubmission.mutate({
      hostFeedback: feedback,
      submissionId: submission._id,
    });
  };

  const handleReturnSubmission = (submission: HackSubmission) => {
    const feedback =
      feedbackBySubmission[submission._id] ||
      submission.hostFeedback ||
      "Thanks for the submission. Please add clearer proof and resubmit.";
    returnSubmission.mutate({
      hostFeedback: feedback,
      submissionId: submission._id,
    });
  };

  const handleSelectWinner = (submission: HackSubmission) => {
    const feedback =
      feedbackBySubmission[submission._id] ||
      submission.hostFeedback ||
      "Strong contribution and clear proof of participation.";
    const award = Number(
      awardBySubmission[submission._id] || submission.awardXrdm || submission.rewardXrdm || 20,
    );
    selectWinner.mutate({
      awardXrdm: award,
      hostFeedback: feedback,
      submissionId: submission._id,
    });
  };

  const handleIssueReward = (kind: RewardKind) => {
    if (!selectedRoom) {
      setMessage({ text: "Room is still loading", tone: "red" });
      return;
    }
    if (selectedRoomRole !== "host") {
      setMessage({ text: "Only the host can issue room rewards", tone: "red" });
      return;
    }

    const rawRecipientEmails = [
      ...rewardForm.recipientEmails,
      ...getEmailTokens(rewardForm.recipientEmailDraft),
    ];
    const invalidRecipientEmails = getInvalidEmails(rawRecipientEmails);
    const recipientEmails = normalizeEmails(rawRecipientEmails);
    const participantsByEmail = new Map(
      selectedRoom.participants.map((participant) => [
        participant.email.trim().toLowerCase(),
        participant,
      ]),
    );
    const missingRecipientEmail = recipientEmails.find(
      (email) => !participantsByEmail.has(email),
    );

    if (invalidRecipientEmails.length) {
      setMessage({ text: `Check recipient email: ${invalidRecipientEmails[0]}`, tone: "red" });
      return;
    }

    if (!recipientEmails.length) {
      setMessage({ text: "Add at least one recipient email", tone: "red" });
      return;
    }

    if (missingRecipientEmail) {
      setMessage({
        text: `${missingRecipientEmail} has not joined this room yet`,
        tone: "red",
      });
      return;
    }

    const sourceSubmissionId =
      kind === "participant_certificate"
        ? undefined
        : rewardForm.sourceSubmissionId || winnerSubmissions[0]?._id;
    const recipientIds = recipientEmails.map(
      (email) => participantsByEmail.get(email)?.userId ?? "",
    ).filter(Boolean);

    issueReward.mutate({
      awardXrdm: Number(rewardForm.awardXrdm || 0),
      description: rewardForm.description,
      kind,
      ledgerNote: rewardForm.ledgerNote,
      recipientIds,
      roomId: selectedRoom._id,
      sourceSubmissionId,
      title: rewardForm.title || defaultRewardTitle(kind),
    });
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={roomNotifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={handleBackToRooms}
          style={({ pressed }) => [styles.detailBackButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back-outline" size={18} color={theme.participant} />
          <Text style={styles.detailBackText}>Hack Rooms</Text>
        </Pressable>

        {isBusy ? (
          <View style={styles.compactBusyRow}>
            <ActivityIndicator color={theme.award} />
            <Text style={styles.mutedText}>Syncing room...</Text>
          </View>
        ) : null}

        {dashboard.isLoading ? (
          <Panel
            eyebrow="Sync"
            icon="cloud-download-outline"
            title="Loading Room"
            tone="cyan"
          >
            <View style={styles.loadingInline}>
              <ActivityIndicator color={theme.participant} />
              <Text style={styles.mutedText}>Fetching room details.</Text>
            </View>
          </Panel>
        ) : null}

        {dashboard.error ? <ErrorBanner message={dashboard.error.message} /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

        {selectedRoom ? (
          <RoomWorkspace
            activeParticipantTab={activeParticipantTab}
            activeRoomTab={activeRoomTab}
            assignmentMode={assignmentMode}
            approvedSubmissions={approvedHostSubmissions}
            approveSubmissionPending={approveSubmission.isPending}
            awardBySubmission={awardBySubmission}
            createTaskPending={createTask.isPending}
            feedbackBySubmission={feedbackBySubmission}
            historySubmissions={historySubmissions}
            mySubmissions={roomMySubmissions}
            onApproveSubmission={handleApproveSubmission}
            onCreateTask={handleCreateTask}
            onParticipantTabChange={setActiveParticipantTab}
            onReturnSubmission={handleReturnSubmission}
            onRoomTabChange={setActiveRoomTab}
            onCopyInvite={handleCopyInviteCode}
            onIssueReward={handleIssueReward}
            onSendRoomNotification={handleSendRoomNotification}
            onSelectTask={setSelectedTaskId}
            onSelectWinner={handleSelectWinner}
            onShareRoom={handleShareCode}
            onSubmitProof={handleSubmitProof}
            pendingSubmissions={pendingHostSubmissions}
            proofTypes={proofTypes}
            returnSubmissionPending={returnSubmission.isPending}
            rewardForm={rewardForm}
            rewards={selectedRoomRole === "host" ? roomRewards : myRoomRewards}
            room={selectedRoom}
            roomRole={selectedRoomRole}
            roomTasks={roomTasks}
            roomWinners={roomWinners}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            selectWinnerPending={selectWinner.isPending}
            sendRoomNotificationPending={sendRoomNotification.isPending}
            issueRewardPending={issueReward.isPending}
            setAwardBySubmission={setAwardBySubmission}
            setFeedbackBySubmission={setFeedbackBySubmission}
            setProofTypes={setProofTypes}
            setRewardForm={setRewardForm}
            setAssignmentMode={setAssignmentMode}
            setSubmitForm={setSubmitForm}
            setTaskForm={setTaskForm}
            setTaskKind={setTaskKind}
            submitForm={submitForm}
            submitProofPending={submitProof.isPending}
            taskForm={taskForm}
            taskKind={taskKind}
            winnerSubmissions={winnerSubmissions}
          />
        ) : !dashboard.isLoading ? (
          <Panel eyebrow="Room" icon="alert-circle-outline" title="Room Not Found" tone="red">
            <EmptyState
              icon="flash-outline"
              text="This room is not available for your account. Go back and choose one of your rooms."
            />
            <HackButton
              icon="arrow-back-outline"
              label="Back to Hack Rooms"
              onPress={handleBackToRooms}
              tone="cyan"
            />
          </Panel>
        ) : null}
      </ScrollView>
    </View>
  );
}

function RoomCommandCenter({
  canCreateRoom,
  createRoomPending,
  createRoomModalOpen,
  inviteCode,
  joinRoomPending,
  onCreateRoom,
  onInviteCodeChange,
  onJoinRoom,
  onRoomFormChange,
  onSetCreateRoomModalOpen,
  roomForm,
}: {
  canCreateRoom: boolean;
  createRoomPending: boolean;
  createRoomModalOpen: boolean;
  inviteCode: string;
  joinRoomPending: boolean;
  onCreateRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  onSetCreateRoomModalOpen: (open: boolean) => void;
  roomForm: typeof emptyRoomForm;
}) {
  return (
    <>
      <Panel
        action={
          canCreateRoom ? (
            <Pressable
              accessibilityLabel="Create hack room"
              accessibilityRole="button"
              onPress={() => onSetCreateRoomModalOpen(true)}
              style={({ pressed }) => [styles.createRoomTrigger, pressed && styles.pressed]}
            >
              <Ionicons name="add-outline" size={18} color="#060214" />
              <Text style={styles.createRoomTriggerText}>Create</Text>
            </Pressable>
          ) : null
        }
        eyebrow="Lobby"
        icon="key-outline"
        title="Join Hack Room"
        tone="cyan"
      >
        <View style={styles.inviteJoinRow}>
          <View style={styles.inviteInputColumn}>
            <Text style={styles.fieldLabel}>Enter invite code</Text>
            <HackTextInput
              autoCapitalize="characters"
              onChangeText={onInviteCodeChange}
              placeholder="HR-ABC123"
              value={inviteCode}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!inviteCode.trim() || joinRoomPending}
            onPress={onJoinRoom}
            style={({ pressed }) => [
              styles.joinTightButton,
              (!inviteCode.trim() || joinRoomPending) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {joinRoomPending ? (
              <ActivityIndicator color="#03120c" />
            ) : (
              <>
                <Ionicons name="enter-outline" size={18} color="#03120c" />
                <Text style={styles.joinTightText}>Join</Text>
              </>
            )}
          </Pressable>
        </View>

      </Panel>

      {canCreateRoom ? (
        <Modal
          animationType="fade"
          onRequestClose={() => onSetCreateRoomModalOpen(false)}
          transparent
          visible={createRoomModalOpen}
        >
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={styles.modalKeyboardView}
            >
              <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleBlock}>
                  <Text style={styles.sectionEyebrow}>Host</Text>
                  <Text style={styles.modalTitle}>Create Hack Room</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close create room"
                  accessibilityRole="button"
                  onPress={() => onSetCreateRoomModalOpen(false)}
                  style={({ pressed }) => [styles.modalCloseButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close-outline" size={22} color={theme.text} />
                </Pressable>
              </View>

              <StatusPill label="Host owns room" tone="violet" />

              <Field label="Room name">
                <HackTextInput
                  onChangeText={(value) =>
                    onRoomFormChange((current) => ({ ...current, name: value }))
                  }
                  placeholder="AI Agents Sprint"
                  value={roomForm.name}
                />
              </Field>
              <Field label="Room brief">
                <HackTextInput
                  multiline
                  onChangeText={(value) =>
                    onRoomFormChange((current) => ({ ...current, description: value }))
                  }
                  placeholder="Members build and submit working demos by deadline."
                  style={styles.textArea}
                  value={roomForm.description}
                />
              </Field>
              <View style={styles.modalActions}>
                <HackButton
                  disabled={createRoomPending}
                  label="Cancel"
                  onPress={() => onSetCreateRoomModalOpen(false)}
                  tone="red"
                />
                <HackButton
                  disabled={!roomForm.name.trim() || createRoomPending}
                  icon="add-outline"
                  label="Create Room"
                  loading={createRoomPending}
                  onPress={onCreateRoom}
                  tone="violet"
                />
              </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

function RoomShelf({
  allRooms,
  onCopyInvite,
  onSelectRoom,
  onShareRoom,
}: {
  allRooms: Array<{ role: Role; room: HackRoom }>;
  onCopyInvite: (room: HackRoom) => void;
  onSelectRoom: (roomId: string) => void;
  onShareRoom: (room: HackRoom) => void;
}) {
  return (
    <View style={styles.roomShelfSection}>
      <View style={styles.roomShelfHeaderOutside}>
        <View>
          <Text style={styles.sectionEyebrow}>Your Hack Rooms</Text>
          <Text style={styles.roomShelfTitle}>Select a room to open details</Text>
        </View>
        <CounterLabel label={`${allRooms.length} active`} />
      </View>
      {allRooms.length ? (
        <ScrollView
          contentContainerStyle={styles.roomShelf}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {allRooms.map(({ role, room }) => (
            <SelectableRoomCard
              key={room._id}
              onCopyInvite={() => onCopyInvite(room)}
              onPress={() => onSelectRoom(room._id)}
              onShare={() => onShareRoom(room)}
              role={role}
              room={room}
              selected={false}
            />
          ))}
        </ScrollView>
      ) : (
        <EmptyState icon="flash-outline" text="Created and joined rooms will appear here." />
      )}
    </View>
  );
}

function SelectableRoomCard({
  onCopyInvite,
  onPress,
  onShare,
  role,
  room,
  selected,
}: {
  onCopyInvite: () => void;
  onPress: () => void;
  onShare: () => void;
  role: Role;
  room: HackRoom;
  selected: boolean;
}) {
  const tone = role === "host" ? "violet" : "cyan";
  return (
    <View style={[styles.selectableRoomCard, selected && styles.selectableRoomCardActive]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.selectableRoomContent, pressed && styles.pressed]}
      >
        <View style={styles.cardTopRow}>
          <StatusPill label={role} tone={tone} />
          <View style={styles.roomShareIconSpacer} />
        </View>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {room.name}
        </Text>
        <Text numberOfLines={2} style={styles.cardDescription}>
          {room.description || `Hosted by ${room.hostName}`}
        </Text>
        <View style={styles.inviteMiniRow}>
          <Ionicons name="key-outline" size={14} color={theme.host} />
          <Text numberOfLines={1} style={styles.inviteMiniText}>
            {room.inviteCode}
          </Text>
        </View>
        <Text style={styles.cardMeta}>{room.participants.length} members</Text>
      </Pressable>
      <View style={styles.roomShareFloatingWrap}>
        {role === "host" ? (
          <Pressable
            accessibilityLabel={`Copy invite code ${room.inviteCode}`}
            accessibilityRole="button"
            onPress={onCopyInvite}
            style={({ pressed }) => [styles.roomShareIcon, pressed && styles.pressed]}
          >
            <Ionicons name="copy-outline" size={15} color={theme.muted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={`Share invite code ${room.inviteCode}`}
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [styles.roomShareIcon, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={15} color={theme.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function RoomWorkspace({
  activeParticipantTab,
  activeRoomTab,
  assignmentMode,
  approvedSubmissions,
  approveSubmissionPending,
  awardBySubmission,
  createTaskPending,
  feedbackBySubmission,
  historySubmissions,
  issueRewardPending,
  mySubmissions,
  onApproveSubmission,
  onCopyInvite,
  onCreateTask,
  onIssueReward,
  onParticipantTabChange,
  onReturnSubmission,
  onRoomTabChange,
  onSendRoomNotification,
  onSelectTask,
  onSelectWinner,
  onShareRoom,
  onSubmitProof,
  pendingSubmissions,
  proofTypes,
  returnSubmissionPending,
  rewardForm,
  rewards,
  room,
  roomRole,
  roomTasks,
  roomWinners,
  selectedTask,
  selectedTaskId,
  selectWinnerPending,
  sendRoomNotificationPending,
  setAwardBySubmission,
  setAssignmentMode,
  setFeedbackBySubmission,
  setProofTypes,
  setRewardForm,
  setSubmitForm,
  setTaskForm,
  setTaskKind,
  submitForm,
  submitProofPending,
  taskForm,
  taskKind,
  winnerSubmissions,
}: {
  activeParticipantTab: ParticipantTab | null;
  activeRoomTab: RoomTab | null;
  assignmentMode: AssignmentMode;
  approvedSubmissions: DashboardData["hostSubmissions"];
  approveSubmissionPending: boolean;
  awardBySubmission: Record<string, string>;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  historySubmissions: DashboardData["hostSubmissions"];
  issueRewardPending: boolean;
  mySubmissions: DashboardData["mySubmissions"];
  onApproveSubmission: (submission: HackSubmission) => void;
  onCopyInvite: (room: HackRoom) => void;
  onCreateTask: (kind: TaskKind) => void;
  onIssueReward: (kind: RewardKind) => void;
  onParticipantTabChange: (tab: ParticipantTab | null) => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRoomTabChange: (tab: RoomTab | null) => void;
  onSendRoomNotification: () => void;
  onSelectTask: (taskId: string) => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareRoom: (room: HackRoom) => void;
  onSubmitProof: () => void;
  pendingSubmissions: DashboardData["hostSubmissions"];
  proofTypes: Array<ProofType>;
  returnSubmissionPending: boolean;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: Array<HackReward>;
  room: HackRoom;
  roomRole: Role;
  roomTasks: DashboardData["tasks"];
  roomWinners: DashboardData["visibleWinners"];
  selectedTask?: HackTask;
  selectedTaskId: string;
  selectWinnerPending: boolean;
  sendRoomNotificationPending: boolean;
  setAwardBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setAssignmentMode: React.Dispatch<React.SetStateAction<AssignmentMode>>;
  setFeedbackBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setProofTypes: React.Dispatch<React.SetStateAction<Array<ProofType>>>;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  setTaskKind: React.Dispatch<React.SetStateAction<TaskKind>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
  taskForm: typeof emptyTaskForm;
  taskKind: TaskKind;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const tone = roomRole === "host" ? "violet" : "cyan";
  const focusedActionOpen =
    roomRole === "host" ? Boolean(activeRoomTab) : Boolean(activeParticipantTab);

  return (
    <View style={styles.roomWorkspace}>
      {!focusedActionOpen ? (
        <>
          <View style={styles.roomWorkspaceHeader}>
            <View style={styles.roomWorkspaceTitleBlock}>
              <Text style={styles.sectionEyebrow}>Inside Hack Room</Text>
              <Text numberOfLines={1} style={styles.roomWorkspaceTitle}>
                {room.name}
              </Text>
              <Text numberOfLines={2} style={styles.cardDescription}>
                {room.description || `Hosted by ${room.hostName}`}
              </Text>
            </View>
            <StatusPill label={roomRole} tone={tone} />
          </View>

          <View style={styles.roomStatsGrid}>
            <MiniStat icon="people-outline" label="Members" value={room.participants.length} />
            <MiniStat icon="clipboard-outline" label="Tasks" value={roomTasks.length} />
            <MiniStat icon="trophy-outline" label="Winners" value={roomWinners.length} />
          </View>

          {roomRole === "host" ? (
            <TrackLabel label="Organizer track" tone="violet" />
          ) : (
            <TrackLabel label="Member track" tone="cyan" />
          )}
        </>
      ) : null}

      {roomRole === "host" ? (
        <HostRoomWorkspace
          activeRoomTab={activeRoomTab}
          assignmentMode={assignmentMode}
          approvedSubmissions={approvedSubmissions}
          approveSubmissionPending={approveSubmissionPending}
          awardBySubmission={awardBySubmission}
          createTaskPending={createTaskPending}
          feedbackBySubmission={feedbackBySubmission}
          historySubmissions={historySubmissions}
          issueRewardPending={issueRewardPending}
          onApproveSubmission={onApproveSubmission}
          onCopyInvite={onCopyInvite}
          onCreateTask={onCreateTask}
          onIssueReward={onIssueReward}
          onReturnSubmission={onReturnSubmission}
          onRoomTabChange={onRoomTabChange}
          onSendRoomNotification={onSendRoomNotification}
          onSelectWinner={onSelectWinner}
          onShareRoom={onShareRoom}
          pendingSubmissions={pendingSubmissions}
          proofTypes={proofTypes}
          returnSubmissionPending={returnSubmissionPending}
          rewardForm={rewardForm}
          rewards={rewards}
          room={room}
          roomTasks={roomTasks}
          selectWinnerPending={selectWinnerPending}
          sendRoomNotificationPending={sendRoomNotificationPending}
          setAwardBySubmission={setAwardBySubmission}
          setAssignmentMode={setAssignmentMode}
          setFeedbackBySubmission={setFeedbackBySubmission}
          setProofTypes={setProofTypes}
          setRewardForm={setRewardForm}
          setTaskForm={setTaskForm}
          setTaskKind={setTaskKind}
          taskForm={taskForm}
          taskKind={taskKind}
          winnerSubmissions={winnerSubmissions}
        />
      ) : (
        <ParticipantRoomWorkspace
          activeParticipantTab={activeParticipantTab}
          mySubmissions={mySubmissions}
          onParticipantTabChange={onParticipantTabChange}
          onSelectTask={onSelectTask}
          onSubmitProof={onSubmitProof}
          roomTasks={roomTasks}
          roomWinners={roomWinners}
          rewards={rewards}
          selectedTask={selectedTask}
          selectedTaskId={selectedTaskId}
          setSubmitForm={setSubmitForm}
          submitForm={submitForm}
          submitProofPending={submitProofPending}
        />
      )}
    </View>
  );
}

function HostRoomWorkspace({
  activeRoomTab,
  assignmentMode,
  approvedSubmissions,
  approveSubmissionPending,
  awardBySubmission,
  createTaskPending,
  feedbackBySubmission,
  historySubmissions,
  issueRewardPending,
  onApproveSubmission,
  onCopyInvite,
  onCreateTask,
  onIssueReward,
  onReturnSubmission,
  onRoomTabChange,
  onSendRoomNotification,
  onSelectWinner,
  onShareRoom,
  pendingSubmissions,
  proofTypes,
  returnSubmissionPending,
  rewardForm,
  rewards,
  room,
  roomTasks,
  selectWinnerPending,
  sendRoomNotificationPending,
  setAwardBySubmission,
  setAssignmentMode,
  setFeedbackBySubmission,
  setProofTypes,
  setRewardForm,
  setTaskForm,
  setTaskKind,
  taskForm,
  taskKind,
  winnerSubmissions,
}: {
  activeRoomTab: RoomTab | null;
  assignmentMode: AssignmentMode;
  approvedSubmissions: DashboardData["hostSubmissions"];
  approveSubmissionPending: boolean;
  awardBySubmission: Record<string, string>;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  historySubmissions: DashboardData["hostSubmissions"];
  issueRewardPending: boolean;
  onApproveSubmission: (submission: HackSubmission) => void;
  onCopyInvite: (room: HackRoom) => void;
  onCreateTask: (kind: TaskKind) => void;
  onIssueReward: (kind: RewardKind) => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRoomTabChange: (tab: RoomTab | null) => void;
  onSendRoomNotification: () => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareRoom: (room: HackRoom) => void;
  pendingSubmissions: DashboardData["hostSubmissions"];
  proofTypes: Array<ProofType>;
  returnSubmissionPending: boolean;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: Array<HackReward>;
  room: HackRoom;
  roomTasks: DashboardData["tasks"];
  selectWinnerPending: boolean;
  sendRoomNotificationPending: boolean;
  setAwardBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setAssignmentMode: React.Dispatch<React.SetStateAction<AssignmentMode>>;
  setFeedbackBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setProofTypes: React.Dispatch<React.SetStateAction<Array<ProofType>>>;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  setTaskKind: React.Dispatch<React.SetStateAction<TaskKind>>;
  taskForm: typeof emptyTaskForm;
  taskKind: TaskKind;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const [historyTaskId, setHistoryTaskId] = useState("");
  const [winnerSearch, setWinnerSearch] = useState("");
  const leaderboardRows = winnerSubmissions
    .reduce<
      Array<{
        awardXrdm: number;
        email: string;
        id: string;
        name: string;
        wins: number;
      }>
    >((rows, submission) => {
      const existing = rows.find((row) => row.id === submission.participantId);
      const award = submission.awardXrdm ?? submission.rewardXrdm ?? 0;

      if (existing) {
        existing.awardXrdm += award;
        existing.wins += 1;
      } else {
        rows.push({
          awardXrdm: award,
          email: submission.participantEmail,
          id: submission.participantId,
          name: submission.participantName,
          wins: 1,
        });
      }

      return rows;
    }, [])
    .sort((left, right) => right.awardXrdm - left.awardXrdm);
  const normalizedWinnerSearch = winnerSearch.trim().toLowerCase();
  const filteredApprovedSubmissions = normalizedWinnerSearch
    ? approvedSubmissions.filter((submission) =>
        [
          submission.teamName,
          submission.submitterName,
          submission.participantName,
          submission.participantEmail,
          submission.taskTitle,
          submission.roomName,
          ...(submission.teamMateEmails ?? []),
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedWinnerSearch)),
      )
    : approvedSubmissions;
  const hostQuickActions: Array<{
    icon: React.ComponentProps<typeof Ionicons>["name"];
    id: RoomTab;
    label: string;
  }> = [
    { icon: "clipboard-outline", id: "assign", label: "Assignments" },
    { icon: "layers-outline", id: "created", label: "Created Tasks" },
    { icon: "people-outline", id: "participants", label: "Members" },
    { icon: "shield-checkmark-outline", id: "verify", label: "Verify" },
    { icon: "time-outline", id: "history", label: "History" },
    { icon: "trophy-outline", id: "winners", label: "Announce Winners" },
    { icon: "ribbon-outline", id: "awards", label: "Awards" },
    { icon: "game-controller-outline", id: "games", label: "Games" },
    { icon: "podium-outline", id: "leaderboard", label: "Leaderboard" },
    { icon: "person-circle-outline", id: "profile", label: "Profile" },
  ];
  const activeAction = hostQuickActions.find((action) => action.id === activeRoomTab);

  if (!activeRoomTab) {
    return (
      <View style={styles.trackStack}>
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionGrid}>
            {hostQuickActions.map((action) => (
              <QuickActionTile
                active={false}
                icon={action.icon}
                key={action.id}
                label={action.label}
                onPress={() => onRoomTabChange(action.id)}
                tone="violet"
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.trackStack}>
      <View style={styles.actionScreenHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onRoomTabChange(null)}
          style={({ pressed }) => [styles.actionBackButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back-outline" size={17} color={theme.host} />
          <Text style={styles.actionBackText}>Quick Actions</Text>
        </Pressable>
        <View style={styles.actionTitleBlock}>
          <Text style={styles.sectionEyebrow}>Host Action</Text>
          <Text numberOfLines={2} style={styles.actionScreenTitle}>
            {activeAction?.label ?? "Host Action"}
          </Text>
        </View>
      </View>

      {activeRoomTab === "participants" ? (
        <Panel
          action={<CounterLabel label={`${room.participants.length} joined`} />}
          eyebrow="Host Menu"
          icon="people-outline"
          title="Members"
          tone="violet"
        >
          <View style={styles.inviteStrip}>
            <Ionicons name="key-outline" size={16} color={theme.host} />
            <Text numberOfLines={1} style={styles.inviteCode}>
              {room.inviteCode}
            </Text>
            <InviteActionButton
              accessibilityLabel={`Copy invite code ${room.inviteCode}`}
              icon="copy-outline"
              label="Copy"
              onPress={() => onCopyInvite(room)}
            />
            <InviteActionButton
              accessibilityLabel={`Share invite code ${room.inviteCode}`}
              icon="share-outline"
              label="Share"
              onPress={() => onShareRoom(room)}
            />
          </View>
          <View style={styles.listStack}>
            {room.participants.length ? (
              room.participants.map((participant) => (
                <ParticipantListItem key={participant.userId} participant={participant} />
              ))
            ) : (
              <EmptyState
                icon="people-outline"
                text="Share the invite code. Joined members will appear here."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "assign" ? (
        <AssignmentComposer
          createTaskPending={createTaskPending || sendRoomNotificationPending}
          fixedKind={assignmentMode}
          onKindChange={(kind) => {
            setAssignmentMode(kind);
            if (kind !== "notification") {
              setTaskKind(kind);
            }
            setProofTypes(
              kind === "task"
                ? defaultRegularProofTypes
                : kind === "special"
                  ? defaultSpecialProofTypes
                  : defaultSpotProofTypes,
            );
            setTaskForm({
              ...emptyTaskForm,
              rewardXrdm: kind === "task" ? "20" : kind === "special" ? "15" : "10",
            });
          }}
          onCreateTask={onCreateTask}
          onSendNotification={onSendRoomNotification}
          proofTypes={proofTypes}
          sendNotificationPending={sendRoomNotificationPending}
          setProofTypes={setProofTypes}
          setTaskForm={setTaskForm}
          showAssignmentToggle
          taskForm={taskForm}
          title="Create Assignment"
        />
      ) : null}

      {activeRoomTab === "created" ? (
        <HostCreatedTasksPanel
          historySubmissions={historySubmissions}
          onOpenTaskHistory={(taskId) => {
            setHistoryTaskId(taskId);
            onRoomTabChange("history");
          }}
          roomTasks={roomTasks}
        />
      ) : null}

      {activeRoomTab === "verify" ? (
        <Panel
          action={<CounterLabel label={`${pendingSubmissions.length} pending`} />}
          eyebrow="Verification"
          icon="ribbon-outline"
          title="Review Queue"
          tone="violet"
        >
          <View style={styles.listStack}>
            {pendingSubmissions.length ? (
              pendingSubmissions.map((submission) => (
                <SubmissionReviewCard
                  approveSubmissionPending={approveSubmissionPending}
                  feedback={
                    feedbackBySubmission[submission._id] ??
                    submission.hostFeedback ??
                    "Verified. Clear proof and solid contribution."
                  }
                  key={submission._id}
                  mode="review"
                  onApprove={() => onApproveSubmission(submission)}
                  onFeedbackChange={(value) =>
                    setFeedbackBySubmission((current) => ({
                      ...current,
                      [submission._id]: value,
                    }))
                  }
                  onReturn={() => onReturnSubmission(submission)}
                  returnSubmissionPending={returnSubmissionPending}
                  submission={submission}
                />
              ))
            ) : (
              <EmptyState
                icon="ribbon-outline"
                text="Member proof waiting for host review will appear here."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "history" ? (
        <HostTaskHistoryPanel
          historySubmissions={historySubmissions}
          onSelectTask={setHistoryTaskId}
          roomTasks={roomTasks}
          selectedTaskId={historyTaskId}
        />
      ) : null}

      {activeRoomTab === "games" ? <HostGamesPanel /> : null}

      {activeRoomTab === "winners" ? (
        <Panel
          action={<CounterLabel label={`${filteredApprovedSubmissions.length}/${approvedSubmissions.length} ready`} />}
          eyebrow="Winner Selection"
          icon="trophy-outline"
          title="Announce Winners"
          tone="gold"
        >
          <Field label="Search team">
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={16} color={theme.dim} />
              <HackTextInput
                autoCapitalize="none"
                onChangeText={setWinnerSearch}
                placeholder="Search team, student, email, or assignment"
                style={styles.searchInput}
                value={winnerSearch}
              />
              {winnerSearch.trim() ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setWinnerSearch("")}
                  style={({ pressed }) => [styles.searchClearButton, pressed && styles.pressed]}
                >
                  <Ionicons name="close-outline" size={15} color={theme.award} />
                </Pressable>
              ) : null}
            </View>
          </Field>
          <View style={styles.listStack}>
            {approvedSubmissions.length ? (
              filteredApprovedSubmissions.length ? (
                filteredApprovedSubmissions.map((submission) => (
                  <SubmissionReviewCard
                    award={
                      awardBySubmission[submission._id] ??
                      String(submission.awardXrdm ?? submission.rewardXrdm ?? 20)
                    }
                    feedback={
                      feedbackBySubmission[submission._id] ??
                      submission.hostFeedback ??
                      "Strong contribution and clear proof of participation."
                    }
                    key={submission._id}
                    mode="winner"
                    onAwardChange={(value) =>
                      setAwardBySubmission((current) => ({ ...current, [submission._id]: value }))
                    }
                    onFeedbackChange={(value) =>
                      setFeedbackBySubmission((current) => ({
                        ...current,
                        [submission._id]: value,
                      }))
                    }
                    onSelectWinner={() => onSelectWinner(submission)}
                    selectWinnerPending={selectWinnerPending}
                    submission={submission}
                  />
                ))
              ) : (
                <EmptyState
                  icon="search-outline"
                  text="No verified submission matches this search."
                />
              )
            ) : (
              <EmptyState
                icon="trophy-outline"
                text="Verify proof from the review queue before announcing winners."
              />
            )}
          </View>
          <View style={styles.divider} />
          <Text style={styles.sectionEyebrow}>Winners Picked</Text>
          <View style={styles.listStack}>
            {winnerSubmissions.length ? (
              winnerSubmissions.map((submission) => (
                <SubmissionCard key={submission._id} submission={submission} />
              ))
            ) : (
              <EmptyState
                icon="trophy-outline"
                text="Announced winners will appear here with awarded XRDM."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "awards" ? (
        <HostAwardsPanel
          issueRewardPending={issueRewardPending}
          onIssueReward={onIssueReward}
          rewardForm={rewardForm}
          rewards={rewards}
          room={room}
          setRewardForm={setRewardForm}
          winnerSubmissions={winnerSubmissions}
        />
      ) : null}

      {activeRoomTab === "leaderboard" ? (
        <Panel
          action={<CounterLabel label={`${leaderboardRows.length} ranked`} />}
          eyebrow="Room Rank"
          icon="podium-outline"
          title="Leaderboard"
          tone="gold"
        >
          <View style={styles.listStack}>
            {leaderboardRows.length ? (
              leaderboardRows.map((row, index) => (
                <View key={row.id} style={styles.leaderboardRow}>
                  <Text style={styles.leaderboardRank}>#{index + 1}</Text>
                  <View style={styles.profileText}>
                    <Text style={styles.profileName}>{row.name}</Text>
                    <Text style={styles.profileEmail}>{row.email}</Text>
                  </View>
                  <View style={styles.leaderboardScore}>
                    <Text style={styles.awardText}>+{row.awardXrdm} XRDM</Text>
                    <Text style={styles.cardMeta}>{row.wins} wins</Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                icon="podium-outline"
                text="Announced winners will create the room leaderboard."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "profile" ? (
        <Panel eyebrow="Room" icon="person-circle-outline" title="Profile" tone="violet">
          <View style={styles.profileDetails}>
            <ProfileRow label="Room name" value={room.name} />
            <ProfileRow label="Host" value={room.hostName} />
            <ProfileRow label="Invite code" value={room.inviteCode} />
            <ProfileRow label="Status" value={room.status} />
          </View>
          <HackButton
            icon="share-outline"
            label="Share Invite"
            onPress={() => onShareRoom(room)}
            tone="violet"
          />
        </Panel>
      ) : null}
    </View>
  );
}

function HostCreatedTasksPanel({
  historySubmissions,
  onOpenTaskHistory,
  roomTasks,
}: {
  historySubmissions: DashboardData["hostSubmissions"];
  onOpenTaskHistory: (taskId: string) => void;
  roomTasks: DashboardData["tasks"];
}) {
  const taskKinds: Array<{
    icon: React.ComponentProps<typeof Ionicons>["name"];
    kind: TaskKind;
    label: string;
  }> = [
    { icon: "clipboard-outline", kind: "task", label: "Regular" },
    { icon: "person-outline", kind: "special", label: "Special" },
    { icon: "sparkles-outline", kind: "challenge", label: "Challenge" },
  ];

  const historyCountByTask = new Map<string, number>();
  historySubmissions.forEach((submission) => {
    historyCountByTask.set(submission.taskId, (historyCountByTask.get(submission.taskId) ?? 0) + 1);
  });

  return (
    <Panel
      action={<CounterLabel label={`${roomTasks.length} created`} />}
      eyebrow="Host Menu"
      icon="layers-outline"
      title="Created Tasks"
      tone="violet"
    >
      <View style={styles.createdTasksBlock}>
      <View style={styles.createdTaskKindGrid}>
        {taskKinds.map((taskKind) => {
          const count = roomTasks.filter((task) => (task.kind ?? "task") === taskKind.kind).length;
          const toneColors = getToneColors(taskKindTone(taskKind.kind));

          return (
            <View
              key={taskKind.kind}
              style={[
                styles.createdTaskKindChip,
                { backgroundColor: toneColors.bg, borderColor: toneColors.border },
              ]}
            >
              <Ionicons name={taskKind.icon} size={15} color={toneColors.fg} />
              <Text style={[styles.createdTaskKindCount, { color: toneColors.fg }]}>{count}</Text>
              <Text numberOfLines={1} style={styles.createdTaskKindLabel}>
                {taskKind.label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.listStack}>
        {roomTasks.length ? (
          roomTasks.map((task) => (
            <CreatedTaskLogCard
              historyCount={historyCountByTask.get(task._id) ?? 0}
              key={task._id}
              onPress={() => onOpenTaskHistory(task._id)}
              task={task}
            />
          ))
        ) : (
          <EmptyState
            icon="layers-outline"
            text="Created regular tasks, special tasks, and challenges will appear here."
          />
        )}
      </View>
    </View>
    </Panel>
  );
}

function HostTaskHistoryPanel({
  historySubmissions,
  onSelectTask,
  roomTasks,
  selectedTaskId,
}: {
  historySubmissions: DashboardData["hostSubmissions"];
  onSelectTask: (taskId: string) => void;
  roomTasks: DashboardData["tasks"];
  selectedTaskId: string;
}) {
  const activeTaskId = roomTasks.some((task) => task._id === selectedTaskId)
    ? selectedTaskId
    : (roomTasks[0]?._id ?? "");
  const selectedTask = roomTasks.find((task) => task._id === activeTaskId);
  const selectedHistory = selectedTask
    ? historySubmissions.filter((submission) => submission.taskId === selectedTask._id)
    : [];
  const historyCountByTask = new Map<string, number>();
  historySubmissions.forEach((submission) => {
    historyCountByTask.set(submission.taskId, (historyCountByTask.get(submission.taskId) ?? 0) + 1);
  });

  return (
    <Panel
      action={<CounterLabel label={`${historySubmissions.length} verified`} />}
      eyebrow="Assignment History"
      icon="time-outline"
      title="History"
      tone="gold"
    >
      <View style={styles.createdTasksBlock}>
        <View style={styles.historyGroupHeader}>
          <Ionicons name="layers-outline" size={16} color={theme.award} />
          <Text style={styles.historyGroupTitle}>Pick Assignment</Text>
          <CounterLabel label={`${roomTasks.length} tasks`} />
        </View>
        <View style={styles.listStack}>
          {roomTasks.length ? (
            roomTasks.map((task) => (
              <CreatedTaskLogCard
                historyCount={historyCountByTask.get(task._id) ?? 0}
                key={task._id}
                onPress={() => onSelectTask(task._id)}
                selected={task._id === activeTaskId}
                task={task}
              />
            ))
          ) : (
            <EmptyState
              icon="clipboard-outline"
              text="Create an assignment first. Its verification history will appear here."
            />
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.listStack}>
        <View style={styles.historyGroupHeader}>
          <Ionicons name="checkmark-circle-outline" size={16} color={theme.award} />
          <Text numberOfLines={1} style={styles.historyGroupTitle}>
            {selectedTask?.title ?? "No assignment selected"}
          </Text>
          <CounterLabel label={`${selectedHistory.length} records`} />
        </View>
        {selectedHistory.length ? (
          selectedHistory.map((submission) => (
            <SubmissionReviewCard key={submission._id} mode="history" submission={submission} />
          ))
        ) : (
          <EmptyState
            icon="time-outline"
            text={
              selectedTask
                ? "No verified proof or winner records for this assignment yet."
                : "Select an assignment to see its history."
            }
          />
        )}
      </View>
    </Panel>
  );
}

function CreatedTaskLogCard({
  historyCount,
  onPress,
  selected,
  task,
}: {
  historyCount?: number;
  onPress?: () => void;
  selected?: boolean;
  task: HackTask;
}) {
  const kind = task.kind ?? "task";
  const proofTypes = getTaskProofTypes(task).map((proofType) => proofTypeLabel(proofType));

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.createdTaskCard,
        selected && styles.createdTaskCardSelected,
        pressed && onPress && styles.pressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.taskTitleBlock}>
          <Text numberOfLines={1} style={styles.cardTitle}>
            {task.title}
          </Text>
          <Text style={styles.cardMeta}>
            {formatDate(task.createdAt)} - Due {formatDate(task.dueAt)}
          </Text>
        </View>
        <View style={styles.createdTaskBadges}>
          <StatusPill label={kindLabel(kind)} tone={taskKindTone(kind)} />
          {typeof historyCount === "number" ? <CounterLabel label={`${historyCount} history`} /> : null}
        </View>
      </View>
      <Text numberOfLines={2} style={styles.cardDescription}>
        {task.description || "No description added."}
      </Text>
      <View style={styles.proofTypeRow}>
        <Text style={styles.proofTypeLabel}>+{task.rewardXrdm} XRDM</Text>
        {proofTypes.map((proofType) => (
          <Text key={proofType} style={styles.proofTypeLabel}>
            {proofType}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

function HostGamesPanel() {
  return (
    <Panel
      action={<CounterLabel label={`${gameTypeOptions.length} games`} />}
      eyebrow="Host Play"
      icon="game-controller-outline"
      title="Games"
      tone="lime"
    >
      <MiniGamePlaySurface tone="lime" />
    </Panel>
  );
}

function ParticipantRoomWorkspace({
  activeParticipantTab,
  mySubmissions,
  onParticipantTabChange,
  onSelectTask,
  onSubmitProof,
  roomTasks,
  roomWinners,
  rewards,
  selectedTask,
  selectedTaskId,
  setSubmitForm,
  submitForm,
  submitProofPending,
}: {
  activeParticipantTab: ParticipantTab | null;
  mySubmissions: DashboardData["mySubmissions"];
  onParticipantTabChange: (tab: ParticipantTab | null) => void;
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  roomTasks: DashboardData["tasks"];
  roomWinners: DashboardData["visibleWinners"];
  rewards: Array<HackReward>;
  selectedTask?: HackTask;
  selectedTaskId: string;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
}) {
  const regularTasks = roomTasks.filter((task) =>
    ["task", "special"].includes(task.kind ?? "task"),
  );
  const challengeTasks = roomTasks.filter((task) => task.kind === "challenge");
  const participantActions: Array<{
    icon: React.ComponentProps<typeof Ionicons>["name"];
    id: ParticipantTab;
    label: string;
  }> = [
    { icon: "send-outline", id: "submit", label: "Submit Task" },
    { icon: "time-outline", id: "history", label: "History" },
    { icon: "game-controller-outline", id: "games", label: "Games" },
    { icon: "wallet-outline", id: "wallet", label: "Wallet" },
  ];
  const activeAction = participantActions.find((action) => action.id === activeParticipantTab);

  const openAction = (action: ParticipantTab) => {
    if (action === "submit" && regularTasks.length) {
      const selectedRegularTask = regularTasks.find((task) => task._id === selectedTaskId);
      onSelectTask(selectedRegularTask?._id ?? regularTasks[0]._id);
    }
    if (action === "games" && challengeTasks.length) {
      const selectedChallengeTask = challengeTasks.find((task) => task._id === selectedTaskId);
      onSelectTask(selectedChallengeTask?._id ?? challengeTasks[0]._id);
    }
    onParticipantTabChange(action);
  };

  if (!activeParticipantTab) {
    return (
      <View style={styles.trackStack}>
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionGrid}>
            {participantActions.map((action) => (
              <QuickActionTile
                active={false}
                icon={action.icon}
                key={action.id}
                label={action.label}
                onPress={() => openAction(action.id)}
                tone={action.id === "games" ? "lime" : action.id === "wallet" ? "gold" : "cyan"}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.trackStack}>
      <View style={styles.actionScreenHeader}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onParticipantTabChange(null);
          }}
          style={({ pressed }) => [
            styles.actionBackButton,
            styles.participantActionBackButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="chevron-back-outline" size={17} color={theme.participant} />
          <Text style={[styles.actionBackText, styles.participantActionBackText]}>
            Quick Actions
          </Text>
        </Pressable>
        <View style={styles.actionTitleBlock}>
          <Text style={styles.sectionEyebrow}>Member Action</Text>
          <Text numberOfLines={2} style={styles.actionScreenTitle}>
            {activeAction?.label ?? "Member Action"}
          </Text>
        </View>
      </View>

      {activeParticipantTab === "submit" ? (
        <ParticipantSubmitPanel
          mySubmissions={mySubmissions}
          onSelectTask={onSelectTask}
          onSubmitProof={onSubmitProof}
          regularTasks={regularTasks}
          selectedTask={
            ["task", "special"].includes(selectedTask?.kind ?? "task") ? selectedTask : undefined
          }
          selectedTaskId={selectedTaskId}
          setSubmitForm={setSubmitForm}
          submitForm={submitForm}
          submitProofPending={submitProofPending}
        />
      ) : null}

      {activeParticipantTab === "history" ? (
        <ParticipantHistoryPanel mySubmissions={mySubmissions} roomTasks={roomTasks} />
      ) : null}

      {activeParticipantTab === "games" ? (
        <ParticipantGamesPanel
          challengeTasks={challengeTasks}
          mySubmissions={mySubmissions}
          onSelectTask={onSelectTask}
          onSubmitProof={onSubmitProof}
          selectedTask={selectedTask}
          selectedTaskId={selectedTaskId}
          setSubmitForm={setSubmitForm}
          submitForm={submitForm}
          submitProofPending={submitProofPending}
        />
      ) : null}

      {activeParticipantTab === "wallet" ? (
        <ParticipantWalletPanel
          mySubmissions={mySubmissions}
          rewards={rewards}
          roomWinners={roomWinners}
        />
      ) : null}
    </View>
  );
}

function ParticipantSubmitPanel({
  mySubmissions,
  onSelectTask,
  onSubmitProof,
  regularTasks,
  selectedTask,
  selectedTaskId,
  setSubmitForm,
  submitForm,
  submitProofPending,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  regularTasks: DashboardData["tasks"];
  selectedTask?: HackTask;
  selectedTaskId: string;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
}) {
  const selectedSubmission = selectedTask
    ? mySubmissions.find((submission) => submission.taskId === selectedTask._id)
    : undefined;
  const showProofForm = !selectedTask || canShowProofSubmitCard(selectedSubmission?.status);

  return (
    <Panel
      action={<CounterLabel label={`${regularTasks.length} tasks`} />}
      eyebrow="Member"
      icon="send-outline"
      title="Submit Task"
      tone="cyan"
    >
      <View style={styles.listStack}>
        {regularTasks.length ? (
          regularTasks.map((task) => {
            const submission = mySubmissions.find((item) => item.taskId === task._id);
            return (
              <TaskCard
                key={task._id}
                onPress={() => onSelectTask(task._id)}
                selected={selectedTaskId === task._id}
                status={submission?.status}
                task={task}
              />
            );
          })
        ) : (
          <EmptyState
            icon="clipboard-outline"
            text="The host has not assigned a regular final task yet."
          />
        )}
      </View>

      {selectedSubmission?.status === "returned" ? (
        <ReturnedSubmissionNotice submission={selectedSubmission} />
      ) : null}

      {showProofForm ? (
        <TaskProofSubmitCard
          onSubmitProof={onSubmitProof}
          selectedTask={selectedTask}
          setSubmitForm={setSubmitForm}
          submitForm={submitForm}
          submitProofPending={submitProofPending}
        />
      ) : selectedSubmission ? (
        <SubmissionHoldCard submission={selectedSubmission} />
      ) : null}
    </Panel>
  );
}

function ParticipantHistoryPanel({
  mySubmissions,
  roomTasks,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  roomTasks: DashboardData["tasks"];
}) {
  const groups: Array<{
    icon: React.ComponentProps<typeof Ionicons>["name"];
    statuses: Array<SubmissionStatus>;
    title: string;
  }> = [
    { icon: "time-outline", statuses: ["submitted"], title: "Submitted" },
    { icon: "refresh-outline", statuses: ["returned"], title: "Returned" },
    { icon: "checkmark-circle-outline", statuses: ["approved"], title: "Verified" },
    { icon: "trophy-outline", statuses: ["winner"], title: "Winner" },
  ];
  const taskCount = roomTasks.length;

  return (
    <Panel
      action={<CounterLabel label={`${mySubmissions.length} records`} />}
      eyebrow="Member"
      icon="time-outline"
      title="History"
      tone="cyan"
    >
      <View style={styles.historySummaryRow}>
        <MiniStat icon="clipboard-outline" label="Room Tasks" value={taskCount} />
        <MiniStat icon="checkmark-circle-outline" label="Proof Records" value={mySubmissions.length} />
      </View>
      <View style={styles.listStack}>
        {mySubmissions.length ? (
          groups.map((group) => {
            const submissions = mySubmissions.filter((submission) =>
              group.statuses.includes(submission.status),
            );
            if (!submissions.length) {
              return null;
            }

            return (
              <View key={group.title} style={styles.historyGroup}>
                <View style={styles.historyGroupHeader}>
                  <Ionicons name={group.icon} size={16} color={theme.participant} />
                  <Text style={styles.historyGroupTitle}>{group.title}</Text>
                  <CounterLabel label={`${submissions.length}`} />
                </View>
                {submissions.map((submission) => (
                  <SubmissionCard key={submission._id} submission={submission} />
                ))}
              </View>
            );
          })
        ) : (
          <EmptyState
            icon="checkmark-circle-outline"
            text="Submitted proof, returned work, verified records, and winners will appear here."
          />
        )}
      </View>
    </Panel>
  );
}

function ParticipantGamesPanel({
  challengeTasks,
  mySubmissions,
  onSelectTask,
  onSubmitProof,
  selectedTask,
  selectedTaskId,
  setSubmitForm,
  submitForm,
  submitProofPending,
}: {
  challengeTasks: DashboardData["tasks"];
  mySubmissions: DashboardData["mySubmissions"];
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  selectedTask?: HackTask;
  selectedTaskId: string;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
}) {
  const selectedProofTask = selectedTask?.kind === "challenge" ? selectedTask : undefined;
  const selectedSubmission = selectedProofTask
    ? mySubmissions.find((submission) => submission.taskId === selectedProofTask._id)
    : undefined;
  const showProofForm = !selectedProofTask || canShowProofSubmitCard(selectedSubmission?.status);

  return (
    <View style={styles.trackStack}>
      <Panel
        action={<CounterLabel label={`${gameTypeOptions.length} games`} />}
        eyebrow="Member"
        icon="game-controller-outline"
        title="Games"
        tone="cyan"
      >
        <MiniGamePlaySurface tone="cyan" />
        <View style={styles.divider} />
        <Text style={styles.sectionEyebrow}>Spot Challenges</Text>
        <View style={styles.listStack}>
          {challengeTasks.length ? (
            challengeTasks.map((task) => {
              const submission = mySubmissions.find((item) => item.taskId === task._id);
              return (
                <TaskCard
                  key={task._id}
                  onPress={() => onSelectTask(task._id)}
                  selected={selectedTaskId === task._id}
                  status={submission?.status}
                  task={task}
                />
              );
            })
          ) : (
            <EmptyState icon="flash-outline" text="Spot challenges from the host will appear here." />
          )}
        </View>

        {selectedSubmission?.status === "returned" ? (
          <ReturnedSubmissionNotice submission={selectedSubmission} />
        ) : null}

        {showProofForm ? (
          <TaskProofSubmitCard
            onSubmitProof={onSubmitProof}
            selectedTask={selectedProofTask}
            setSubmitForm={setSubmitForm}
            submitForm={submitForm}
            submitProofPending={submitProofPending}
          />
        ) : selectedSubmission ? (
          <SubmissionHoldCard submission={selectedSubmission} />
        ) : null}

      </Panel>
    </View>
  );
}

function TaskProofSubmitCard({
  onSubmitProof,
  selectedTask,
  setSubmitForm,
  submitForm,
  submitProofPending,
}: {
  onSubmitProof: () => void;
  selectedTask?: HackTask;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
}) {
  const submitMetaComplete = Boolean(
    submitForm.submitterName.trim() && submitForm.teamName.trim() && submitForm.description.trim(),
  );

  return (
    <View style={styles.submitCard}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionEyebrow}>Submit Proof</Text>
          <Text style={styles.sectionTitleSmall}>
            {selectedTask?.title ?? "Select an assignment"}
          </Text>
        </View>
        {selectedTask ? <StatusPill label={`+${selectedTask.rewardXrdm} XRDM`} tone="gold" /> : null}
      </View>

      <View style={styles.submitMetaGrid}>
        <View style={styles.submitMetaField}>
          <Field label="Your name">
            <HackTextInput
              onChangeText={(value) =>
                setSubmitForm((current) => ({ ...current, submitterName: value }))
              }
              placeholder="Student name"
              value={submitForm.submitterName}
            />
          </Field>
        </View>
        <View style={styles.submitMetaField}>
          <Field label="Team name">
            <HackTextInput
              onChangeText={(value) =>
                setSubmitForm((current) => ({ ...current, teamName: value }))
              }
              placeholder="Team / room name"
              value={submitForm.teamName}
            />
          </Field>
        </View>
      </View>

      <TeamMateEmailComposer setSubmitForm={setSubmitForm} submitForm={submitForm} />

      <Field label="Description">
        <HackTextInput
          multiline
          onChangeText={(value) =>
            setSubmitForm((current) => ({ ...current, description: value }))
          }
          placeholder="Summarize what your team built, changed, or completed."
          style={styles.submitDescriptionInput}
          value={submitForm.description}
        />
      </Field>

      <ProofRequirementFields
        selectedTask={selectedTask}
        setSubmitForm={setSubmitForm}
        submitForm={submitForm}
      />

      <Field label="Note to host">
        <HackTextInput
          multiline
          onChangeText={(value) => setSubmitForm((current) => ({ ...current, notes: value }))}
          placeholder="Mention branch, game result, demo timestamp, or implementation notes."
          style={styles.textArea}
          value={submitForm.notes}
        />
      </Field>

      <HackButton
        disabled={
          !selectedTask ||
          !submitMetaComplete ||
          !hasRequiredProofItems(selectedTask, submitForm) ||
          submitProofPending
        }
        icon="send-outline"
        label={selectedTask?.kind === "game" ? "Submit Game Proof" : "Submit Proof"}
        loading={submitProofPending}
        onPress={onSubmitProof}
        tone={selectedTask?.kind === "game" ? "gold" : "cyan"}
      />
    </View>
  );
}

function TeamMateEmailComposer({
  setSubmitForm,
  submitForm,
}: {
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
}) {
  const addDraftEmails = () => {
    setSubmitForm((current) => {
      const tokens = getEmailTokens(current.teamMateEmailDraft);
      if (!tokens.length) {
        return current;
      }

      const validEmails = tokens.filter(isEmailLike);
      const invalidEmails = tokens.filter((email) => !isEmailLike(email));

      return {
        ...current,
        teamMateEmailDraft: invalidEmails.join(", "),
        teamMateEmails: normalizeEmails([...current.teamMateEmails, ...validEmails]),
      };
    });
  };

  const removeEmail = (email: string) => {
    setSubmitForm((current) => ({
      ...current,
      teamMateEmails: current.teamMateEmails.filter((item) => item !== email),
    }));
  };

  const handleDraftChange = (value: string) => {
    if (/[,\n;]/.test(value)) {
      setSubmitForm((current) => {
        const tokens = getEmailTokens(value);
        const validEmails = tokens.filter(isEmailLike);
        const invalidEmails = tokens.filter((email) => !isEmailLike(email));

        return {
          ...current,
          teamMateEmailDraft: invalidEmails.join(", "),
          teamMateEmails: normalizeEmails([...current.teamMateEmails, ...validEmails]),
        };
      });
      return;
    }

    setSubmitForm((current) => ({ ...current, teamMateEmailDraft: value }));
  };

  return (
    <Field label="Team mate emails">
      <View style={styles.emailComposer}>
        {submitForm.teamMateEmails.length ? (
          <View style={styles.emailChipWrap}>
            {submitForm.teamMateEmails.map((email) => (
              <View key={email} style={styles.emailChip}>
                <Text numberOfLines={1} style={styles.emailChipText}>
                  {email}
                </Text>
                <Pressable
                  accessibilityLabel={`Remove ${email}`}
                  accessibilityRole="button"
                  onPress={() => removeEmail(email)}
                  style={({ pressed }) => [styles.emailChipRemove, pressed && styles.pressed]}
                >
                  <Ionicons name="close-outline" size={13} color={theme.participant} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.emailComposerInputRow}>
          <HackTextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={handleDraftChange}
            onSubmitEditing={addDraftEmails}
            placeholder="teammate@domain.com"
            style={styles.emailComposerInput}
            value={submitForm.teamMateEmailDraft}
          />
          <Pressable
            accessibilityRole="button"
            onPress={addDraftEmails}
            style={({ pressed }) => [styles.emailAddButton, pressed && styles.pressed]}
          >
            <Ionicons name="add-outline" size={18} color="#03120c" />
          </Pressable>
        </View>
      </View>
    </Field>
  );
}

function ReturnedSubmissionNotice({
  submission,
}: {
  submission: DashboardData["mySubmissions"][number];
}) {
  return (
    <View style={styles.returnedNoticeCard}>
      <View style={styles.submissionHoldHeader}>
        <View style={[styles.submissionHoldIcon, { borderColor: theme.dangerBorder }]}>
          <Ionicons name="refresh-outline" size={16} color={theme.danger} />
        </View>
        <View style={styles.profileText}>
          <Text style={styles.submissionHoldTitle}>Proof returned</Text>
          <Text style={styles.submissionHoldText}>
            Update the required fields below and resubmit for verification.
          </Text>
        </View>
        <StatusPill label="Returned" tone="red" />
      </View>
      {submission.hostFeedback ? (
        <Text style={styles.feedbackText}>{submission.hostFeedback}</Text>
      ) : null}
    </View>
  );
}

function SubmissionHoldCard({
  submission,
}: {
  submission: DashboardData["mySubmissions"][number];
}) {
  const tone = statusTone(submission.status);
  const toneColors = getToneColors(tone);
  const title =
    submission.status === "submitted"
      ? "Proof sent for verification"
      : submission.status === "approved"
        ? "Proof verified"
        : submission.status === "winner"
          ? "Winner announced"
          : "Proof status updated";
  const text =
    submission.status === "submitted"
      ? "Your proof is with the host. This form will reopen only if the host returns it."
      : submission.status === "approved"
        ? "This proof is locked as verified. You can track it from History."
        : submission.status === "winner"
          ? "This proof has been selected as a winning record."
          : "Check History for the latest status.";

  return (
    <View style={[styles.submissionHoldCard, { backgroundColor: toneColors.bg, borderColor: toneColors.border }]}>
      <View style={styles.submissionHoldHeader}>
        <View style={[styles.submissionHoldIcon, { borderColor: toneColors.border }]}>
          <Ionicons name={submissionHoldIcon(submission.status)} size={16} color={toneColors.fg} />
        </View>
        <View style={styles.profileText}>
          <Text style={[styles.submissionHoldTitle, { color: toneColors.fg }]}>{title}</Text>
          <Text style={styles.submissionHoldText}>{text}</Text>
        </View>
        <StatusPill label={submissionStatusLabel(submission.status)} tone={tone} />
      </View>
      <SubmissionCard submission={submission} />
    </View>
  );
}

function GameAssignmentCard({
  onPress,
  selected,
  status,
  task,
}: {
  onPress: () => void;
  selected: boolean;
  status?: SubmissionStatus;
  task: HackTask;
}) {
  const gameType = getTaskGameType(task);
  const gameInfo = getGameTypeInfo(gameType);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.gameAssignmentCard,
        selected && styles.taskCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.gameAssignmentIcon}>
          <Ionicons name={gameInfo.icon} size={20} color={theme.award} />
        </View>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{task.title}</Text>
          <Text style={styles.cardMeta}>
            {gameInfo.label} - Due {task.dueAt}
          </Text>
        </View>
        <StatusPill
          label={status ? submissionStatusLabel(status) : `+${task.rewardXrdm} XRDM`}
          tone={statusTone(status)}
        />
      </View>
      <Text numberOfLines={3} style={styles.cardDescription}>
        {task.description}
      </Text>
      <View style={styles.proofTypeRow}>
        <Text style={styles.proofTypeLabel}>Game</Text>
        <Text style={styles.proofTypeLabel}>Score proof</Text>
      </View>
    </Pressable>
  );
}

function MiniGamePlaySurface({ tone }: { tone: Tone }) {
  const [activeGameSession, setActiveGameSession] = useState<MiniGameSession | null>(null);
  const [latestResult, setLatestResult] = useState<MiniGameResult | null>(null);
  const toneColors = getToneColors(tone);

  return (
    <View style={styles.miniGamePlayStack}>
      {activeGameSession ? (
        <MiniGamePlayer
          onBack={() => setActiveGameSession(null)}
          onComplete={setLatestResult}
          session={activeGameSession}
        />
      ) : null}

      <View
        style={[
          styles.gamesBanner,
          { backgroundColor: toneColors.bg, borderColor: toneColors.border },
        ]}
      >
        <Ionicons name="game-controller-outline" size={24} color={toneColors.fg} />
        <View style={styles.profileText}>
          <Text style={[styles.gamesBannerTitle, { color: toneColors.fg }]}>Play mini-games</Text>
          <Text style={styles.gamesBannerText}>
            Quick in-app games for a reset. They do not create assignments or submit proof.
          </Text>
        </View>
      </View>

      {latestResult ? (
        <View style={styles.latestGameResultCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.taskTitleBlock}>
              <Text style={styles.latestGameResultTitle}>{latestResult.title}</Text>
              <Text style={styles.latestGameResultText}>{latestResult.notes}</Text>
            </View>
            <StatusPill label={`${latestResult.score} pts`} tone="gold" />
          </View>
        </View>
      ) : null}

      <Text style={styles.sectionEyebrow}>Play Now</Text>
      <ScrollView
        contentContainerStyle={styles.practiceGameShelf}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {gameTypeOptions.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => setActiveGameSession({ mode: "practice", type: option.value })}
            style={({ pressed }) => [styles.practiceGameCard, pressed && styles.pressed]}
          >
            <Ionicons name={option.icon} size={22} color={theme.participant} />
            <Text style={styles.practiceGameTitle}>{option.label}</Text>
            <Text style={styles.practiceGameMeta}>Play</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function MiniGamePlayer({
  onBack,
  onComplete,
  session,
}: {
  onBack: () => void;
  onComplete: (result: MiniGameResult) => void;
  session: MiniGameSession;
}) {
  const gameInfo = getGameTypeInfo(session.type);

  return (
    <View style={styles.miniGameSurface}>
      <View style={styles.cardTopRow}>
        <View style={styles.gameAssignmentIcon}>
          <Ionicons name={gameInfo.icon} size={20} color={theme.award} />
        </View>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{gameInfo.label}</Text>
          <Text style={styles.cardMeta}>Play mode</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.miniGameCloseButton, pressed && styles.pressed]}
        >
          <Ionicons name="close-outline" size={17} color={theme.award} />
        </Pressable>
      </View>
      {session.type === "memory_match" ? (
        <MemoryMatchGame onComplete={onComplete} />
      ) : session.type === "breath_timer" ? (
        <BreathTimerGame onComplete={onComplete} />
      ) : (
        <QuickMathsGame onComplete={onComplete} />
      )}
    </View>
  );
}

function MemoryMatchGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [cards] = useState(() => makeMemoryCards());
  const [flipped, setFlipped] = useState<Array<number>>([]);
  const [matched, setMatched] = useState<Array<string>>([]);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (flipped.length !== 2) {
      return;
    }

    const timeout = setTimeout(() => {
      const [firstIndex, secondIndex] = flipped;
      const firstCard = cards[firstIndex];
      const secondCard = cards[secondIndex];
      setMoves((current) => current + 1);

      if (firstCard?.value && firstCard.value === secondCard?.value) {
        setMatched((current) => [...current, firstCard.value]);
      }

      setFlipped([]);
    }, 650);

    return () => clearTimeout(timeout);
  }, [cards, flipped]);

  useEffect(() => {
    if (matched.length === 4 && !completed) {
      const score = Math.max(40, 120 - moves * 8);
      setCompleted(true);
      onComplete(makeMiniGameResult("memory_match", score, `${moves} moves, 4 pairs matched`));
    }
  }, [completed, matched.length, moves, onComplete]);

  const handleCardPress = (index: number) => {
    const card = cards[index];
    if (!card || completed || flipped.includes(index) || matched.includes(card.value)) {
      return;
    }
    if (flipped.length >= 2) {
      return;
    }
    setFlipped((current) => [...current, index]);
  };

  return (
    <View style={styles.miniGameStack}>
      <View style={styles.miniGameStatRow}>
        <WalletChip label="Moves" value={moves} />
        <WalletChip label="Matched" value={matched.length} />
      </View>
      <View style={styles.memoryGrid}>
        {cards.map((card, index) => {
          const visible = flipped.includes(index) || matched.includes(card.value);
          return (
            <Pressable
              accessibilityRole="button"
              key={card.id}
              onPress={() => handleCardPress(index)}
              style={({ pressed }) => [
                styles.memoryCard,
                visible && styles.memoryCardOpen,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.memoryCardText}>{visible ? card.label : "?"}</Text>
            </Pressable>
          );
        })}
      </View>
      {completed ? <StatusPill label="Game complete" tone="gold" /> : null}
    </View>
  );
}

function BreathTimerGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const duration = 30;
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const elapsed = duration - secondsLeft;
  const phase = ["Inhale", "Hold", "Exhale"][Math.floor(elapsed / 4) % 3] ?? "Inhale";

  const completeSession = () => {
    if (completed) {
      return;
    }
    const score = Math.max(40, Math.round((elapsed / duration) * 100));
    setCompleted(true);
    setRunning(false);
    onComplete(makeMiniGameResult("breath_timer", score, `${elapsed}s mindful session`));
  };

  useEffect(() => {
    if (!running || completed) {
      return;
    }
    if (secondsLeft <= 0) {
      completeSession();
      return;
    }

    const interval = setInterval(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearInterval(interval);
  }, [completed, running, secondsLeft]);

  return (
    <View style={styles.miniGameStack}>
      <View style={styles.breathRing}>
        <Text style={styles.breathPhase}>{phase}</Text>
        <Text style={styles.breathTime}>{secondsLeft}s</Text>
      </View>
      <Text style={styles.gamesBannerText}>
        Follow the phase. Finish after a short reset to save a local result.
      </Text>
      <View style={styles.gameControlRow}>
        <HackButton
          icon={running ? "pause-outline" : "play-outline"}
          label={running ? "Pause" : "Start"}
          onPress={() => setRunning((current) => !current)}
          tone="cyan"
        />
        <HackButton
          disabled={completed || elapsed < 5}
          icon="checkmark-circle-outline"
          label="Finish"
          onPress={completeSession}
          tone="gold"
        />
      </View>
      {completed ? <StatusPill label="Game complete" tone="gold" /> : null}
    </View>
  );
}

function QuickMathsGame({ onComplete }: { onComplete: (result: MiniGameResult) => void }) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [question, setQuestion] = useState(() => makeMathQuestion(0));
  const [answer, setAnswer] = useState("");
  const [correct, setCorrect] = useState(0);
  const [completed, setCompleted] = useState(false);

  const submitAnswer = () => {
    if (completed) {
      return;
    }

    const nextCorrect = Number(answer) === question.answer ? correct + 1 : correct;
    const nextIndex = questionIndex + 1;
    setCorrect(nextCorrect);
    setAnswer("");

    if (nextIndex >= 5) {
      setCompleted(true);
      onComplete(
        makeMiniGameResult("quick_maths", nextCorrect * 20, `${nextCorrect}/5 answers correct`),
      );
      return;
    }

    setQuestionIndex(nextIndex);
    setQuestion(makeMathQuestion(nextIndex));
  };

  return (
    <View style={styles.miniGameStack}>
      <View style={styles.mathQuestionCard}>
        <Text style={styles.mathRound}>Round {questionIndex + 1} / 5</Text>
        <Text style={styles.mathQuestion}>{question.prompt}</Text>
      </View>
      <Field label="Answer">
        <HackTextInput
          keyboardType="number-pad"
          onChangeText={setAnswer}
          onSubmitEditing={submitAnswer}
          placeholder="Type result"
          value={answer}
        />
      </Field>
      <View style={styles.gameControlRow}>
        <WalletChip label="Correct" value={correct} />
        <HackButton
          disabled={!answer.trim() || completed}
          icon="arrow-forward-outline"
          label={questionIndex >= 4 ? "Finish" : "Next"}
          onPress={submitAnswer}
          tone="cyan"
        />
      </View>
      {completed ? <StatusPill label="Game complete" tone="gold" /> : null}
    </View>
  );
}

function HostAwardsPanel({
  issueRewardPending,
  onIssueReward,
  rewardForm,
  rewards,
  room,
  setRewardForm,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: Array<HackReward>;
  room: HackRoom;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const [awardMode, setAwardMode] = useState<"certificates" | "nfts">("certificates");

  const switchMode = (mode: "certificates" | "nfts") => {
    setAwardMode(mode);
    setRewardForm(makeEmptyRewardForm());
  };

  return (
    <View style={styles.trackStack}>
      <View style={styles.awardModeSwitch}>
        <KindButton
          active={awardMode === "certificates"}
          icon="ribbon-outline"
          label="Certificates"
          onPress={() => switchMode("certificates")}
        />
        <KindButton
          active={awardMode === "nfts"}
          icon="diamond-outline"
          label="NFT Badges"
          onPress={() => switchMode("nfts")}
        />
      </View>

      {awardMode === "certificates" ? (
        <HostCertificatesPanel
          issueRewardPending={issueRewardPending}
          onIssueReward={onIssueReward}
          rewardForm={rewardForm}
          rewards={rewards}
          room={room}
          setRewardForm={setRewardForm}
          winnerSubmissions={winnerSubmissions}
        />
      ) : (
        <HostNftBadgesPanel
          issueRewardPending={issueRewardPending}
          onIssueReward={onIssueReward}
          rewardForm={rewardForm}
          rewards={rewards}
          room={room}
          setRewardForm={setRewardForm}
          winnerSubmissions={winnerSubmissions}
        />
      )}
    </View>
  );
}

function HostCertificatesPanel({
  issueRewardPending,
  onIssueReward,
  rewardForm,
  rewards,
  room,
  setRewardForm,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: Array<HackReward>;
  room: HackRoom;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const certificateRewards = rewards.filter((reward) => reward.kind !== "winner_nft_badge");
  return (
    <View style={styles.trackStack}>
      <Panel
        action={<CounterLabel label={`${room.participants.length} members`} />}
        eyebrow="Issue"
        icon="ribbon-outline"
        title="Member Certificates"
        tone="gold"
      >
        <Field label="Certificate title">
          <HackTextInput
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, title: value }))
            }
            placeholder="Member Certificate"
            value={rewardForm.title}
          />
        </Field>
        <Field label="Certificate note">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, description: value }))
            }
            placeholder="Issued for verified participation in this hack room."
            style={styles.textArea}
            value={rewardForm.description}
          />
        </Field>
        <Field label="XRDM attached">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, awardXrdm: value }))
            }
            placeholder="0"
            value={rewardForm.awardXrdm}
          />
        </Field>
        <RewardRecipientEmailComposer
          room={room}
          rewardForm={rewardForm}
          setRewardForm={setRewardForm}
        />
        <HackButton
          disabled={!room.participants.length || issueRewardPending}
          icon="ribbon-outline"
          label="Issue Member Certificates"
          loading={issueRewardPending}
          onPress={() => onIssueReward("participant_certificate")}
          tone="gold"
        />
      </Panel>

      <Panel
        action={<CounterLabel label={`${winnerSubmissions.length} winners`} />}
        eyebrow="Team Award"
        icon="trophy-outline"
        title="Winner Certificates"
        tone="violet"
      >
        <WinnerSourceSelector
          rewardForm={rewardForm}
          setRewardForm={setRewardForm}
          winnerSubmissions={winnerSubmissions}
        />
        <RewardRecipientEmailComposer
          room={room}
          rewardForm={rewardForm}
          setRewardForm={setRewardForm}
        />
        <Field label="Winner certificate title">
          <HackTextInput
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, title: value }))
            }
            placeholder="Winner Certificate"
            value={rewardForm.title}
          />
        </Field>
        <Field label="XRDM attached">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, awardXrdm: value }))
            }
            placeholder="50"
            value={rewardForm.awardXrdm}
          />
        </Field>
        <Field label="Ledger note">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, ledgerNote: value }))
            }
            placeholder="Team winner certificate issued by host."
            style={styles.textArea}
            value={rewardForm.ledgerNote}
          />
        </Field>
        <HackButton
          disabled={!winnerSubmissions.length || issueRewardPending}
          icon="trophy-outline"
          label="Issue Winner Certificate"
          loading={issueRewardPending}
          onPress={() => onIssueReward("winner_certificate")}
          tone="violet"
        />
      </Panel>

      <Panel
        action={<CounterLabel label={`${certificateRewards.length} issued`} />}
        eyebrow="Ledger"
        icon="document-text-outline"
        title="Issued Certificates"
        tone="cyan"
      >
        <View style={styles.listStack}>
          {certificateRewards.length ? (
            certificateRewards.map((reward) => <RewardCard key={reward._id} reward={reward} />)
          ) : (
            <EmptyState
              icon="document-text-outline"
              text="Issued member and winner certificates will appear here."
            />
          )}
        </View>
      </Panel>
    </View>
  );
}

function HostNftBadgesPanel({
  issueRewardPending,
  onIssueReward,
  rewardForm,
  rewards,
  room,
  setRewardForm,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  rewards: Array<HackReward>;
  room: HackRoom;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const nftRewards = rewards.filter((reward) => reward.kind === "winner_nft_badge");

  return (
    <View style={styles.trackStack}>
      <Panel
        action={<CounterLabel label={`${room.participants.length} team members`} />}
        eyebrow="Winner NFT"
        icon="diamond-outline"
        title="NFT Badges"
        tone="gold"
      >
        <WinnerSourceSelector
          rewardForm={rewardForm}
          setRewardForm={setRewardForm}
          winnerSubmissions={winnerSubmissions}
        />
        <RewardRecipientEmailComposer
          room={room}
          rewardForm={rewardForm}
          setRewardForm={setRewardForm}
        />
        <Field label="NFT badge name">
          <HackTextInput
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, title: value }))
            }
            placeholder="Quick Fix Winner"
            value={rewardForm.title}
          />
        </Field>
        <Field label="Badge description">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, description: value }))
            }
            placeholder="Awarded to the winning team for standout hackathon impact."
            style={styles.textArea}
            value={rewardForm.description}
          />
        </Field>
        <Field label="XRDM attached">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, awardXrdm: value }))
            }
            placeholder="50"
            value={rewardForm.awardXrdm}
          />
        </Field>
        <Field label="Ledger note">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setRewardForm((current) => ({ ...current, ledgerNote: value }))
            }
            placeholder="In-app NFT badge record. External minting can consume this later."
            style={styles.textArea}
            value={rewardForm.ledgerNote}
          />
        </Field>
        <HackButton
          disabled={!winnerSubmissions.length || issueRewardPending}
          icon="diamond-outline"
          label="Issue NFT Badge"
          loading={issueRewardPending}
          onPress={() => onIssueReward("winner_nft_badge")}
          tone="gold"
        />
      </Panel>

      <Panel
        action={<CounterLabel label={`${nftRewards.length} issued`} />}
        eyebrow="Ledger"
        icon="diamond-outline"
        title="Issued NFT Badges"
        tone="cyan"
      >
        <View style={styles.listStack}>
          {nftRewards.length ? (
            nftRewards.map((reward) => <RewardCard key={reward._id} reward={reward} />)
          ) : (
            <EmptyState
              icon="diamond-outline"
              text="Winner NFT badge records will appear here after the host issues them."
            />
          )}
        </View>
      </Panel>
    </View>
  );
}

function ParticipantWalletPanel({
  mySubmissions,
  rewards,
  roomWinners,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  rewards: Array<HackReward>;
  roomWinners: DashboardData["visibleWinners"];
}) {
  const certificateRewards = rewards.filter((reward) => reward.kind !== "winner_nft_badge");
  const nftRewards = rewards.filter((reward) => reward.kind === "winner_nft_badge");
  const xrdmTotal =
    rewards.reduce((total, reward) => total + (reward.awardXrdm ?? 0), 0) +
    roomWinners.reduce(
      (total, submission) => total + (submission.awardXrdm ?? submission.rewardXrdm ?? 0),
      0,
    );
  const verifiedCount = mySubmissions.filter((submission) =>
    ["approved", "winner"].includes(submission.status),
  ).length;

  return (
    <View style={styles.trackStack}>
      <View style={styles.certificateHero}>
        <View style={styles.certificateHeroIcon}>
          <Ionicons name="wallet-outline" size={30} color={theme.award} />
        </View>
        <Text style={styles.certificateHeroTitle}>XRDM Wallet</Text>
        <Text style={styles.certificateHeroText}>
          Certificates, NFT badges, winner awards, and verified proof issued on the in-app So.Good
          Ledger.
        </Text>
        <StatusPill label={rewards.length ? "Issued - ledger" : "Awaiting issue"} tone="gold" />
      </View>

      <View style={styles.walletCard}>
        <Text style={styles.walletLabel}>My XRDM balance</Text>
        <View style={styles.walletBalanceRow}>
          <Text style={styles.walletBalance}>{xrdmTotal}</Text>
          <Text style={styles.walletUnit}>XRDM</Text>
        </View>
        <View style={styles.walletChipRow}>
          <WalletChip label="Verified" value={verifiedCount} />
          <WalletChip label="Certificates" value={certificateRewards.length} />
          <WalletChip label="NFTs" value={nftRewards.length} />
        </View>
      </View>

      <Panel
        action={<CounterLabel label={`${nftRewards.length} badges`} />}
        eyebrow="Wallet"
        icon="diamond-outline"
        title="My NFT Badges"
        tone="gold"
      >
        {nftRewards.length ? (
          <ScrollView
            contentContainerStyle={styles.nftShelf}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {nftRewards.map((reward) => (
              <NftBadgeCard key={reward._id} reward={reward} />
            ))}
          </ScrollView>
        ) : (
          <EmptyState icon="diamond-outline" text="Winner NFT badges will appear here." />
        )}
      </Panel>

      <Panel
        action={<CounterLabel label={`${certificateRewards.length} certs`} />}
        eyebrow="Wallet"
        icon="document-text-outline"
        title="Certificates"
        tone="cyan"
      >
        <View style={styles.listStack}>
          {certificateRewards.length ? (
            certificateRewards.map((reward) => <RewardCard key={reward._id} reward={reward} />)
          ) : (
            <EmptyState
              icon="document-text-outline"
              text="Member and winner certificates will appear here after the host issues them."
            />
          )}
        </View>
      </Panel>

      <Panel
        action={<CounterLabel label={`${mySubmissions.length + rewards.length} rows`} />}
        eyebrow="Ledger"
        icon="shield-checkmark-outline"
        title="So.Good Ledger Rows"
        tone="cyan"
      >
        <View style={styles.listStack}>
          {mySubmissions.map((submission) => (
            <LedgerRow
              key={submission._id}
              label={submission.taskTitle}
              meta={`${submissionStatusLabel(submission.status)} - ${formatDate(submission.submittedAt)}`}
              value={`+${submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM`}
            />
          ))}
          {rewards.map((reward) => (
            <LedgerRow
              key={reward._id}
              label={reward.title}
              meta={`${rewardKindLabel(reward.kind)} - ${formatDate(reward.issuedAt)}`}
              value={reward.awardXrdm ? `+${reward.awardXrdm} XRDM` : "Issued"}
            />
          ))}
          {!mySubmissions.length && !rewards.length ? (
            <EmptyState
              icon="shield-checkmark-outline"
              text="Verified proof, certificates, NFT badges, and XRDM records will appear here."
            />
          ) : null}
        </View>
      </Panel>

      <View style={styles.ledgerLinkCard}>
        <Ionicons name="shield-checkmark-outline" size={20} color={theme.participant} />
        <View style={styles.profileText}>
          <Text style={styles.ledgerTitle}>So.Good Ledger</Text>
          <Text style={styles.ledgerText}>Verified career record inside this hack room.</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={17} color={theme.participantBorder} />
      </View>
    </View>
  );
}

function RewardRecipientEmailComposer({
  room,
  rewardForm,
  setRewardForm,
}: {
  room: HackRoom;
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
}) {
  const participantEmails = new Set(
    room.participants.map((participant) => participant.email.trim().toLowerCase()),
  );

  const addDraftEmails = () => {
    setRewardForm((current) => {
      const tokens = getEmailTokens(current.recipientEmailDraft);
      if (!tokens.length) {
        return current;
      }
      const validEmails = tokens.filter(isEmailLike);
      const invalidEmails = tokens.filter((email) => !isEmailLike(email));

      return {
        ...current,
        recipientEmailDraft: invalidEmails.join(", "),
        recipientEmails: normalizeEmails([...current.recipientEmails, ...validEmails]),
      };
    });
  };

  const handleDraftChange = (value: string) => {
    if (/[,\n;]/.test(value)) {
      setRewardForm((current) => {
        const tokens = getEmailTokens(value);
        const validEmails = tokens.filter(isEmailLike);
        const invalidEmails = tokens.filter((email) => !isEmailLike(email));

        return {
          ...current,
          recipientEmailDraft: invalidEmails.join(", "),
          recipientEmails: normalizeEmails([...current.recipientEmails, ...validEmails]),
        };
      });
      return;
    }

    setRewardForm((current) => ({ ...current, recipientEmailDraft: value }));
  };

  const removeEmail = (email: string) => {
    setRewardForm((current) => ({
      ...current,
      recipientEmails: current.recipientEmails.filter((item) => item !== email),
    }));
  };

  return (
    <Field label="Recipient emails">
      <View style={styles.emailComposer}>
        {rewardForm.recipientEmails.length ? (
          <View style={styles.emailChipWrap}>
            {rewardForm.recipientEmails.map((email) => {
              const knownParticipant = participantEmails.has(email);
              return (
                <View
                  key={email}
                  style={[styles.emailChip, !knownParticipant && styles.emailChipWarning]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.emailChipText, !knownParticipant && styles.emailChipTextWarning]}
                  >
                    {email}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Remove ${email}`}
                    accessibilityRole="button"
                    onPress={() => removeEmail(email)}
                    style={({ pressed }) => [styles.emailChipRemove, pressed && styles.pressed]}
                  >
                    <Ionicons
                      name="close-outline"
                      size={13}
                      color={knownParticipant ? theme.participant : theme.warning}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
        <View style={styles.emailComposerInputRow}>
          <HackTextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={handleDraftChange}
            onSubmitEditing={addDraftEmails}
            placeholder="recipient@domain.com"
            style={styles.emailComposerInput}
            value={rewardForm.recipientEmailDraft}
          />
          <Pressable
            accessibilityRole="button"
            onPress={addDraftEmails}
            style={({ pressed }) => [styles.emailAddButton, pressed && styles.pressed]}
          >
            <Ionicons name="add-outline" size={18} color="#03120c" />
          </Pressable>
        </View>
      </View>
    </Field>
  );
}

function WinnerSourceSelector({
  rewardForm,
  setRewardForm,
  winnerSubmissions,
}: {
  rewardForm: ReturnType<typeof makeEmptyRewardForm>;
  setRewardForm: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const selectedWinnerId = rewardForm.sourceSubmissionId || winnerSubmissions[0]?._id || "";

  return (
    <Field label="Winner source">
      <View style={styles.rewardSelectorGrid}>
        {winnerSubmissions.length ? (
          winnerSubmissions.map((submission) => {
            const active = selectedWinnerId === submission._id;
            return (
              <Pressable
                accessibilityRole="button"
                key={submission._id}
                onPress={() =>
                  setRewardForm((current) => ({
                    ...current,
                    sourceSubmissionId: submission._id,
                  }))
                }
                style={({ pressed }) => [
                  styles.rewardSelectorChip,
                  active && styles.rewardSelectorChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.rewardSelectorText, active && styles.rewardSelectorTextActive]}
                >
                  {submission.taskTitle}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <EmptyState
            icon="trophy-outline"
            text="Announce a winner before issuing winner certificates or NFT badges."
          />
        )}
      </View>
    </Field>
  );
}

function RewardCard({ reward }: { reward: HackReward }) {
  return (
    <View style={styles.rewardCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.rewardIcon}>
          <Ionicons name={rewardKindIcon(reward.kind)} size={18} color={theme.award} />
        </View>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{reward.title}</Text>
          <Text style={styles.cardMeta}>
            {reward.roomName} - {formatDate(reward.issuedAt)}
          </Text>
        </View>
        <StatusPill label={rewardKindLabel(reward.kind)} tone={rewardKindTone(reward.kind)} />
      </View>
      {reward.description ? (
        <Text numberOfLines={3} style={styles.cardDescription}>
          {reward.description}
        </Text>
      ) : null}
      <View style={styles.rewardMetaRow}>
        <Text style={styles.rewardMetaText}>{reward.recipientCount} recipients</Text>
        {reward.awardXrdm ? (
          <Text style={styles.awardText}>+{reward.awardXrdm} XRDM</Text>
        ) : null}
      </View>
      {reward.ledgerNote ? <Text style={styles.feedbackText}>{reward.ledgerNote}</Text> : null}
    </View>
  );
}

function NftBadgeCard({ reward }: { reward: HackReward }) {
  return (
    <View style={styles.nftBadgeCard}>
      <Ionicons name="diamond-outline" size={23} color={theme.award} />
      <Text numberOfLines={2} style={styles.nftBadgeName}>
        {reward.title}
      </Text>
      <Text style={styles.nftBadgeDate}>{formatDate(reward.issuedAt)}</Text>
    </View>
  );
}

function WalletChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.walletChip}>
      <Text style={styles.walletChipValue}>{value}</Text>
      <Text style={styles.walletChipLabel}>{label}</Text>
    </View>
  );
}

function LedgerRow({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerDot} />
      <View style={styles.profileText}>
        <Text numberOfLines={1} style={styles.ledgerRowTitle}>
          {label}
        </Text>
        <Text numberOfLines={1} style={styles.ledgerRowMeta}>
          {meta}
        </Text>
      </View>
      <Text style={styles.ledgerRowValue}>{value}</Text>
    </View>
  );
}

function AssignmentComposer({
  createTaskPending,
  fixedKind,
  onKindChange,
  onCreateTask,
  onSendNotification,
  proofTypes,
  sendNotificationPending = false,
  setProofTypes,
  setTaskForm,
  showAssignmentToggle = false,
  taskForm,
  title,
}: {
  createTaskPending: boolean;
  fixedKind: AssignmentMode;
  onKindChange?: (kind: AssignmentMode) => void;
  onCreateTask: (kind: TaskKind) => void;
  onSendNotification?: () => void;
  proofTypes: Array<ProofType>;
  sendNotificationPending?: boolean;
  setProofTypes: React.Dispatch<React.SetStateAction<Array<ProofType>>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  showAssignmentToggle?: boolean;
  taskForm: typeof emptyTaskForm;
  title: string;
}) {
  const isRegularTask = fixedKind === "task";
  const isSpotChallenge = fixedKind === "challenge";
  const isGame = fixedKind === "game";
  const isSpecialTask = fixedKind === "special";
  const isNotification = fixedKind === "notification";
  const effectiveProofTypes = isNotification ? [] : normalizeTaskProofTypes(fixedKind, proofTypes);
  const selectableProofTypeOptions = isGame
    ? proofTypeOptions.filter((option) => option.value === "game_score")
    : proofTypeOptions.filter((option) => option.value !== "game_score");
  const canSubmitNotification =
    isNotification && taskForm.title.trim() && taskForm.description.trim() && !sendNotificationPending;
  const canSubmitTask =
    !isNotification &&
    taskForm.title.trim() &&
    taskForm.description.trim() &&
    taskForm.dueAt.trim() &&
    (!isSpecialTask || taskForm.assignedToEmail.trim()) &&
    !createTaskPending;

  const handleProofTypePress = (proofType: ProofType) => {
    if (isGame || isNotification) {
      return;
    }

    const locked = isRegularTask && defaultRegularProofTypes.includes(proofType);

    if (locked) {
      return;
    }

    setProofTypes((current) => {
      const base = isRegularTask ? defaultRegularProofTypes : [];
      if (current.includes(proofType)) {
        const next = current.filter((item) => item !== proofType);
        return [...new Set([...base, ...next])];
      }
      return [...new Set([...base, ...current, proofType])];
    });
  };

  const badgeLabel = isSpecialTask
    ? "One member"
    : isNotification
      ? "Room nudge"
      : "All members";
  const badgeTone: Tone = isSpecialTask ? "orange" : isNotification ? "violet" : "cyan";
  const fieldLabel = isNotification
    ? "Notification title"
    : isGame
      ? "Game name"
      : isSpotChallenge
        ? "Challenge name"
        : "Assignment title";
  const dateLabel = isGame
    ? "Game date and time"
    : isSpotChallenge
      ? "Challenge date and time"
      : isSpecialTask
        ? "Special task due date and time"
        : "Due date and time";
  const descriptionLabel = isNotification
    ? "Message"
    : isSpotChallenge || isGame
      ? "Rules / brief"
      : "Description";
  const descriptionPlaceholder = isNotification
    ? "Nudge everyone with the next step, reminder, or deadline."
    : isGame
      ? "Tell members what score, attempt, or result the host will verify."
      : isSpotChallenge
        ? "Describe the fun challenge, who can join, and how winners will be picked."
        : isSpecialTask
          ? "Give this member a focused follow-up task and explain the expected proof."
          : "Submit a functional demo. GitHub and Drive proof are mandatory.";

  return (
    <View style={styles.assignmentComposer}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionEyebrow}>Organizer Track</Text>
          <Text style={styles.sectionTitleSmall}>{title}</Text>
        </View>
        <StatusPill label={badgeLabel} tone={badgeTone} />
      </View>

      {showAssignmentToggle ? (
        <>
          <View style={styles.kindSwitchRow}>
            <KindButton
              active={isRegularTask}
              icon="clipboard-outline"
              label="Regular Task"
              onPress={() => onKindChange?.("task")}
            />
            <KindButton
              active={isSpotChallenge}
              icon="flash-outline"
              label="Spot Challenge"
              onPress={() => onKindChange?.("challenge")}
            />
          </View>
          <View style={styles.kindSwitchRow}>
            <KindButton
              active={isSpecialTask}
              icon="star-outline"
              label="Special Task"
              onPress={() => onKindChange?.("special")}
            />
            <KindButton
              active={isNotification}
              icon="notifications-outline"
              label="Notification"
              onPress={() => onKindChange?.("notification")}
            />
          </View>
        </>
      ) : null}

      {isSpecialTask ? (
        <Field label="Registered member email">
          <HackTextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(value) =>
              setTaskForm((current) => ({ ...current, assignedToEmail: value }))
            }
            placeholder="member@company.com"
            value={taskForm.assignedToEmail}
          />
        </Field>
      ) : null}

      <Field label={fieldLabel}>
        <HackTextInput
          onChangeText={(value) => setTaskForm((current) => ({ ...current, title: value }))}
          placeholder={
            fixedKind === "notification"
              ? "Final submission reminder"
              : fixedKind === "game"
              ? "Bug bash arena"
              : fixedKind === "challenge"
                ? "10-minute UX fix sprint"
                : fixedKind === "special"
                  ? "Private API integration follow-up"
                : "Build a working prototype"
          }
          value={taskForm.title}
        />
      </Field>

      {!isNotification ? (
        <DateTimeField
          label={dateLabel}
          onChange={(value) => setTaskForm((current) => ({ ...current, dueAt: value }))}
          value={taskForm.dueAt}
        />
      ) : null}

      {isGame ? (
        <Field label="Mini-game type">
          <View style={styles.gameTypeGrid}>
            {gameTypeOptions.map((option) => {
              const active = taskForm.gameType === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() =>
                    setTaskForm((current) => ({ ...current, gameType: option.value }))
                  }
                  style={({ pressed }) => [
                    styles.gameTypeOption,
                    active && styles.gameTypeOptionActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={active ? theme.award : theme.dim}
                  />
                  <View style={styles.profileText}>
                    <Text style={[styles.gameTypeTitle, active && styles.gameTypeTitleActive]}>
                      {option.label}
                    </Text>
                    <Text style={styles.gameTypeDescription}>{option.description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      <Field label={descriptionLabel}>
        <HackTextInput
          multiline
          onChangeText={(value) =>
            setTaskForm((current) => ({ ...current, description: value }))
          }
          placeholder={descriptionPlaceholder}
          style={styles.textAreaLarge}
          value={taskForm.description}
        />
      </Field>

      {!isNotification ? (
        <Field
          label={
            isGame
              ? "Game proof"
              : isRegularTask
                ? "Expected proof"
                : isSpecialTask
                  ? "Special task proof"
                  : "Challenge proof"
          }
        >
          <View style={styles.proofGrid}>
            {selectableProofTypeOptions.map((option) => {
              const active = effectiveProofTypes.includes(option.value);
              const locked =
                isGame || (isRegularTask && defaultRegularProofTypes.includes(option.value));
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => handleProofTypePress(option.value)}
                  style={[
                    styles.proofChip,
                    active && styles.proofChipActive,
                    locked && styles.proofChipLocked,
                  ]}
                >
                  <Text style={[styles.proofChipText, active && styles.proofChipTextActive]}>
                    {option.label}
                    {locked ? " required" : ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      {!isNotification ? (
        <Field label="XRDM reward">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) => setTaskForm((current) => ({ ...current, rewardXrdm: value }))}
            placeholder="20"
            value={taskForm.rewardXrdm}
          />
        </Field>
      ) : null}

      <HackButton
        disabled={isNotification ? !canSubmitNotification : !canSubmitTask}
        icon={
          isNotification
            ? "notifications-outline"
            : isGame
              ? "game-controller-outline"
              : isSpotChallenge
                ? "flash-outline"
                : isSpecialTask
                  ? "star-outline"
                  : "send-outline"
        }
        label={
          isNotification
            ? "Send Notification"
            : isGame
              ? "Create Game Card"
              : isSpotChallenge
                ? "Create Spot Challenge"
                : isSpecialTask
                  ? "Create Special Task"
                  : "Publish Regular Task"
        }
        loading={isNotification ? sendNotificationPending : createTaskPending}
        onPress={() =>
          isNotification ? onSendNotification?.() : onCreateTask(fixedKind as TaskKind)
        }
        tone={
          isNotification
            ? "violet"
            : isGame
              ? "gold"
              : isSpotChallenge || isSpecialTask
                ? "orange"
                : "violet"
        }
      />
    </View>
  );
}

function SubmissionReviewCard({
  approveSubmissionPending,
  award,
  feedback,
  mode,
  onApprove,
  onAwardChange,
  onFeedbackChange,
  onReturn,
  onSelectWinner,
  returnSubmissionPending,
  selectWinnerPending,
  submission,
}: {
  approveSubmissionPending?: boolean;
  award?: string;
  feedback?: string;
  mode: "history" | "review" | "winner";
  onApprove?: () => void;
  onAwardChange?: (value: string) => void;
  onFeedbackChange?: (value: string) => void;
  onReturn?: () => void;
  onSelectWinner?: () => void;
  returnSubmissionPending?: boolean;
  selectWinnerPending?: boolean;
  submission: HackSubmission;
}) {
  const displayParticipantName = submission.submitterName?.trim() || submission.participantName;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar name={displayParticipantName} tone="cyan" />
        <View style={styles.reviewTitleBlock}>
          <Text style={styles.cardTitle}>{displayParticipantName}</Text>
          <Text style={styles.cardMeta}>
            {submission.roomName} - {submission.taskTitle}
          </Text>
        </View>
        <StatusPill
          label={submissionStatusLabel(submission.status)}
          tone={statusTone(submission.status)}
        />
      </View>

      <SubmissionMetaBlock submission={submission} />
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      {submission.notes ? <Text style={styles.notesText}>{submission.notes}</Text> : null}

      {mode !== "history" ? (
        <Field label={mode === "review" ? "Organizer note (required)" : "Host feedback"}>
          <HackTextInput
            multiline
            onChangeText={onFeedbackChange}
            placeholder="Add a citation, decision note, or return reason."
            style={styles.textArea}
            value={feedback}
          />
        </Field>
      ) : submission.hostFeedback ? (
        <Text style={styles.feedbackText}>{submission.hostFeedback}</Text>
      ) : null}

      {mode === "winner" ? (
        <Field label="XRDM award">
          <HackTextInput keyboardType="number-pad" onChangeText={onAwardChange} value={award} />
        </Field>
      ) : null}

      {mode === "review" ? (
        <View style={styles.reviewActions}>
          <HackButton
            disabled={returnSubmissionPending}
            label="Return"
            loading={returnSubmissionPending}
            onPress={onReturn ?? (() => {})}
            tone="red"
          />
          <HackButton
            disabled={approveSubmissionPending}
            icon="checkmark-circle-outline"
            label="Verify Proof"
            loading={approveSubmissionPending}
            onPress={onApprove ?? (() => {})}
            tone="cyan"
          />
        </View>
      ) : null}

      {mode === "winner" ? (
        <HackButton
          disabled={selectWinnerPending}
          icon="trophy-outline"
          label="Announce Winner"
          loading={selectWinnerPending}
          onPress={onSelectWinner ?? (() => {})}
          tone="gold"
        />
      ) : null}
    </View>
  );
}

function QuickActionTile({
  active,
  icon,
  label,
  onPress,
  tone = "violet",
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone?: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionTile,
        {
          borderColor: active ? toneColors.border : theme.border,
          borderTopColor: active ? toneColors.fg : toneColors.border,
        },
        active && { backgroundColor: toneColors.bg },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.quickActionIconBg,
          {
            backgroundColor: active ? toneColors.bg : theme.surface,
            borderColor: active ? toneColors.border : theme.border,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={active ? toneColors.fg : theme.muted}
        />
      </View>
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.78}
        style={[styles.quickActionText, active && { color: toneColors.fg }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TrackLabel({ label, tone }: { label: string; tone: Tone }) {
  const toneColors = getToneColors(tone);
  return (
    <View style={styles.trackLabelRow}>
      <View style={[styles.trackLabelLine, { backgroundColor: toneColors.fg }]} />
      <Text style={[styles.trackLabelText, { color: toneColors.fg }]}>{label}</Text>
    </View>
  );
}

function KindButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.kindButton, active && styles.kindButtonActive]}
    >
      <Ionicons name={icon} size={16} color={active ? theme.host : theme.muted} />
      <Text style={[styles.kindButtonText, active && styles.kindButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: number;
}) {
  return (
    <View style={styles.miniStat}>
      <Ionicons name={icon} size={16} color={theme.participant} />
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.miniStatLabel}>
        {label}
      </Text>
    </View>
  );
}

function ParticipantListItem({
  participant,
}: {
  participant: HackRoom["participants"][number];
}) {
  return (
    <View style={styles.participantRow}>
      <Avatar name={participant.name} tone="cyan" />
      <View style={styles.profileText}>
        <Text style={styles.profileName}>{participant.name}</Text>
        <Text style={styles.profileEmail}>{participant.email}</Text>
      </View>
      <Text style={styles.cardMeta}>{formatDate(participant.joinedAt)}</Text>
    </View>
  );
}

function ParticipantTrack({
  inviteCode,
  joinedRooms,
  joinRoomPending,
  mySubmissions,
  onInviteCodeChange,
  onJoinRoom,
  onSelectTask,
  onSubmitProof,
  participantTasks,
  selectedTask,
  selectedTaskId,
  submitForm,
  submitProofPending,
  updateSubmitForm,
}: {
  inviteCode: string;
  joinedRooms: DashboardData["joinedRooms"];
  joinRoomPending: boolean;
  mySubmissions: DashboardData["mySubmissions"];
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  participantTasks: DashboardData["tasks"];
  selectedTask?: HackTask;
  selectedTaskId: string;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
  updateSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
}) {
  return (
    <View style={styles.trackStack}>
      <Panel eyebrow="Member Track" icon="key-outline" title="Join a Hack Room" tone="cyan">
        <Field label="Invite code">
          <HackTextInput
            autoCapitalize="characters"
            onChangeText={onInviteCodeChange}
            placeholder="HR-ABC123"
            value={inviteCode}
          />
        </Field>
        <HackButton
          disabled={!inviteCode.trim() || joinRoomPending}
          icon="enter-outline"
          label="Join Room"
          loading={joinRoomPending}
          onPress={onJoinRoom}
          tone="cyan"
        />

        <View style={styles.listStack}>
          {joinedRooms.length ? (
            joinedRooms.map((room) => <RoomCard key={room._id} role="member" room={room} />)
          ) : (
            <EmptyState
              icon="enter-outline"
              text="Paste an invite code from your host to unlock assignments."
            />
          )}
        </View>
      </Panel>

      <Panel
        action={<CounterLabel label={`${participantTasks.length} tasks`} />}
        eyebrow="My Work"
        icon="clipboard-outline"
        title="Assignments and Proof"
        tone="cyan"
      >
        <View style={styles.listStack}>
          {participantTasks.length ? (
            participantTasks.map((task) => {
              const submission = mySubmissions.find((item) => item.taskId === task._id);
              return (
                <TaskCard
                  key={task._id}
                  onPress={() => onSelectTask(task._id)}
                  selected={selectedTaskId === task._id}
                  status={submission?.status}
                  task={task}
                />
              );
            })
          ) : (
            <EmptyState
              icon="clipboard-outline"
              text="No assignments yet. Join a room or wait for your host to publish one."
            />
          )}
        </View>

        <View style={styles.submitCard}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionEyebrow}>Submit Proof</Text>
              <Text style={styles.sectionTitleSmall}>
                {selectedTask?.title ?? "Select an assignment"}
              </Text>
            </View>
            {selectedTask ? (
              <StatusPill label={`+${selectedTask.rewardXrdm} XRDM`} tone="gold" />
            ) : null}
          </View>

          <Field label="Proof link">
            <HackTextInput
              autoCapitalize="none"
              keyboardType="url"
              onChangeText={(value) =>
                updateSubmitForm((current) => ({ ...current, proofUrl: value }))
              }
              placeholder="https://github.com/team/project"
              value={submitForm.proofUrl}
            />
          </Field>

          <Field label="Note to host">
            <HackTextInput
              multiline
              onChangeText={(value) =>
                updateSubmitForm((current) => ({ ...current, notes: value }))
              }
              placeholder="Mention branch, demo timestamp, or implementation notes."
              style={styles.textArea}
              value={submitForm.notes}
            />
          </Field>

          <HackButton
            disabled={!selectedTask || !submitForm.proofUrl.trim() || submitProofPending}
            icon="send-outline"
            label="Submit for Review"
            loading={submitProofPending}
            onPress={onSubmitProof}
            tone="cyan"
          />
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionEyebrow}>My Participation Proof</Text>
        <View style={styles.listStack}>
          {mySubmissions.length ? (
            mySubmissions.map((submission) => (
              <SubmissionCard key={submission._id} submission={submission} />
            ))
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              text="Submitted proof will appear here as your participation record."
            />
          )}
        </View>
      </Panel>
    </View>
  );
}

function HostTrack({
  awardBySubmission,
  createRoomPending,
  createTaskPending,
  feedbackBySubmission,
  hostedRooms,
  hostSubmissions,
  onCreateRoom,
  onCreateTask,
  onReturnSubmission,
  onSelectWinner,
  onShareRoom,
  pendingHostSubmissions,
  proofTypes,
  returnSubmissionPending,
  roomForm,
  selectWinnerPending,
  setAwardBySubmission,
  setFeedbackBySubmission,
  setProofTypes,
  setRoomForm,
  setTaskForm,
  setTaskRoomId,
  taskForm,
  taskRoomId,
  winnerSubmissions,
}: {
  awardBySubmission: Record<string, string>;
  createRoomPending: boolean;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  hostedRooms: DashboardData["hostedRooms"];
  hostSubmissions: DashboardData["hostSubmissions"];
  onCreateRoom: () => void;
  onCreateTask: () => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareRoom: (room: HackRoom) => void;
  pendingHostSubmissions: DashboardData["hostSubmissions"];
  proofTypes: Array<ProofType>;
  returnSubmissionPending: boolean;
  roomForm: typeof emptyRoomForm;
  selectWinnerPending: boolean;
  setAwardBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFeedbackBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setProofTypes: (proofType: ProofType) => void;
  setRoomForm: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  setTaskRoomId: (roomId: string) => void;
  taskForm: typeof emptyTaskForm;
  taskRoomId: string;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  return (
    <View style={styles.trackStack}>
      <Panel eyebrow="Organizer Track" icon="add-circle-outline" title="Create Hack Room" tone="violet">
        <Field label="Room name">
          <HackTextInput
            onChangeText={(value) => setRoomForm((current) => ({ ...current, name: value }))}
            placeholder="AI Agents Sprint"
            value={roomForm.name}
          />
        </Field>
        <Field label="Room brief">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setRoomForm((current) => ({ ...current, description: value }))
            }
            placeholder="Members build and submit working demos by deadline."
            style={styles.textArea}
            value={roomForm.description}
          />
        </Field>
        <HackButton
          disabled={!roomForm.name.trim() || createRoomPending}
          icon="add-outline"
          label="Create Room"
          loading={createRoomPending}
          onPress={onCreateRoom}
          tone="violet"
        />

        <View style={styles.listStack}>
          {hostedRooms.length ? (
            hostedRooms.map((room) => (
              <View key={room._id} style={styles.hostRoomCard}>
                <RoomCard role="host" room={room} />
                <View style={styles.inviteStrip}>
                  <Ionicons name="key-outline" size={16} color={theme.host} />
                  <Text numberOfLines={1} style={styles.inviteCode}>
                    {room.inviteCode}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onShareRoom(room)}
                    style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="share-outline" size={15} color={theme.host} />
                    <Text style={styles.shareText}>Share</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <EmptyState icon="shield-outline" text="Create a room to get a shareable invite code." />
          )}
        </View>
      </Panel>

      <Panel
        action={<CounterLabel label={`${hostedRooms.length} rooms`} />}
        eyebrow="Assignment"
        icon="clipboard-outline"
        title="Set Task for Members"
        tone="violet"
      >
        {hostedRooms.length ? (
          <ScrollView
            contentContainerStyle={styles.roomSelector}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {hostedRooms.map((room) => (
              <Pressable
                accessibilityRole="button"
                key={room._id}
                onPress={() => setTaskRoomId(room._id)}
                style={[
                  styles.selectorChip,
                  taskRoomId === room._id && styles.selectorChipActive,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.selectorChipText,
                    taskRoomId === room._id && styles.selectorChipTextActive,
                  ]}
                >
                  {room.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <Field label="Task title">
          <HackTextInput
            onChangeText={(value) => setTaskForm((current) => ({ ...current, title: value }))}
            placeholder="Build a working prototype"
            value={taskForm.title}
          />
        </Field>
        <Field label="Due date">
          <HackTextInput
            onChangeText={(value) => setTaskForm((current) => ({ ...current, dueAt: value }))}
            placeholder="Tonight · 9:00 PM"
            value={taskForm.dueAt}
          />
        </Field>
        <Field label="Task brief">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setTaskForm((current) => ({ ...current, description: value }))
            }
            placeholder="Submit a demo link, repo, and notes showing the core feature."
            style={styles.textAreaLarge}
            value={taskForm.description}
          />
        </Field>

        <Field label="Expected proof">
          <View style={styles.proofGrid}>
            {proofTypeOptions.map((option) => {
              const active = proofTypes.includes(option.value);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => setProofTypes(option.value)}
                  style={[styles.proofChip, active && styles.proofChipActive]}
                >
                  <Text style={[styles.proofChipText, active && styles.proofChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="XRDM reward">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) => setTaskForm((current) => ({ ...current, rewardXrdm: value }))}
            placeholder="20"
            value={taskForm.rewardXrdm}
          />
        </Field>

        <HackButton
          disabled={
            !taskRoomId ||
            !taskForm.title.trim() ||
            !taskForm.description.trim() ||
            !taskForm.dueAt.trim() ||
            createTaskPending
          }
          icon="send-outline"
          label="Publish Task"
          loading={createTaskPending}
          onPress={onCreateTask}
          tone="violet"
        />
      </Panel>

      <Panel
        action={<CounterLabel label={`${pendingHostSubmissions.length} pending`} />}
        eyebrow="Verification"
        icon="ribbon-outline"
        title="Review Submissions"
        tone="violet"
      >
        <View style={styles.listStack}>
          {hostSubmissions.length ? (
            hostSubmissions.map((submission) => {
              const feedback =
                feedbackBySubmission[submission._id] ??
                submission.hostFeedback ??
                "Strong contribution and clear proof of participation.";
              const award =
                awardBySubmission[submission._id] ??
                String(submission.awardXrdm ?? submission.rewardXrdm ?? 20);

              return (
                <View key={submission._id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Avatar name={submission.participantName} tone="cyan" />
                    <View style={styles.reviewTitleBlock}>
                      <Text style={styles.cardTitle}>{submission.participantName}</Text>
                      <Text style={styles.cardMeta}>
                        {submission.roomName} · {submission.taskTitle}
                      </Text>
                    </View>
                    <StatusPill
                      label={submissionStatusLabel(submission.status)}
                      tone={statusTone(submission.status)}
                    />
                  </View>

                  <LinkRow url={submission.proofUrl} />
                  {submission.notes ? <Text style={styles.notesText}>{submission.notes}</Text> : null}

                  <Field label="Host feedback">
                    <HackTextInput
                      multiline
                      onChangeText={(value) =>
                        setFeedbackBySubmission((current) => ({
                          ...current,
                          [submission._id]: value,
                        }))
                      }
                      style={styles.textArea}
                      value={feedback}
                    />
                  </Field>
                  <Field label="XRDM award">
                    <HackTextInput
                      keyboardType="number-pad"
                      onChangeText={(value) =>
                        setAwardBySubmission((current) => ({
                          ...current,
                          [submission._id]: value,
                        }))
                      }
                      value={award}
                    />
                  </Field>

                  <View style={styles.reviewActions}>
                    <HackButton
                      disabled={returnSubmissionPending}
                      label="Return"
                      loading={returnSubmissionPending}
                      onPress={() => onReturnSubmission(submission)}
                      tone="red"
                    />
                    <HackButton
                      disabled={selectWinnerPending}
                      icon="trophy-outline"
                      label="Winner"
                      loading={selectWinnerPending}
                      onPress={() => onSelectWinner(submission)}
                      tone="gold"
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <EmptyState
              icon="ribbon-outline"
              text="Submissions from members will appear here for review."
            />
          )}
        </View>
      </Panel>

      <Panel eyebrow="Awards" icon="trophy-outline" title="Winners Picked" tone="gold">
        <View style={styles.listStack}>
          {winnerSubmissions.length ? (
            winnerSubmissions.map((submission) => (
              <SubmissionCard key={submission._id} submission={submission} />
            ))
          ) : (
            <EmptyState
              icon="trophy-outline"
              text="Selected winners will appear here with awarded XRDM."
            />
          )}
        </View>
      </Panel>
    </View>
  );
}

function AppHeader({
  notificationCount = 0,
  onNotificationPress,
}: {
  notificationCount?: number;
  onNotificationPress: () => void;
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const handleOpenMenu = () => {
    (navigation as { dispatch: (action: { type: string }) => void }).dispatch({
      type: "OPEN_DRAWER",
    });
  };
  const handleOpenProfile = () => {
    router.push("/profile");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.homeHeaderSafe}>
      <View style={styles.homeHeader}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={rdmLogo}
          style={styles.homeHeaderLogo}
        />
        <View style={styles.homeHeaderActions}>
          <HeaderIconButton
            accessibilityLabel="Notifications"
            badgeCount={notificationCount}
            icon="notifications-outline"
            onPress={onNotificationPress}
          />
          <HeaderIconButton
            accessibilityLabel="Open menu"
            icon="menu-outline"
            onPress={handleOpenMenu}
          />
          <HeaderIconButton
            accessibilityLabel="Profile"
            icon="person-circle-outline"
            onPress={handleOpenProfile}
            tone="profile"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function InviteActionButton({
  accessibilityLabel,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={theme.host} />
      <Text style={styles.shareText}>{label}</Text>
    </Pressable>
  );
}

function HeaderIconButton({
  accessibilityLabel,
  badgeCount = 0,
  icon,
  onPress,
  tone = "default",
}: {
  accessibilityLabel: string;
  badgeCount?: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  tone?: "default" | "profile";
}) {
  const color = tone === "profile" ? theme.participant : theme.text;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.headerIconButton,
        tone === "profile" && styles.headerProfileButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={22} color={color} />
      {badgeCount > 0 ? (
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={styles.profileRowLabel}>{label}</Text>
      <Text selectable style={styles.profileRowValue}>
        {value}
      </Text>
    </View>
  );
}

function Panel({
  action,
  children,
  eyebrow,
  icon,
  title,
  tone,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  eyebrow: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <View style={[styles.panel, { borderColor: toneColors.border, backgroundColor: toneColors.bg }]}>
      <View style={styles.panelHeader}>
        <View style={styles.panelTitleRow}>
          <View style={[styles.panelIcon, { borderColor: toneColors.border }]}>
            <Ionicons name={icon} size={20} color={toneColors.fg} />
          </View>
          <View style={styles.panelTitleBlock}>
            <Text style={[styles.panelEyebrow, { color: toneColors.fg }]}>{eyebrow}</Text>
            <Text style={styles.panelTitle}>{title}</Text>
          </View>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function HackTextInput({
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  style?: React.ComponentProps<typeof TextInput>["style"];
}) {
  return (
    <TextInput
      placeholderTextColor={theme.dim}
      selectionColor={theme.participant}
      style={[styles.input, props.multiline && styles.inputMultiline, style]}
      {...props}
    />
  );
}

function DateTimeField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const pickerDate = parseDateTimeValue(value);

  const handlePickerValueChange = (_event: unknown, selectedDate: Date) => {
    if (Platform.OS !== "ios") {
      setPickerMode(null);
    }

    if (!pickerMode) {
      return;
    }

    const baseDate = parseDateTimeValue(value);
    const nextDate =
      pickerMode === "date"
        ? mergeDateParts(baseDate, selectedDate)
        : mergeTimeParts(baseDate, selectedDate);

    onChange(nextDate.toISOString());
  };

  const handlePickerDismiss = () => {
    if (Platform.OS !== "ios") {
      setPickerMode(null);
    }
  };

  const openAndroidPicker = (mode: "date" | "time") => {
    DateTimePickerAndroid.open({
      mode,
      onDismiss: handlePickerDismiss,
      onNeutralButtonPress: handlePickerDismiss,
      onValueChange: (event, selectedDate) => {
        const baseDate = parseDateTimeValue(value);
        const nextDate =
          mode === "date"
            ? mergeDateParts(baseDate, selectedDate)
            : mergeTimeParts(baseDate, selectedDate);

        onChange(nextDate.toISOString());
        setPickerMode(null);
      },
      value: pickerDate,
    });
  };

  const handleOpenPicker = (mode: "date" | "time") => {
    if (Platform.OS === "android") {
      openAndroidPicker(mode);
      return;
    }

    setPickerMode(mode);
  };

  if (Platform.OS === "web") {
    return (
      <Field label={label}>
        <HackTextInput
          onChangeText={onChange}
          placeholder="2026-06-20T17:00:00.000Z"
          value={value}
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <View style={styles.datePickerCard}>
        <Text style={styles.datePickerValue}>
          {value ? formatDateTimeValue(value) : "Select date and time"}
        </Text>
        <View style={styles.datePickerActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenPicker("date")}
            style={({ pressed }) => [styles.datePickerButton, pressed && styles.pressed]}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.host} />
            <Text style={styles.datePickerButtonText}>Date</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenPicker("time")}
            style={({ pressed }) => [styles.datePickerButton, pressed && styles.pressed]}
          >
            <Ionicons name="time-outline" size={16} color={theme.host} />
            <Text style={styles.datePickerButtonText}>Time</Text>
          </Pressable>
        </View>
      </View>

      {Platform.OS === "ios" && pickerMode ? (
        <View style={styles.nativePickerWrap}>
          <DateTimePicker
            display={Platform.OS === "ios" ? "spinner" : "default"}
            mode={pickerMode}
            onDismiss={handlePickerDismiss}
            onNeutralButtonPress={handlePickerDismiss}
            onValueChange={handlePickerValueChange}
            value={pickerDate}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerMode(null)}
              style={({ pressed }) => [styles.dateDoneButton, pressed && styles.pressed]}
            >
              <Text style={styles.dateDoneText}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Field>
  );
}

function ProofRequirementFields({
  selectedTask,
  setSubmitForm,
  submitForm,
}: {
  selectedTask?: HackTask;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
}) {
  if (!selectedTask) {
    return <EmptyState icon="clipboard-outline" text="Select an assignment to see required proof." />;
  }

  const requiredProofTypes = getTaskProofTypes(selectedTask);

  return (
    <View style={styles.proofRequirementStack}>
      {requiredProofTypes.map((proofType) => (
        <Field key={proofType} label={`${proofTypeLabel(proofType)} proof`}>
          <HackTextInput
            autoCapitalize="none"
            keyboardType={proofType === "game_score" ? "default" : "url"}
            onChangeText={(value) =>
              setSubmitForm((current) => ({
                ...current,
                proofItems: {
                  ...current.proofItems,
                  [proofType]: value,
                },
                proofUrl: proofType === requiredProofTypes[0] ? value : current.proofUrl,
              }))
            }
            placeholder={proofTypePlaceholder(proofType)}
            value={submitForm.proofItems[proofType] ?? ""}
          />
        </Field>
      ))}
    </View>
  );
}

function ProofItemsList({ proofItems }: { proofItems: Array<SubmissionProofItem> }) {
  if (!proofItems.length) {
    return <EmptyState icon="link-outline" text="No proof links were attached." />;
  }

  return (
    <View style={styles.proofItemList}>
      <Text style={styles.proofItemSectionLabel}>Submitted proof</Text>
      {proofItems.map((proofItem, index) => (
        <ProofItemRow index={index} key={`${proofItem.type}-${index}`} proofItem={proofItem} />
      ))}
    </View>
  );
}

function ProofItemRow({
  index,
  proofItem,
}: {
  index: number;
  proofItem: SubmissionProofItem;
}) {
  const isLinkProof = proofItem.type !== "game_score";

  return (
    <Pressable
      accessibilityRole={isLinkProof ? "link" : "text"}
      disabled={!isLinkProof}
      onPress={isLinkProof ? () => Linking.openURL(proofItem.value) : undefined}
      style={({ pressed }) => [styles.proofItemRow, pressed && styles.pressed]}
    >
      <View style={styles.proofItemIcon}>
        <Ionicons name={proofTypeIcon(proofItem.type)} size={15} color={theme.participant} />
      </View>
      <View style={styles.proofItemTextBlock}>
        <Text style={styles.proofItemType}>
          {proofTypeLabel(proofItem.type)} {index + 1}
        </Text>
        <Text numberOfLines={1} style={styles.proofItemValue}>
          {proofItem.value}
        </Text>
      </View>
      <Text style={styles.proofItemOpen}>{isLinkProof ? "Open" : "Result"}</Text>
    </Pressable>
  );
}

function HackButton({
  disabled,
  icon,
  label,
  loading,
  onPress,
  tone,
}: {
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  loading?: boolean;
  onPress: () => void;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: toneColors.fg },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={toneColors.buttonText} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={17} color={toneColors.buttonText} /> : null}
          <Text style={[styles.buttonText, { color: toneColors.buttonText }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function RoleButton({
  active,
  description,
  icon,
  label,
  onPress,
  tone,
}: {
  active: boolean;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tone: "cyan" | "violet";
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.roleButton,
        active && {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.fg,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={active ? toneColors.fg : theme.muted} />
      <Text style={[styles.roleTitle, active && { color: toneColors.fg }]}>{label}</Text>
      <Text style={styles.roleDescription}>{description}</Text>
    </Pressable>
  );
}

function MetricCard({
  icon,
  label,
  tone,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  tone: Tone;
  value: number;
}) {
  const toneColors = getToneColors(tone);
  return (
    <View style={[styles.metricCard, { backgroundColor: toneColors.bg, borderColor: toneColors.border }]}>
      <Ionicons name={icon} size={18} color={toneColors.fg} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function HomeHubTile({
  icon,
  label,
  meta,
  onPress,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  meta: string;
  onPress: () => void;
  tone: Tone;
}) {
  const toneColors = getToneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.homeHubTile,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={19} color={toneColors.fg} />
      <Text style={[styles.homeHubTileLabel, { color: toneColors.fg }]}>{label}</Text>
      <Text numberOfLines={2} style={styles.homeHubTileMeta}>
        {meta}
      </Text>
    </Pressable>
  );
}

function RoomCard({ role, room }: { role: Role; room: HackRoom | DashboardData["joinedRooms"][number] }) {
  const tone = role === "host" ? "violet" : "cyan";
  return (
    <View style={styles.roomCard}>
      <Avatar name={room.name} tone={tone} />
      <View style={styles.roomBody}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {room.name}
        </Text>
        <Text numberOfLines={2} style={styles.cardDescription}>
          {room.description || `Hosted by ${room.hostName}`}
        </Text>
        <Text style={styles.cardMeta}>
          {room.participants.length} members · {room.inviteCode}
        </Text>
      </View>
    </View>
  );
}

function TaskCard({
  onPress,
  selected,
  status,
  task,
}: {
  onPress: () => void;
  selected: boolean;
  status?: SubmissionStatus;
  task: HackTask;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.taskCard, selected && styles.taskCardSelected]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{task.title}</Text>
          <Text style={styles.cardMeta}>
            {task.roomName} · Due {task.dueAt}
          </Text>
        </View>
        <StatusPill
          label={status ? submissionStatusLabel(status) : `+${task.rewardXrdm} XRDM`}
          tone={statusTone(status)}
        />
      </View>
      <Text numberOfLines={3} style={styles.cardDescription}>
        {task.description}
      </Text>
      {task.kind === "special" && task.assignedToEmail ? (
        <View style={styles.specialAssigneeRow}>
          <Ionicons name="person-outline" size={13} color={theme.warning} />
          <Text numberOfLines={1} style={styles.specialAssigneeText}>
            For {task.assignedToName || task.assignedToEmail}
          </Text>
        </View>
      ) : null}
      <View style={styles.proofTypeRow}>
        <Text style={styles.proofTypeLabel}>{kindLabel(task.kind ?? "task")}</Text>
        {getTaskProofTypes(task).map((proofType) => (
          <Text key={proofType} style={styles.proofTypeLabel}>
            {proofTypeLabel(proofType)}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

function SubmissionCard({
  submission,
}: {
  submission:
    | DashboardData["hostSubmissions"][number]
    | DashboardData["mySubmissions"][number]
    | DashboardData["visibleWinners"][number];
}) {
  return (
    <View style={styles.submissionCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.taskTitleBlock}>
          <Text style={styles.cardTitle}>{submission.taskTitle}</Text>
          <Text style={styles.cardMeta}>{submission.roomName}</Text>
        </View>
        <StatusPill
          label={submissionStatusLabel(submission.status)}
          tone={statusTone(submission.status)}
        />
      </View>
      <SubmissionMetaBlock submission={submission} />
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      <View style={styles.awardRow}>
        <Text style={styles.cardMeta}>{formatDate(submission.submittedAt)}</Text>
        <Text style={styles.awardText}>
          +{submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM
        </Text>
      </View>
      {submission.hostFeedback ? (
        <Text style={styles.feedbackText}>{submission.hostFeedback}</Text>
      ) : null}
    </View>
  );
}

function SubmissionMetaBlock({
  submission,
}: {
  submission: {
    participantName: string;
    submissionDescription?: string;
    submitterName?: string;
    teamMateEmails?: Array<string>;
    teamName?: string;
  };
}) {
  const submittedBy = submission.submitterName?.trim() || submission.participantName;
  const teamName = submission.teamName?.trim();
  const description = submission.submissionDescription?.trim();
  const teamMateEmails = submission.teamMateEmails ?? [];

  if (!teamName && !description && !teamMateEmails.length && !submission.submitterName?.trim()) {
    return null;
  }

  return (
    <View style={styles.submissionMetaBox}>
      <View style={styles.submissionMetaRow}>
        <Text style={styles.submissionMetaLabel}>Student</Text>
        <Text numberOfLines={1} style={styles.submissionMetaText}>
          {submittedBy}
        </Text>
      </View>
      {teamName ? (
        <View style={styles.submissionMetaRow}>
          <Text style={styles.submissionMetaLabel}>Team</Text>
          <Text numberOfLines={1} style={styles.submissionMetaText}>
            {teamName}
          </Text>
        </View>
      ) : null}
      {teamMateEmails.length ? (
        <View style={styles.submissionMateBlock}>
          <Text style={styles.submissionMetaLabel}>Mates</Text>
          <View style={styles.submissionMateChips}>
            {teamMateEmails.map((email) => (
              <Text key={email} numberOfLines={1} style={styles.submissionMateChip}>
                {email}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {description ? <Text style={styles.submissionDescriptionText}>{description}</Text> : null}
    </View>
  );
}

function LinkRow({ url }: { url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => Linking.openURL(url)}
      style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
    >
      <Ionicons name="link-outline" size={16} color={theme.participant} />
      <Text numberOfLines={1} style={styles.linkText}>
        {url}
      </Text>
    </Pressable>
  );
}

function Avatar({ name, tone }: { name: string; tone: "cyan" | "violet" }) {
  const toneColors = getToneColors(tone);
  return (
    <View style={[styles.avatar, { backgroundColor: toneColors.bg, borderColor: toneColors.border }]}>
      <Text style={[styles.avatarText, { color: toneColors.fg }]}>{getInitials(name)}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={18} color={theme.dim} />
      </View>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  const toneColors = getToneColors(tone);
  return (
    <View style={[styles.statusPill, { backgroundColor: toneColors.bg, borderColor: toneColors.border }]}>
      <Text style={[styles.statusPillText, { color: toneColors.fg }]}>{label}</Text>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return <StatusBanner message={message} tone="red" />;
}

function StatusBanner({ message, tone }: { message: string; tone: Tone }) {
  const toneColors = getToneColors(tone);
  return (
    <View style={[styles.statusBanner, { backgroundColor: toneColors.bg, borderColor: toneColors.border }]}>
      <Ionicons name={tone === "red" ? "warning-outline" : "checkmark-circle-outline"} size={17} color={toneColors.fg} />
      <Text style={[styles.statusBannerText, { color: toneColors.fg }]}>{message}</Text>
    </View>
  );
}

function CounterLabel({ label }: { label: string }) {
  return <Text style={styles.counterLabel}>{label}</Text>;
}

function getToneColors(tone: Tone) {
  if (tone === "violet") {
    return {
      bg: theme.hostDark,
      border: theme.hostBorder,
      buttonText: "#060214",
      fg: theme.host,
    };
  }
  if (tone === "lime") {
    return {
      bg: theme.limeDark,
      border: theme.limeBorder,
      buttonText: "#081000",
      fg: theme.lime,
    };
  }
  if (tone === "sky") {
    return {
      bg: theme.skyDark,
      border: theme.skyBorder,
      buttonText: "#02101a",
      fg: theme.sky,
    };
  }
  if (tone === "gold") {
    return {
      bg: theme.awardDark,
      border: theme.awardBorder,
      buttonText: "#120d00",
      fg: theme.award,
    };
  }
  if (tone === "orange") {
    return {
      bg: theme.warningDark,
      border: theme.warningBorder,
      buttonText: "#170900",
      fg: theme.warning,
    };
  }
  if (tone === "red") {
    return {
      bg: theme.dangerDark,
      border: theme.dangerBorder,
      buttonText: "#220302",
      fg: theme.danger,
    };
  }
  return {
    bg: theme.participantDark,
    border: theme.participantBorder,
    buttonText: "#03120c",
    fg: theme.participant,
  };
}

function getGameTypeInfo(gameType: GameType) {
  return gameTypeOptions.find((option) => option.value === gameType) ?? gameTypeOptions[0];
}

function getTaskGameType(task: Pick<HackTask, "gameType">): GameType {
  return (task.gameType ?? "memory_match") as GameType;
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

function normalizeTaskProofTypes(kind: TaskKind, proofTypes: Array<ProofType>) {
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
  if (task?.kind === "game") {
    return defaultGameProofTypes;
  }

  if (task?.kind === "special") {
    return task.proofTypes?.length ? task.proofTypes : defaultSpecialProofTypes;
  }

  return task?.proofTypes?.length ? task.proofTypes : defaultSpotProofTypes;
}

function getEmailTokens(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isEmailLike(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizeEmails(values: Array<string>) {
  return [...new Set(values.map((email) => email.trim().toLowerCase()).filter(isEmailLike))];
}

function getInvalidEmails(values: Array<string>) {
  return values
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
    .filter((email) => !isEmailLike(email));
}

function buildProofItemsForTask(
  task: HackTask,
  submitForm: typeof emptySubmitForm,
): Array<SubmissionProofItem> {
  return getTaskProofTypes(task).map((proofType, index) => ({
    type: proofType,
    value: (submitForm.proofItems[proofType] || (index === 0 ? submitForm.proofUrl : "")).trim(),
  }));
}

function hasRequiredProofItems(task: HackTask, submitForm: typeof emptySubmitForm) {
  return buildProofItemsForTask(task, submitForm).every((proofItem) => proofItem.value.trim());
}

function canShowProofSubmitCard(status?: SubmissionStatus) {
  return !status || status === "returned";
}

function getSubmissionProofItems(submission: {
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

function proofTypeLabel(proofType: ProofType) {
  return proofTypeOptions.find((option) => option.value === proofType)?.label ?? proofType;
}

function proofTypePlaceholder(proofType: ProofType) {
  if (proofType === "github") return "https://github.com/team/project";
  if (proofType === "drive") return "https://drive.google.com/...";
  if (proofType === "video") return "https://loom.com/share/demo";
  if (proofType === "deck") return "https://docs.google.com/presentation/...";
  if (proofType === "file") return "https://drive.google.com/file/...";
  if (proofType === "game_score") return "Game result will appear here after completion";
  return "https://your-proof-link";
}

function proofTypeIcon(proofType: ProofType): React.ComponentProps<typeof Ionicons>["name"] {
  if (proofType === "github") return "logo-github";
  if (proofType === "drive") return "cloud-outline";
  if (proofType === "video") return "videocam-outline";
  if (proofType === "deck") return "easel-outline";
  if (proofType === "file") return "document-attach-outline";
  if (proofType === "game_score") return "game-controller-outline";
  return "link-outline";
}

function defaultRewardTitle(kind: RewardKind) {
  if (kind === "participant_certificate") return "Member Certificate";
  if (kind === "winner_certificate") return "Winner Certificate";
  return "Winner NFT Badge";
}

function rewardKindLabel(kind: RewardKind) {
  if (kind === "participant_certificate") return "Member";
  if (kind === "winner_certificate") return "Winner Cert";
  return "NFT Badge";
}

function rewardKindIcon(kind: RewardKind): React.ComponentProps<typeof Ionicons>["name"] {
  if (kind === "participant_certificate") return "ribbon-outline";
  if (kind === "winner_certificate") return "trophy-outline";
  return "diamond-outline";
}

function rewardKindTone(kind: RewardKind): Tone {
  if (kind === "winner_nft_badge") return "gold";
  if (kind === "winner_certificate") return "violet";
  return "cyan";
}

function submissionStatusLabel(status: SubmissionStatus) {
  if (status === "approved") return "Verified";
  if (status === "submitted") return "Submitted";
  if (status === "returned") return "Returned";
  if (status === "winner") return "Winner";
  return status;
}

function statusTone(status?: SubmissionStatus) {
  if (status === "winner") return "gold";
  if (status === "approved") return "cyan";
  if (status === "returned") return "red";
  if (status === "submitted") return "orange";
  return "gold";
}

function submissionHoldIcon(status: SubmissionStatus): React.ComponentProps<typeof Ionicons>["name"] {
  if (status === "winner") return "trophy-outline";
  if (status === "approved") return "checkmark-circle-outline";
  if (status === "returned") return "refresh-outline";
  return "hourglass-outline";
}

function taskKindTone(kind: TaskKind): Tone {
  if (kind === "challenge") return "orange";
  if (kind === "game") return "lime";
  if (kind === "special") return "sky";
  return "violet";
}

function kindLabel(kind: TaskKind) {
  if (kind === "challenge") return "Challenge";
  if (kind === "game") return "Game";
  if (kind === "special") return "Special";
  return "Task";
}

function notificationBannerMessage(notifications: Array<HackNotification>) {
  if (!notifications.length) {
    return "No new notifications right now";
  }

  const latest = notifications[0];
  return `${latest.title} - ${latest.roomName}: ${latest.message}`;
}

async function copyInviteCodeToClipboard(
  room: HackRoom,
  setMessage: (message: { text: string; tone: Tone }) => void,
) {
  try {
    await Clipboard.setStringAsync(room.inviteCode);
    setMessage({ text: `Copied invite code ${room.inviteCode}`, tone: "violet" });
  } catch {
    setMessage({ text: "Could not copy invite code. Please try again.", tone: "red" });
  }
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

function firstName(name: string) {
  return name.split(" ").filter(Boolean)[0] ?? "Hacker";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function parseDateTimeValue(value: string) {
  const parsedDate = value ? new Date(value) : new Date();
  if (Number.isNaN(parsedDate.getTime())) {
    return new Date();
  }
  return parsedDate;
}

function mergeDateParts(baseDate: Date, selectedDate: Date) {
  const nextDate = new Date(baseDate);
  nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  return nextDate;
}

function mergeTimeParts(baseDate: Date, selectedDate: Date) {
  const nextDate = new Date(baseDate);
  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return nextDate;
}

function formatDateTimeValue(value: string) {
  const date = parseDateTimeValue(value);
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}

const styles = StyleSheet.create({
  authBrandBlock: {
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
    width: "100%",
  },
  authBrandText: {
    alignItems: "center",
    gap: 5,
  },
  authCard: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 10,
    gap: 16,
    maxWidth: 392,
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    width: "100%",
  },
  authCardHeader: {
    alignItems: "center",
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 2,
    paddingBottom: 14,
  },
  authEyebrow: {
    color: theme.participant,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  authHeadline: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 33,
    textAlign: "center",
  },
  authIconBadge: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.borderStrong,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  authInput: {
    backgroundColor: "#101215",
    borderColor: theme.borderStrong,
    borderRadius: 11,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  authLogoFrame: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 6,
    height: 88,
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    width: 132,
  },
  authSecondaryActions: {
    gap: 8,
  },
  authLogo: {
    height: 58,
    width: 106,
  },
  authScrollContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 34,
  },
  authTitleBlock: {
    flex: 1,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  avatarText: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    fontWeight: "700",
  },
  awardRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  awardText: {
    color: theme.award,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 12,
    fontWeight: "700",
  },
  actionBackButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  actionBackText: {
    color: theme.host,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0,
  },
  participantActionBackButton: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
  },
  participantActionBackText: {
    color: theme.participant,
  },
  actionScreenHeader: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 11,
    borderWidth: 1,
    gap: 8,
    padding: 11,
  },
  actionScreenTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  actionTitleBlock: {
    gap: 4,
  },
  awardModeSwitch: {
    flexDirection: "row",
    gap: 8,
  },
  button: {
    alignItems: "center",
    borderRadius: 9,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardDescription: {
    color: theme.dim,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  cardMeta: {
    color: theme.faint,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
  },
  cardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  certificateHero: {
    alignItems: "center",
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  certificateHeroIcon: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.awardBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  certificateHeroText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  certificateHeroTitle: {
    color: theme.award,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  compactBusyRow: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  counterLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  dashboardContent: {
    gap: 11,
    padding: 12,
    paddingBottom: 112,
  },
  dashboardCopy: {
    color: theme.dim,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  dashboardHeadline: {
    color: theme.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 30,
  },
  dashboardHero: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 11,
    borderWidth: 1,
    padding: 13,
  },
  dateDoneButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: theme.host,
    borderRadius: 8,
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  dateDoneText: {
    color: "#060214",
    fontSize: 12,
    fontWeight: "900",
  },
  datePickerActions: {
    flexDirection: "row",
    gap: 8,
  },
  datePickerButton: {
    alignItems: "center",
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  datePickerButtonText: {
    color: theme.host,
    fontSize: 12,
    fontWeight: "900",
  },
  datePickerCard: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  datePickerValue: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "700",
  },
  detailBackButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 10,
  },
  detailBackText: {
    color: theme.participant,
    fontSize: 11,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.48,
  },
  divider: {
    backgroundColor: theme.borderSoft,
    height: 1,
    marginVertical: 6,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  emptyText: {
    color: theme.dim,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  emailAddButton: {
    alignItems: "center",
    backgroundColor: theme.participant,
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 38,
  },
  emailChip: {
    alignItems: "center",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    maxWidth: "100%",
    paddingLeft: 9,
    paddingRight: 4,
    paddingVertical: 4,
  },
  emailChipTextWarning: {
    color: theme.warning,
  },
  emailChipWarning: {
    backgroundColor: theme.warningDark,
    borderColor: theme.warningBorder,
  },
  emailChipRemove: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderRadius: 999,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  emailChipText: {
    color: theme.participant,
    flexShrink: 1,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    fontWeight: "800",
  },
  emailChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  emailComposer: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.participantBorder,
    borderRadius: 9,
    borderWidth: 1,
    gap: 7,
    padding: 8,
  },
  emailComposerInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  emailComposerInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  eyebrow: {
    color: theme.participant,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  feedbackText: {
    borderColor: theme.borderSoft,
    borderTopWidth: 1,
    color: theme.dim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingTop: 10,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    color: theme.faint,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  formTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
  },
  assignmentComposer: {
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderRadius: 11,
    borderWidth: 1,
    gap: 11,
    padding: 11,
  },
  createRoomCard: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 11,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  createRoomTrigger: {
    alignItems: "center",
    backgroundColor: theme.host,
    borderRadius: 9,
    flexDirection: "row",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  createRoomTriggerText: {
    color: "#060214",
    fontSize: 12,
    fontWeight: "900",
  },
  createdTaskCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  createdTaskBadges: {
    alignItems: "flex-end",
    gap: 5,
  },
  createdTaskCardSelected: {
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
  },
  createdTaskKindChip: {
    borderRadius: 9,
    borderWidth: 1,
    flexBasis: "47.8%",
    flexGrow: 1,
    minHeight: 58,
    padding: 9,
  },
  createdTaskKindCount: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },
  createdTaskKindGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  createdTaskKindLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
    marginTop: 1,
    textTransform: "uppercase",
  },
  createdTasksBlock: {
    gap: 10,
  },
  headerIconButton: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  headerBadge: {
    alignItems: "center",
    backgroundColor: theme.warning,
    borderColor: theme.background,
    borderRadius: 999,
    borderWidth: 1,
    height: 15,
    justifyContent: "center",
    minWidth: 15,
    paddingHorizontal: 3,
    position: "absolute",
    right: -2,
    top: -3,
  },
  headerBadgeText: {
    color: "#170900",
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 8,
    fontWeight: "900",
  },
  headerProfileButton: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.borderStrong,
  },
  homeHeader: {
    alignItems: "center",
    backgroundColor: theme.background,
    borderBottomColor: theme.borderSoft,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  homeHeaderActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  homeHeaderLogo: {
    height: 38,
    width: 112,
  },
  homeHeaderSafe: {
    backgroundColor: theme.background,
  },
  homeHubGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  homeHubTile: {
    borderRadius: 11,
    borderWidth: 1,
    flexBasis: "47.8%",
    flexGrow: 1,
    minHeight: 92,
    padding: 11,
  },
  homeHubTileLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8,
  },
  homeHubTileMeta: {
    color: theme.dim,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  homeRoleTab: {
    alignItems: "center",
    borderBottomWidth: 2,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 36,
  },
  homeRoleTabHost: {
    backgroundColor: theme.hostDark,
    borderBottomColor: theme.host,
  },
  homeRoleTabParticipant: {
    backgroundColor: theme.participantDark,
    borderBottomColor: theme.participant,
  },
  homeRoleTabs: {
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    overflow: "hidden",
  },
  homeRoleTabText: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
  },
  homeRoleTabTextHost: {
    color: theme.host,
  },
  homeRoleTabTextParticipant: {
    color: theme.participant,
  },
  hostRoomCard: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  input: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.text,
    fontSize: 13,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: "top",
  },
  inviteCode: {
    color: theme.host,
    flex: 1,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 13,
    fontWeight: "700",
  },
  inviteInputColumn: {
    flex: 1,
    gap: 7,
  },
  inviteJoinRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
  },
  inviteMiniRow: {
    alignItems: "center",
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  inviteMiniText: {
    color: theme.host,
    flex: 1,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 11,
    fontWeight: "800",
  },
  inviteStrip: {
    alignItems: "center",
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    padding: 9,
  },
  joinTightButton: {
    alignItems: "center",
    backgroundColor: theme.participant,
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    height: 38,
    justifyContent: "center",
    minWidth: 64,
    paddingHorizontal: 10,
  },
  joinTightText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "900",
  },
  kindButton: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 8,
  },
  kindButtonActive: {
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
  },
  kindButtonText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  kindButtonTextActive: {
    color: theme.host,
  },
  kindSwitchRow: {
    flexDirection: "row",
    gap: 8,
  },
  gameAssignmentCard: {
    backgroundColor: theme.limeDark,
    borderColor: theme.limeBorder,
    borderRadius: 11,
    borderWidth: 1,
    padding: 11,
  },
  gameAssignmentIcon: {
    alignItems: "center",
    backgroundColor: theme.limeDark,
    borderColor: theme.limeBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  gameControlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  latestGameResultCard: {
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  latestGameResultText: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  latestGameResultTitle: {
    color: theme.award,
    fontSize: 13,
    fontWeight: "900",
  },
  gamesBanner: {
    alignItems: "center",
    backgroundColor: theme.limeDark,
    borderColor: theme.limeBorder,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
    padding: 10,
  },
  gamesBannerText: {
    color: theme.dim,
    fontSize: 11,
    lineHeight: 16,
  },
  gamesBannerTitle: {
    color: theme.lime,
    fontSize: 12,
    fontWeight: "800",
  },
  gameTypeDescription: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  gameTypeGrid: {
    gap: 8,
  },
  gameTypeOption: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  gameTypeOptionActive: {
    backgroundColor: theme.limeDark,
    borderColor: theme.limeBorder,
  },
  gameTypeTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "800",
  },
  gameTypeTitleActive: {
    color: theme.lime,
  },
  historyGroup: {
    gap: 8,
  },
  historyGroupHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  historyGroupTitle: {
    color: theme.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  historySummaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  linkRow: {
    alignItems: "center",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    padding: 10,
  },
  linkText: {
    color: theme.participant,
    flex: 1,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 11,
  },
  leaderboardRank: {
    color: theme.award,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 12,
    fontWeight: "900",
    width: 28,
  },
  leaderboardRow: {
    alignItems: "center",
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  leaderboardScore: {
    alignItems: "flex-end",
  },
  ledgerLinkCard: {
    alignItems: "center",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 11,
  },
  ledgerText: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  ledgerDot: {
    backgroundColor: theme.participant,
    borderRadius: 4,
    height: 8,
    marginTop: 4,
    width: 8,
  },
  ledgerRow: {
    alignItems: "flex-start",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 11,
  },
  ledgerRowMeta: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    marginTop: 2,
  },
  ledgerRowTitle: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "800",
  },
  ledgerRowValue: {
    color: theme.award,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 11,
    fontWeight: "900",
  },
  ledgerTitle: {
    color: theme.participant,
    fontSize: 13,
    fontWeight: "800",
  },
  listStack: {
    gap: 8,
    marginTop: 10,
  },
  loadingInline: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: theme.background,
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: {
    color: theme.muted,
    fontSize: 13,
  },
  metricCard: {
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    padding: 10,
  },
  metricLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    marginTop: 2,
    textTransform: "uppercase",
  },
  metricValue: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 5,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 13,
    maxWidth: 430,
    padding: 16,
    width: "100%",
  },
  modalCloseButton: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  modalKeyboardView: {
    justifyContent: "center",
    width: "100%",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(10, 12, 15, 0.82)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
  },
  modalTitleBlock: {
    flex: 1,
    gap: 4,
  },
  miniStat: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    padding: 9,
  },
  miniStatLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 8,
    marginTop: 1,
    textTransform: "uppercase",
  },
  miniStatValue: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 4,
  },
  breathPhase: {
    color: theme.lime,
    fontSize: 21,
    fontWeight: "900",
  },
  breathRing: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: theme.limeDark,
    borderColor: theme.lime,
    borderRadius: 74,
    borderWidth: 2,
    height: 148,
    justifyContent: "center",
    width: 148,
  },
  breathTime: {
    color: theme.muted,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 13,
    marginTop: 5,
  },
  mathQuestion: {
    color: theme.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    textAlign: "center",
  },
  mathQuestionCard: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  mathRound: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textAlign: "center",
    textTransform: "uppercase",
  },
  memoryCard: {
    alignItems: "center",
    aspectRatio: 1,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    width: "23%",
  },
  memoryCardOpen: {
    backgroundColor: theme.limeDark,
    borderColor: theme.lime,
  },
  memoryCardText: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
  },
  memoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  miniGameCloseButton: {
    alignItems: "center",
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  miniGameStack: {
    gap: 12,
    marginTop: 12,
  },
  miniGamePlayStack: {
    gap: 10,
  },
  miniGameStatRow: {
    flexDirection: "row",
    gap: 8,
  },
  miniGameSurface: {
    backgroundColor: theme.limeDark,
    borderColor: theme.limeBorder,
    borderRadius: 11,
    borderWidth: 1,
    gap: 10,
    marginBottom: 10,
    padding: 11,
  },
  mutedText: {
    color: theme.dim,
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  notesText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  nativePickerWrap: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 8,
  },
  nftBadgeCard: {
    alignItems: "center",
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    minHeight: 96,
    padding: 10,
    width: 92,
  },
  nftBadgeDate: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
  },
  nftBadgeName: {
    color: theme.text,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  nftShelf: {
    gap: 8,
    paddingBottom: 2,
  },
  panel: {
    borderRadius: 11,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  panelEyebrow: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  panelHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  panelIcon: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  panelTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0,
  },
  panelTitleBlock: {
    flex: 1,
    gap: 3,
  },
  panelTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  participantRow: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  pressed: {
    opacity: 0.74,
  },
  practiceGameCard: {
    alignItems: "center",
    backgroundColor: theme.limeDark,
    borderColor: theme.limeBorder,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    minHeight: 104,
    padding: 11,
    width: 116,
  },
  practiceGameMeta: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    textTransform: "uppercase",
  },
  practiceGameShelf: {
    gap: 8,
    paddingBottom: 2,
  },
  practiceGameTitle: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 12,
  },
  profileEmail: {
    color: theme.faint,
    fontSize: 11,
    marginTop: 1,
  },
  profileDetails: {
    gap: 10,
  },
  profileHero: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  profileName: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "700",
  },
  profileRow: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  profileRowLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  profileRowValue: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "700",
  },
  profileText: {
    flex: 1,
  },
  proofChip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  proofChipActive: {
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
  },
  proofChipLocked: {
    borderColor: theme.award,
  },
  proofChipText: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 11,
  },
  proofChipTextActive: {
    color: theme.host,
  },
  proofGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  proofItemIcon: {
    alignItems: "center",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  proofItemList: {
    gap: 7,
    marginTop: 10,
  },
  proofItemOpen: {
    color: theme.participant,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    fontWeight: "800",
  },
  proofItemRow: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 8,
  },
  proofItemSectionLabel: {
    color: theme.faint,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  proofItemTextBlock: {
    flex: 1,
    gap: 2,
  },
  proofItemType: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "800",
  },
  proofItemValue: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
  },
  proofRequirementStack: {
    gap: 10,
  },
  proofTypeLabel: {
    alignSelf: "flex-start",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.dim,
    flexShrink: 1,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    lineHeight: 12,
    maxWidth: "100%",
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  proofTypeRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 8,
    width: "100%",
  },
  quickActionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickActionIconBg: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  quickActionsSection: {
    gap: 9,
  },
  quickActionsTitle: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  quickActionText: {
    color: theme.dim,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0,
    textAlign: "center",
  },
  quickActionTextActive: {
    color: theme.text,
  },
  quickActionTile: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 11,
    borderTopWidth: 2,
    borderWidth: 1,
    flexBasis: "47.8%",
    flexGrow: 1,
    gap: 5,
    justifyContent: "center",
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  rewardCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  rewardIcon: {
    alignItems: "center",
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  rewardMetaRow: {
    alignItems: "center",
    borderTopColor: theme.borderSoft,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  rewardMetaText: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  rewardSelectorChip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: "100%",
    minWidth: 172,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  rewardSelectorChipActive: {
    backgroundColor: theme.awardDark,
    borderColor: theme.award,
  },
  rewardSelectorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rewardSelectorText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  rewardSelectorTextActive: {
    color: theme.award,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewCard: {
    backgroundColor: theme.surface,
    borderColor: theme.participantBorder,
    borderRadius: 11,
    borderWidth: 1,
    gap: 9,
    padding: 10,
  },
  reviewHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
  },
  reviewTitleBlock: {
    flex: 1,
  },
  roomShareIcon: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  roomShareFloatingWrap: {
    flexDirection: "row",
    gap: 6,
    position: "absolute",
    right: 10,
    top: 10,
  },
  roomShareIconSpacer: {
    height: 32,
    width: 70,
  },
  roomShelf: {
    gap: 10,
    paddingBottom: 2,
  },
  roomShelfHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomShelfHeaderOutside: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roomShelfSection: {
    gap: 10,
  },
  roomShelfTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  roomStatsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  roomWorkspace: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 11,
    borderWidth: 1,
    gap: 11,
    padding: 11,
  },
  roomWorkspaceHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  roomWorkspaceTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 21,
  },
  roomWorkspaceTitleBlock: {
    flex: 1,
  },
  roleButton: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 112,
    padding: 13,
  },
  roleDescription: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  roleSwitchGrid: {
    flexDirection: "row",
    gap: 10,
  },
  roleTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 11,
  },
  roomBody: {
    flex: 1,
  },
  roomCard: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 11,
  },
  roomSelector: {
    gap: 8,
    paddingBottom: 2,
  },
  returnedNoticeCard: {
    backgroundColor: theme.dangerDark,
    borderColor: theme.dangerBorder,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 9,
    padding: 10,
  },
  searchClearButton: {
    alignItems: "center",
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 7,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  searchInput: {
    backgroundColor: "transparent",
    borderWidth: 0,
    flex: 1,
    minHeight: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  searchInputWrap: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.awardBorder,
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  screen: {
    backgroundColor: theme.background,
    flex: 1,
  },
  selectableRoomCard: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 11,
    borderWidth: 1,
    minHeight: 126,
    overflow: "hidden",
    width: SCREEN_WIDTH - 48,
  },
  selectableRoomCardActive: {
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
  },
  selectableRoomContent: {
    padding: 10,
  },
  sectionEyebrow: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  sectionHeadingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionTitleSmall: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  selectorChip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectorChipActive: {
    backgroundColor: theme.hostDark,
    borderColor: theme.host,
  },
  selectorChipText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  selectorChipTextActive: {
    color: theme.host,
  },
  shareButton: {
    alignItems: "center",
    borderColor: theme.hostBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  shareText: {
    color: theme.host,
    fontSize: 11,
    fontWeight: "700",
  },
  statusBanner: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 9,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: 100,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusPillText: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  submissionCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    padding: 10,
  },
  submissionHoldCard: {
    borderRadius: 10,
    borderWidth: 1,
    gap: 9,
    marginTop: 9,
    padding: 10,
  },
  submissionHoldHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 9,
  },
  submissionHoldIcon: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  submissionHoldText: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  submissionHoldTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "900",
  },
  submissionDescriptionText: {
    color: theme.text,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  submissionMetaBox: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    marginTop: 10,
    padding: 9,
  },
  submissionMateBlock: {
    gap: 6,
  },
  submissionMateChip: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.participant,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  submissionMateChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  submissionMetaLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
    minWidth: 52,
    textTransform: "uppercase",
  },
  submissionMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  submissionMetaText: {
    color: theme.text,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  submitCard: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 10,
    borderWidth: 1,
    gap: 9,
    marginTop: 9,
    padding: 10,
  },
  submitDescriptionInput: {
    minHeight: 64,
  },
  submitMetaField: {
    flexBasis: "47.8%",
    flexGrow: 1,
    minWidth: 128,
  },
  submitMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  specialAssigneeRow: {
    alignItems: "center",
    backgroundColor: theme.warningDark,
    borderColor: theme.warningBorder,
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  specialAssigneeText: {
    color: theme.warning,
    flex: 1,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    fontWeight: "800",
  },
  taskCard: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 9,
    borderWidth: 1,
    overflow: "hidden",
    padding: 10,
  },
  taskCardSelected: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
  },
  taskTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  textArea: {
    minHeight: 76,
  },
  textAreaLarge: {
    minHeight: 96,
  },
  trackStack: {
    gap: 9,
  },
  trackLabelLine: {
    borderRadius: 2,
    height: 2,
    width: 24,
  },
  trackLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  trackLabelText: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    textTransform: "uppercase",
  },
  walletBalance: {
    color: theme.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
  },
  walletBalanceRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 5,
  },
  walletCard: {
    backgroundColor: theme.awardDark,
    borderColor: theme.awardBorder,
    borderRadius: 11,
    borderWidth: 1,
    gap: 8,
    padding: 11,
  },
  walletChip: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 9,
  },
  walletChipLabel: {
    color: theme.dim,
    fontSize: 10,
    marginTop: 2,
  },
  walletChipRow: {
    flexDirection: "row",
    gap: 8,
  },
  walletChipValue: {
    color: theme.award,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 13,
    fontWeight: "900",
  },
  walletLabel: {
    color: theme.awardBorder,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  walletUnit: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 11,
    marginBottom: 6,
  },
});
