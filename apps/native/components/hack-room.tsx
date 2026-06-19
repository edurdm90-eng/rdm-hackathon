import type { AppRouter } from "@rdm-hack/api/routers/index";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useNavigation } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { HACK_THEME as theme } from "@/lib/constants";
import { queryClient, trpc } from "@/utils/trpc";

const rdmLogo = require("@/assets/logo/rdm-logo.png");

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DashboardData = RouterOutputs["hackRoom"]["dashboard"];
type HackTask = DashboardData["tasks"][number];
type HackRoom = DashboardData["hostedRooms"][number];
type HackSubmission = DashboardData["hostSubmissions"][number];
type Role = "participant" | "host";
type TaskKind = "task" | "challenge" | "game";
type RoomTab = "participants" | "assign" | "history" | "challenges" | "winners";
type ParticipantTab = "assignments" | "proof" | "winners";
type SubmissionStatus = DashboardData["mySubmissions"][number]["status"];
type AuthMode = "sign-in" | "sign-up";
type ProofType = "github" | "drive" | "file" | "url" | "video" | "deck";
type Tone = "cyan" | "violet" | "gold" | "orange" | "red";
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
];

const signInSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signUpSchema = signInSchema.extend({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
});

const emptyRoomForm = {
  description: "",
  name: "",
};

const emptyTaskForm = {
  description: "",
  dueAt: "",
  rewardXrdm: "20",
  title: "",
};

const emptySubmitForm = {
  notes: "",
  proofUrl: "",
};

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
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = authMode === "sign-up";

  const resetError = () => {
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async () => {
    const parsed = isSignUp
      ? signUpSchema.safeParse({ email, name, password })
      : signInSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form and try again");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isSignUp) {
        await authClient.signUp.email(
          {
            email: email.trim(),
            name: name.trim(),
            password,
          },
          {
            onError(result) {
              setError(result.error?.message || "Failed to create account");
            },
            onSuccess() {
              setName("");
              setEmail("");
              setPassword("");
              queryClient.refetchQueries();
            },
          },
        );
      } else {
        await authClient.signIn.email(
          {
            email: email.trim(),
            password,
          },
          {
            onError(result) {
              setError(result.error?.message || "Failed to sign in");
            },
            onSuccess() {
              setEmail("");
              setPassword("");
              queryClient.refetchQueries();
            },
          },
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Image accessibilityIgnoresInvertColors source={rdmLogo} style={styles.authLogo} />

        <View style={styles.authCard}>
          <SegmentedToggle
            leftLabel="Sign In"
            leftSelected={authMode === "sign-in"}
            onLeftPress={() => {
              setAuthMode("sign-in");
              setError(null);
            }}
            onRightPress={() => {
              setAuthMode("sign-up");
              setError(null);
            }}
            rightLabel="Create"
          />

          <Text style={styles.formTitle}>{isSignUp ? "Create Account" : "Sign In"}</Text>

          {error ? <ErrorBanner message={error} /> : null}

          {isSignUp ? (
            <Field label="Name">
              <HackTextInput
                autoCapitalize="words"
                onChangeText={(value) => {
                  setName(value);
                  resetError();
                }}
                placeholder="Yash Diwan"
                value={name}
              />
            </Field>
          ) : null}

          <Field label="Email">
            <HackTextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(value) => {
                setEmail(value);
                resetError();
              }}
              placeholder="you@example.com"
              value={email}
            />
          </Field>

          <Field label="Password">
            <HackTextInput
              onChangeText={(value) => {
                setPassword(value);
                resetError();
              }}
              onSubmitEditing={handleSubmit}
              placeholder="8+ characters"
              secureTextEntry
              value={password}
            />
          </Field>

          <HackButton
            disabled={isSubmitting}
            icon={isSignUp ? "person-add-outline" : "log-in-outline"}
            label={isSignUp ? "Create Account" : "Sign In"}
            loading={isSubmitting}
            onPress={handleSubmit}
            tone="cyan"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function HomeDashboard({ user }: { user: SessionUser }) {
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

  const handleSignOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries();
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        onNotificationPress={() => setMessage({ text: "No new notifications right now", tone: "cyan" })}
        onProfilePress={handleSignOut}
      />
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardHero}>
          <Text style={styles.dashboardHeadline}>Home</Text>
          <Text style={styles.dashboardCopy}>
            Welcome back, {firstName(user.name)}. Your room activity, pending reviews, and XRDM
            progress live here.
          </Text>

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
              value={dashboard.data?.stats.activeRooms ?? 0}
            />
            <MetricCard
              icon="enter-outline"
              label="Joined"
              tone="cyan"
              value={dashboard.data?.stats.joinedRooms ?? 0}
            />
            <MetricCard
              icon="hourglass-outline"
              label="Reviews"
              tone="gold"
              value={dashboard.data?.stats.pendingSubmissions ?? 0}
            />
          </View>
        </View>

        {dashboard.error ? <ErrorBanner message={dashboard.error.message} /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

        <Panel eyebrow="Overview" icon="grid-outline" title="Hack Room Snapshot" tone="cyan">
          <View style={styles.listStack}>
            {dashboard.data?.joinedRooms.length || dashboard.data?.hostedRooms.length ? (
              <>
                {dashboard.data.hostedRooms.slice(0, 2).map((room) => (
                  <RoomCard key={room._id} role="host" room={room} />
                ))}
                {dashboard.data.joinedRooms.slice(0, 2).map((room) => (
                  <RoomCard key={room._id} role="participant" room={room} />
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
            {dashboard.data?.mySubmissions.length ? (
              dashboard.data.mySubmissions
                .slice(0, 2)
                .map((submission) => (
                  <SubmissionCard key={submission._id} submission={submission} />
                ))
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
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

  const handleSignOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries();
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        onNotificationPress={() => setMessage({ text: "No new notifications right now", tone: "cyan" })}
        onProfilePress={handleSignOut}
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
              value={(dashboard.data?.stats.activeRooms ?? 0) + (dashboard.data?.stats.joinedRooms ?? 0)}
            />
            <MetricCard
              icon="trophy-outline"
              label="Wins"
              tone="gold"
              value={dashboard.data?.stats.winners ?? 0}
            />
            <MetricCard
              icon="people-outline"
              label="Network"
              tone="violet"
              value={dashboard.data?.stats.participants ?? 0}
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
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [activeRoomTab, setActiveRoomTab] = useState<RoomTab>("participants");
  const [activeParticipantTab, setActiveParticipantTab] =
    useState<ParticipantTab>("assignments");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskKind, setTaskKind] = useState<TaskKind>("challenge");
  const [proofTypes, setProofTypes] = useState<Array<ProofType>>(["github", "video"]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [submitForm, setSubmitForm] = useState(emptySubmitForm);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  const [feedbackBySubmission, setFeedbackBySubmission] = useState<Record<string, string>>({});
  const [awardBySubmission, setAwardBySubmission] = useState<Record<string, string>>({});

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const tasks = dashboard.data?.tasks ?? [];
  const mySubmissions = dashboard.data?.mySubmissions ?? [];
  const hostSubmissions = dashboard.data?.hostSubmissions ?? [];
  const visibleWinners = dashboard.data?.visibleWinners ?? [];
  const allRooms = useMemo(() => {
    const seen = new Set<string>();
    const rooms: Array<{ role: Role; room: HackRoom }> = [];

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
  }, [hostedRooms, joinedRooms]);
  const selectedRoomEntry = allRooms.find((entry) => entry.room._id === selectedRoomId);
  const selectedRoom = selectedRoomEntry?.room;
  const selectedRoomRole = selectedRoomEntry?.role ?? "participant";
  const roomTasks = useMemo(
    () => tasks.filter((task) => task.roomId === selectedRoomId),
    [selectedRoomId, tasks],
  );
  const roomSubmissions = useMemo(
    () => hostSubmissions.filter((submission) => submission.roomId === selectedRoomId),
    [hostSubmissions, selectedRoomId],
  );
  const roomMySubmissions = useMemo(
    () => mySubmissions.filter((submission) => submission.roomId === selectedRoomId),
    [mySubmissions, selectedRoomId],
  );
  const roomWinners = useMemo(
    () => visibleWinners.filter((submission) => submission.roomId === selectedRoomId),
    [selectedRoomId, visibleWinners],
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
    if (!allRooms.length) {
      if (selectedRoomId) {
        setSelectedRoomId("");
      }
      return;
    }

    if (!selectedRoomId || !allRooms.some((entry) => entry.room._id === selectedRoomId)) {
      setSelectedRoomId(allRooms[0]?.room._id ?? "");
    }
  }, [allRooms, selectedRoomId]);

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

  const createRoom = useMutation(
    trpc.hackRoom.createRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setCreateRoomModalOpen(false);
        setSelectedRoomId(room._id);
        setActiveRoomTab("participants");
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
        setSelectedRoomId(room._id);
        setActiveParticipantTab("assignments");
        setMessage({ text: `Joined ${room.name}`, tone: "cyan" });
        await invalidateDashboard();
      },
    }),
  );

  const createTask = useMutation(
    trpc.hackRoom.createTask.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setTaskForm(emptyTaskForm);
        setProofTypes(["github", "video"]);
        setMessage({ text: "Room assignment published for all participants", tone: "violet" });
        await invalidateDashboard();
      },
    }),
  );

  const submitProof = useMutation(
    trpc.hackRoom.submitProof.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setSubmitForm(emptySubmitForm);
        setMessage({ text: "Proof submitted for host review", tone: "cyan" });
        await invalidateDashboard();
      },
    }),
  );

  const approveSubmission = useMutation(
    trpc.hackRoom.approveSubmission.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setMessage({ text: "Proof approved and added to room history", tone: "cyan" });
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

  const isBusy =
    createRoom.isPending ||
    joinRoom.isPending ||
    createTask.isPending ||
    submitProof.isPending ||
    approveSubmission.isPending ||
    selectWinner.isPending ||
    returnSubmission.isPending;

  const handleSignOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries();
  };

  const handleNotifications = () => {
    setMessage({ text: "No new notifications right now", tone: "cyan" });
  };

  const toggleProofType = (proofType: ProofType) => {
    setProofTypes((current) => {
      if (current.includes(proofType)) {
        return current.length === 1 ? current : current.filter((item) => item !== proofType);
      }
      return [...current, proofType];
    });
  };

  const handleShareCode = async (room: HackRoom) => {
    await Share.share({
      message: `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`,
      title: `${room.name} invite`,
    });
  };

  const handleCreateTask = (kind: TaskKind) => {
    if (!selectedRoom) {
      setMessage({ text: "Select or create a room before publishing", tone: "red" });
      return;
    }
    if (selectedRoomRole !== "host") {
      setMessage({ text: "Only the host can publish inside this room", tone: "red" });
      return;
    }

    createTask.mutate({
      description: taskForm.description,
      dueAt: taskForm.dueAt,
      kind,
      proofTypes,
      rewardXrdm: Number(taskForm.rewardXrdm),
      roomId: selectedRoom._id,
      title: taskForm.title,
    });
  };

  const handleSubmitProof = () => {
    if (!selectedTask) {
      setMessage({ text: "Choose an assignment before submitting proof", tone: "red" });
      return;
    }

    submitProof.mutate({
      notes: submitForm.notes,
      proofUrl: submitForm.proofUrl,
      roomId: selectedTask.roomId,
      taskId: selectedTask._id,
    });
  };

  const handleApproveSubmission = (submission: HackSubmission) => {
    const feedback =
      feedbackBySubmission[submission._id] ||
      submission.hostFeedback ||
      "Approved. Clear proof and solid contribution.";
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

  return (
    <View style={styles.screen}>
      <AppHeader onNotificationPress={handleNotifications} onProfilePress={handleSignOut} />
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
          allRooms={allRooms}
          createRoomPending={createRoom.isPending}
          createRoomModalOpen={createRoomModalOpen}
          inviteCode={inviteCode}
          joinRoomPending={joinRoom.isPending}
          onCreateRoom={() => createRoom.mutate(roomForm)}
          onInviteCodeChange={setInviteCode}
          onJoinRoom={() => joinRoom.mutate({ inviteCode })}
          onRoomFormChange={setRoomForm}
          onSelectRoom={setSelectedRoomId}
          onSetCreateRoomModalOpen={setCreateRoomModalOpen}
          onShareRoom={handleShareCode}
          roomForm={roomForm}
          selectedRoomId={selectedRoomId}
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

        {selectedRoom ? (
          <RoomWorkspace
            activeParticipantTab={activeParticipantTab}
            activeRoomTab={activeRoomTab}
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
            onSelectTask={setSelectedTaskId}
            onSelectWinner={handleSelectWinner}
            onShareRoom={handleShareCode}
            onSubmitProof={handleSubmitProof}
            pendingSubmissions={pendingHostSubmissions}
            proofTypes={proofTypes}
            returnSubmissionPending={returnSubmission.isPending}
            room={selectedRoom}
            roomRole={selectedRoomRole}
            roomTasks={roomTasks}
            roomWinners={roomWinners}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            selectWinnerPending={selectWinner.isPending}
            setAwardBySubmission={setAwardBySubmission}
            setFeedbackBySubmission={setFeedbackBySubmission}
            setProofTypes={toggleProofType}
            setSubmitForm={setSubmitForm}
            setTaskForm={setTaskForm}
            setTaskKind={setTaskKind}
            submitForm={submitForm}
            submitProofPending={submitProof.isPending}
            taskForm={taskForm}
            taskKind={taskKind}
            winnerSubmissions={winnerSubmissions}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function RoomCommandCenter({
  allRooms,
  createRoomPending,
  createRoomModalOpen,
  inviteCode,
  joinRoomPending,
  onCreateRoom,
  onInviteCodeChange,
  onJoinRoom,
  onRoomFormChange,
  onSelectRoom,
  onSetCreateRoomModalOpen,
  onShareRoom,
  roomForm,
  selectedRoomId,
}: {
  allRooms: Array<{ role: Role; room: HackRoom }>;
  createRoomPending: boolean;
  createRoomModalOpen: boolean;
  inviteCode: string;
  joinRoomPending: boolean;
  onCreateRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  onSelectRoom: (roomId: string) => void;
  onSetCreateRoomModalOpen: (open: boolean) => void;
  onShareRoom: (room: HackRoom) => void;
  roomForm: typeof emptyRoomForm;
  selectedRoomId: string;
}) {
  return (
    <>
      <Panel
        action={
          <Pressable
            accessibilityLabel="Create hack room"
            accessibilityRole="button"
            onPress={() => onSetCreateRoomModalOpen(true)}
            style={({ pressed }) => [styles.createRoomTrigger, pressed && styles.pressed]}
          >
            <Ionicons name="add-outline" size={18} color="#060214" />
            <Text style={styles.createRoomTriggerText}>Create</Text>
          </Pressable>
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

        <View style={styles.roomShelfHeader}>
          <Text style={styles.sectionEyebrow}>Your rooms</Text>
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
                onPress={() => onSelectRoom(room._id)}
                onShare={() => onShareRoom(room)}
                role={role}
                room={room}
                selected={selectedRoomId === room._id}
              />
            ))}
          </ScrollView>
        ) : (
          <EmptyState icon="flash-outline" text="No rooms yet. Join with a code or create one." />
        )}
      </Panel>

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
                  placeholder="Participants build and submit working demos by deadline."
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
    </>
  );
}

function SelectableRoomCard({
  onPress,
  onShare,
  role,
  room,
  selected,
}: {
  onPress: () => void;
  onShare: () => void;
  role: Role;
  room: HackRoom;
  selected: boolean;
}) {
  const tone = role === "host" ? "violet" : "cyan";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectableRoomCard,
        selected && styles.selectableRoomCardActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTopRow}>
        <StatusPill label={role} tone={tone} />
        <Pressable
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [styles.roomShareIcon, pressed && styles.pressed]}
        >
          <Ionicons name="share-outline" size={15} color={theme.muted} />
        </Pressable>
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
      <Text style={styles.cardMeta}>{room.participants.length} participants</Text>
    </Pressable>
  );
}

function RoomWorkspace({
  activeParticipantTab,
  activeRoomTab,
  approvedSubmissions,
  approveSubmissionPending,
  awardBySubmission,
  createTaskPending,
  feedbackBySubmission,
  historySubmissions,
  mySubmissions,
  onApproveSubmission,
  onCreateTask,
  onParticipantTabChange,
  onReturnSubmission,
  onRoomTabChange,
  onSelectTask,
  onSelectWinner,
  onShareRoom,
  onSubmitProof,
  pendingSubmissions,
  proofTypes,
  returnSubmissionPending,
  room,
  roomRole,
  roomTasks,
  roomWinners,
  selectedTask,
  selectedTaskId,
  selectWinnerPending,
  setAwardBySubmission,
  setFeedbackBySubmission,
  setProofTypes,
  setSubmitForm,
  setTaskForm,
  setTaskKind,
  submitForm,
  submitProofPending,
  taskForm,
  taskKind,
  winnerSubmissions,
}: {
  activeParticipantTab: ParticipantTab;
  activeRoomTab: RoomTab;
  approvedSubmissions: DashboardData["hostSubmissions"];
  approveSubmissionPending: boolean;
  awardBySubmission: Record<string, string>;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  historySubmissions: DashboardData["hostSubmissions"];
  mySubmissions: DashboardData["mySubmissions"];
  onApproveSubmission: (submission: HackSubmission) => void;
  onCreateTask: (kind: TaskKind) => void;
  onParticipantTabChange: (tab: ParticipantTab) => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRoomTabChange: (tab: RoomTab) => void;
  onSelectTask: (taskId: string) => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareRoom: (room: HackRoom) => void;
  onSubmitProof: () => void;
  pendingSubmissions: DashboardData["hostSubmissions"];
  proofTypes: Array<ProofType>;
  returnSubmissionPending: boolean;
  room: HackRoom;
  roomRole: Role;
  roomTasks: DashboardData["tasks"];
  roomWinners: DashboardData["visibleWinners"];
  selectedTask?: HackTask;
  selectedTaskId: string;
  selectWinnerPending: boolean;
  setAwardBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFeedbackBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setProofTypes: (proofType: ProofType) => void;
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
  return (
    <View style={styles.roomWorkspace}>
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
        <MiniStat icon="people-outline" label="Participants" value={room.participants.length} />
        <MiniStat icon="clipboard-outline" label="Tasks" value={roomTasks.length} />
        <MiniStat icon="trophy-outline" label="Winners" value={roomWinners.length} />
      </View>

      {roomRole === "host" ? (
        <HostRoomWorkspace
          activeRoomTab={activeRoomTab}
          approvedSubmissions={approvedSubmissions}
          approveSubmissionPending={approveSubmissionPending}
          awardBySubmission={awardBySubmission}
          createTaskPending={createTaskPending}
          feedbackBySubmission={feedbackBySubmission}
          historySubmissions={historySubmissions}
          onApproveSubmission={onApproveSubmission}
          onCreateTask={onCreateTask}
          onReturnSubmission={onReturnSubmission}
          onRoomTabChange={onRoomTabChange}
          onSelectWinner={onSelectWinner}
          onShareRoom={onShareRoom}
          pendingSubmissions={pendingSubmissions}
          proofTypes={proofTypes}
          returnSubmissionPending={returnSubmissionPending}
          room={room}
          roomTasks={roomTasks}
          selectWinnerPending={selectWinnerPending}
          setAwardBySubmission={setAwardBySubmission}
          setFeedbackBySubmission={setFeedbackBySubmission}
          setProofTypes={setProofTypes}
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
  approvedSubmissions,
  approveSubmissionPending,
  awardBySubmission,
  createTaskPending,
  feedbackBySubmission,
  historySubmissions,
  onApproveSubmission,
  onCreateTask,
  onReturnSubmission,
  onRoomTabChange,
  onSelectWinner,
  onShareRoom,
  pendingSubmissions,
  proofTypes,
  returnSubmissionPending,
  room,
  roomTasks,
  selectWinnerPending,
  setAwardBySubmission,
  setFeedbackBySubmission,
  setProofTypes,
  setTaskForm,
  setTaskKind,
  taskForm,
  taskKind,
  winnerSubmissions,
}: {
  activeRoomTab: RoomTab;
  approvedSubmissions: DashboardData["hostSubmissions"];
  approveSubmissionPending: boolean;
  awardBySubmission: Record<string, string>;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  historySubmissions: DashboardData["hostSubmissions"];
  onApproveSubmission: (submission: HackSubmission) => void;
  onCreateTask: (kind: TaskKind) => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRoomTabChange: (tab: RoomTab) => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareRoom: (room: HackRoom) => void;
  pendingSubmissions: DashboardData["hostSubmissions"];
  proofTypes: Array<ProofType>;
  returnSubmissionPending: boolean;
  room: HackRoom;
  roomTasks: DashboardData["tasks"];
  selectWinnerPending: boolean;
  setAwardBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFeedbackBySubmission: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setProofTypes: (proofType: ProofType) => void;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  setTaskKind: React.Dispatch<React.SetStateAction<TaskKind>>;
  taskForm: typeof emptyTaskForm;
  taskKind: TaskKind;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const challengeTasks = roomTasks.filter((task) => task.kind === "challenge" || task.kind === "game");
  const hostTabs: Array<{
    icon: React.ComponentProps<typeof Ionicons>["name"];
    id: RoomTab;
    label: string;
  }> = [
    { icon: "people-outline", id: "participants", label: "Participants" },
    { icon: "clipboard-outline", id: "assign", label: "Assign Task" },
    { icon: "time-outline", id: "history", label: "History" },
    { icon: "game-controller-outline", id: "challenges", label: "Challenges" },
    { icon: "trophy-outline", id: "winners", label: "Winners" },
  ];

  return (
    <View style={styles.trackStack}>
      <ScrollView
        contentContainerStyle={styles.roomTabs}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {hostTabs.map((tab) => (
          <RoomTabButton
            active={activeRoomTab === tab.id}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onPress={() => onRoomTabChange(tab.id)}
            tone="violet"
          />
        ))}
      </ScrollView>

      {activeRoomTab === "participants" ? (
        <Panel
          action={<CounterLabel label={`${room.participants.length} joined`} />}
          eyebrow="Host Menu"
          icon="people-outline"
          title="Participants"
          tone="violet"
        >
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
          <View style={styles.listStack}>
            {room.participants.length ? (
              room.participants.map((participant) => (
                <ParticipantListItem key={participant.userId} participant={participant} />
              ))
            ) : (
              <EmptyState
                icon="people-outline"
                text="Share the invite code. Joined participants will appear here."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "assign" ? (
        <AssignmentComposer
          createTaskPending={createTaskPending}
          fixedKind="task"
          onCreateTask={onCreateTask}
          proofTypes={proofTypes}
          setProofTypes={setProofTypes}
          setTaskForm={setTaskForm}
          taskForm={taskForm}
          title="Assign Task"
        />
      ) : null}

      {activeRoomTab === "history" ? (
        <Panel
          action={<CounterLabel label={`${historySubmissions.length} approved`} />}
          eyebrow="Approved Proof"
          icon="time-outline"
          title="History"
          tone="gold"
        >
          <View style={styles.listStack}>
            {historySubmissions.length ? (
              historySubmissions.map((submission) => (
                <SubmissionReviewCard
                  key={submission._id}
                  mode="history"
                  submission={submission}
                />
              ))
            ) : (
              <EmptyState
                icon="time-outline"
                text="Approved proof and winner records will collect here."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "challenges" ? (
        <Panel
          action={<CounterLabel label={`${challengeTasks.length} live`} />}
          eyebrow="Host Menu"
          icon="game-controller-outline"
          title="Challenges and Games"
          tone="violet"
        >
          <View style={styles.kindSwitchRow}>
            <KindButton
              active={taskKind === "challenge"}
              icon="sparkles-outline"
              label="Challenge"
              onPress={() => setTaskKind("challenge")}
            />
            <KindButton
              active={taskKind === "game"}
              icon="game-controller-outline"
              label="Game"
              onPress={() => setTaskKind("game")}
            />
          </View>
          <AssignmentComposer
            createTaskPending={createTaskPending}
            fixedKind={taskKind === "task" ? "challenge" : taskKind}
            onCreateTask={onCreateTask}
            proofTypes={proofTypes}
            setProofTypes={setProofTypes}
            setTaskForm={setTaskForm}
            taskForm={taskForm}
            title={taskKind === "game" ? "Create Game Card" : "Create Challenge Card"}
          />
          <View style={styles.divider} />
          <View style={styles.listStack}>
            {challengeTasks.length ? (
              challengeTasks.map((task) => (
                <TaskCard key={task._id} onPress={() => {}} selected={false} task={task} />
              ))
            ) : (
              <EmptyState
                icon="game-controller-outline"
                text="Create challenge or game cards for participants to complete with proof."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeRoomTab === "winners" ? (
        <Panel
          action={<CounterLabel label={`${approvedSubmissions.length} ready`} />}
          eyebrow="Announcement"
          icon="trophy-outline"
          title="Announce Winners"
          tone="gold"
        >
          <View style={styles.listStack}>
            {approvedSubmissions.length ? (
              approvedSubmissions.map((submission) => (
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
                icon="trophy-outline"
                text="Approve proof from the review queue before announcing winners."
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
                  "Approved. Clear proof and solid contribution."
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
              text="Participant proof waiting for host review will appear here."
            />
          )}
        </View>
      </Panel>
    </View>
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
  selectedTask,
  selectedTaskId,
  setSubmitForm,
  submitForm,
  submitProofPending,
}: {
  activeParticipantTab: ParticipantTab;
  mySubmissions: DashboardData["mySubmissions"];
  onParticipantTabChange: (tab: ParticipantTab) => void;
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  roomTasks: DashboardData["tasks"];
  roomWinners: DashboardData["visibleWinners"];
  selectedTask?: HackTask;
  selectedTaskId: string;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
}) {
  const participantTabs: Array<{
    icon: React.ComponentProps<typeof Ionicons>["name"];
    id: ParticipantTab;
    label: string;
  }> = [
    { icon: "clipboard-outline", id: "assignments", label: "Tasks" },
    { icon: "checkmark-circle-outline", id: "proof", label: "My Proof" },
    { icon: "trophy-outline", id: "winners", label: "Winners" },
  ];

  return (
    <View style={styles.trackStack}>
      <ScrollView
        contentContainerStyle={styles.roomTabs}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {participantTabs.map((tab) => (
          <RoomTabButton
            active={activeParticipantTab === tab.id}
            icon={tab.icon}
            key={tab.id}
            label={tab.label}
            onPress={() => onParticipantTabChange(tab.id)}
            tone="cyan"
          />
        ))}
      </ScrollView>

      {activeParticipantTab === "assignments" ? (
        <Panel
          action={<CounterLabel label={`${roomTasks.length} live`} />}
          eyebrow="Participant"
          icon="clipboard-outline"
          title="Assigned Work"
          tone="cyan"
        >
          <View style={styles.listStack}>
            {roomTasks.length ? (
              roomTasks.map((task) => {
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
                text="The host has not assigned tasks, challenges, or games yet."
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
                  setSubmitForm((current) => ({ ...current, proofUrl: value }))
                }
                placeholder="https://github.com/team/project"
                value={submitForm.proofUrl}
              />
            </Field>

            <Field label="Note to host">
              <HackTextInput
                multiline
                onChangeText={(value) =>
                  setSubmitForm((current) => ({ ...current, notes: value }))
                }
                placeholder="Mention branch, demo timestamp, or implementation notes."
                style={styles.textArea}
                value={submitForm.notes}
              />
            </Field>

            <HackButton
              disabled={!selectedTask || !submitForm.proofUrl.trim() || submitProofPending}
              icon="send-outline"
              label="Submit Proof"
              loading={submitProofPending}
              onPress={onSubmitProof}
              tone="cyan"
            />
          </View>
        </Panel>
      ) : null}

      {activeParticipantTab === "proof" ? (
        <Panel
          action={<CounterLabel label={`${mySubmissions.length} records`} />}
          eyebrow="Participant"
          icon="checkmark-circle-outline"
          title="My Proof Status"
          tone="cyan"
        >
          <View style={styles.listStack}>
            {mySubmissions.length ? (
              mySubmissions.map((submission) => (
                <SubmissionCard key={submission._id} submission={submission} />
              ))
            ) : (
              <EmptyState
                icon="checkmark-circle-outline"
                text="Submitted proof will appear here with returned, approved, or winner status."
              />
            )}
          </View>
        </Panel>
      ) : null}

      {activeParticipantTab === "winners" ? (
        <Panel
          action={<CounterLabel label={`${roomWinners.length} announced`} />}
          eyebrow="Room"
          icon="trophy-outline"
          title="Winner Announcements"
          tone="gold"
        >
          <View style={styles.listStack}>
            {roomWinners.length ? (
              roomWinners.map((submission) => (
                <SubmissionCard key={submission._id} submission={submission} />
              ))
            ) : (
              <EmptyState
                icon="trophy-outline"
                text="Winner announcements from the host will appear here."
              />
            )}
          </View>
        </Panel>
      ) : null}
    </View>
  );
}

function AssignmentComposer({
  createTaskPending,
  fixedKind,
  onCreateTask,
  proofTypes,
  setProofTypes,
  setTaskForm,
  taskForm,
  title,
}: {
  createTaskPending: boolean;
  fixedKind: TaskKind;
  onCreateTask: (kind: TaskKind) => void;
  proofTypes: Array<ProofType>;
  setProofTypes: (proofType: ProofType) => void;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  taskForm: typeof emptyTaskForm;
  title: string;
}) {
  return (
    <View style={styles.assignmentComposer}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionEyebrow}>{kindLabel(fixedKind)}</Text>
          <Text style={styles.sectionTitleSmall}>{title}</Text>
        </View>
        <StatusPill label="All participants" tone="violet" />
      </View>

      <Field label={`${kindLabel(fixedKind)} title`}>
        <HackTextInput
          onChangeText={(value) => setTaskForm((current) => ({ ...current, title: value }))}
          placeholder={
            fixedKind === "game"
              ? "Bug bash arena"
              : fixedKind === "challenge"
                ? "Ship the fastest demo"
                : "Build a working prototype"
          }
          value={taskForm.title}
        />
      </Field>
      <Field label="Due date">
        <HackTextInput
          onChangeText={(value) => setTaskForm((current) => ({ ...current, dueAt: value }))}
          placeholder="Tonight 9:00 PM"
          value={taskForm.dueAt}
        />
      </Field>
      <Field label="Brief and rules">
        <HackTextInput
          multiline
          onChangeText={(value) =>
            setTaskForm((current) => ({ ...current, description: value }))
          }
          placeholder="Write the task, rules, proof requirement, and scoring signal."
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
          !taskForm.title.trim() ||
          !taskForm.description.trim() ||
          !taskForm.dueAt.trim() ||
          createTaskPending
        }
        icon="send-outline"
        label={`Publish ${kindLabel(fixedKind)}`}
        loading={createTaskPending}
        onPress={() => onCreateTask(fixedKind)}
        tone="violet"
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
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar name={submission.participantName} tone="cyan" />
        <View style={styles.reviewTitleBlock}>
          <Text style={styles.cardTitle}>{submission.participantName}</Text>
          <Text style={styles.cardMeta}>
            {submission.roomName} - {submission.taskTitle}
          </Text>
        </View>
        <StatusPill label={submission.status} tone={statusTone(submission.status)} />
      </View>

      <LinkRow url={submission.proofUrl} />
      {submission.notes ? <Text style={styles.notesText}>{submission.notes}</Text> : null}

      {mode !== "history" ? (
        <Field label="Host feedback">
          <HackTextInput
            multiline
            onChangeText={onFeedbackChange}
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
            label="Approve"
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

function RoomTabButton({
  active,
  icon,
  label,
  onPress,
  tone,
}: {
  active: boolean;
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
        styles.roomTabButton,
        active && {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.fg,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? toneColors.fg : theme.muted} />
      <Text style={[styles.roomTabText, active && { color: toneColors.fg }]}>{label}</Text>
    </Pressable>
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
      <Panel eyebrow="Participant Track" icon="key-outline" title="Join a Hack Room" tone="cyan">
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
            joinedRooms.map((room) => <RoomCard key={room._id} role="participant" room={room} />)
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
            placeholder="Participants build and submit working demos by deadline."
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
        title="Set Task for Participants"
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
                    <StatusPill label={submission.status} tone={statusTone(submission.status)} />
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
              text="Submissions from participants will appear here for review."
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
  onNotificationPress,
  onProfilePress,
}: {
  onNotificationPress: () => void;
  onProfilePress: () => void;
}) {
  const navigation = useNavigation();
  const handleOpenMenu = () => {
    (navigation as { dispatch: (action: { type: string }) => void }).dispatch({
      type: "OPEN_DRAWER",
    });
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.homeHeaderSafe}>
      <View style={styles.homeHeader}>
        <Image accessibilityIgnoresInvertColors source={rdmLogo} style={styles.homeHeaderLogo} />
        <View style={styles.homeHeaderActions}>
          <HeaderIconButton
            accessibilityLabel="Notifications"
            icon="notifications-outline"
            onPress={onNotificationPress}
          />
          <HeaderIconButton
            accessibilityLabel="Open menu"
            icon="menu-outline"
            onPress={handleOpenMenu}
          />
          <HeaderIconButton
            accessibilityLabel="Sign out"
            icon="person-circle-outline"
            onPress={onProfilePress}
            tone="profile"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function HeaderIconButton({
  accessibilityLabel,
  icon,
  onPress,
  tone = "default",
}: {
  accessibilityLabel: string;
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

function SegmentedToggle({
  leftLabel,
  leftSelected,
  onLeftPress,
  onRightPress,
  rightLabel,
}: {
  leftLabel: string;
  leftSelected: boolean;
  onLeftPress: () => void;
  onRightPress: () => void;
  rightLabel: string;
}) {
  return (
    <View style={styles.segmented}>
      <Pressable
        accessibilityRole="button"
        onPress={onLeftPress}
        style={[styles.segment, leftSelected && styles.segmentActiveCyan]}
      >
        <Text style={[styles.segmentText, leftSelected && styles.segmentTextActiveCyan]}>
          {leftLabel}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onRightPress}
        style={[styles.segment, !leftSelected && styles.segmentActiveViolet]}
      >
        <Text style={[styles.segmentText, !leftSelected && styles.segmentTextActiveViolet]}>
          {rightLabel}
        </Text>
      </Pressable>
    </View>
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
          {room.participants.length} participants · {room.inviteCode}
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
        <StatusPill label={status ?? `+${task.rewardXrdm} XRDM`} tone={statusTone(status)} />
      </View>
      <Text numberOfLines={3} style={styles.cardDescription}>
        {task.description}
      </Text>
      <View style={styles.proofTypeRow}>
        <Text style={styles.proofTypeLabel}>{kindLabel(task.kind ?? "task")}</Text>
        {task.proofTypes.map((proofType) => (
          <Text key={proofType} style={styles.proofTypeLabel}>
            {proofType}
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
        <StatusPill label={submission.status} tone={statusTone(submission.status)} />
      </View>
      <LinkRow url={submission.proofUrl} />
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
      border: "#904200",
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

function statusTone(status?: SubmissionStatus) {
  if (status === "winner") return "gold";
  if (status === "approved") return "cyan";
  if (status === "returned") return "red";
  if (status === "submitted") return "orange";
  return "gold";
}

function kindLabel(kind: TaskKind) {
  if (kind === "challenge") return "Challenge";
  if (kind === "game") return "Game";
  return "Task";
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

const styles = StyleSheet.create({
  authCard: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    padding: 16,
    width: "100%",
  },
  authLogo: {
    height: 92,
    marginBottom: 12,
    resizeMode: "cover",
    width: 240,
  },
  authScrollContent: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  avatarText: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 12,
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
  button: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0,
  },
  cardDescription: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  cardMeta: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0,
  },
  cardTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  compactBusyRow: {
    alignItems: "center",
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  counterLabel: {
    color: theme.muted,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  dashboardContent: {
    gap: 16,
    padding: 16,
    paddingBottom: 32,
  },
  dashboardCopy: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 8,
  },
  dashboardHeadline: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 34,
  },
  dashboardHero: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  disabled: {
    opacity: 0.48,
  },
  divider: {
    backgroundColor: theme.borderSoft,
    height: 1,
    marginVertical: 4,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  emptyState: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderStyle: "dashed",
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 12,
  },
  emptyText: {
    color: theme.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
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
    color: theme.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    paddingTop: 10,
  },
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  formTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0,
  },
  assignmentComposer: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  createRoomCard: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  createRoomTrigger: {
    alignItems: "center",
    backgroundColor: theme.host,
    borderRadius: 8,
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
  headerIconButton: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerProfileButton: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
  },
  homeHeader: {
    alignItems: "center",
    backgroundColor: theme.background,
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  homeHeaderActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  homeHeaderLogo: {
    height: 44,
    resizeMode: "cover",
    width: 116,
  },
  homeHeaderSafe: {
    backgroundColor: theme.background,
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
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputMultiline: {
    minHeight: 92,
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
    gap: 6,
    height: 46,
    justifyContent: "center",
    minWidth: 78,
    paddingHorizontal: 12,
  },
  joinTightText: {
    color: "#03120c",
    fontSize: 13,
    fontWeight: "900",
  },
  kindButton: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  kindButtonActive: {
    backgroundColor: theme.hostDark,
    borderColor: theme.host,
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
  listStack: {
    gap: 10,
    marginTop: 12,
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
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 92,
    padding: 12,
  },
  metricLabel: {
    color: theme.muted,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    marginTop: 2,
    textTransform: "uppercase",
  },
  metricValue: {
    color: theme.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 0,
    marginTop: 7,
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
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
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
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 21,
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
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 76,
    padding: 10,
  },
  miniStatLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 9,
    marginTop: 2,
    textTransform: "uppercase",
  },
  miniStatValue: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  mutedText: {
    color: theme.muted,
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
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  panelEyebrow: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
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
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  panelTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "700",
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
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    padding: 12,
  },
  pressed: {
    opacity: 0.74,
  },
  profileCard: {
    alignItems: "center",
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    padding: 12,
  },
  profileEmail: {
    color: theme.dim,
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 14,
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
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  proofChipActive: {
    backgroundColor: theme.hostDark,
    borderColor: theme.host,
  },
  proofChipText: {
    color: theme.muted,
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
  proofTypeLabel: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  proofTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  reviewActions: {
    flexDirection: "row",
    gap: 8,
  },
  reviewCard: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
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
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    width: 32,
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
  roomStatsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  roomTabButton: {
    alignItems: "center",
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  roomTabText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  roomTabs: {
    gap: 8,
    paddingBottom: 2,
  },
  roomWorkspace: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  roomWorkspaceHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  roomWorkspaceTitle: {
    color: theme.text,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 27,
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
  screen: {
    backgroundColor: theme.background,
    flex: 1,
  },
  selectableRoomCard: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 166,
    padding: 12,
    width: 236,
  },
  selectableRoomCardActive: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participant,
  },
  sectionEyebrow: {
    color: theme.participantBorder,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    textTransform: "uppercase",
  },
  sectionHeadingRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionTitleSmall: {
    color: theme.participant,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  segment: {
    alignItems: "center",
    borderRadius: 7,
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
  },
  segmentActiveCyan: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderWidth: 1,
  },
  segmentActiveViolet: {
    backgroundColor: theme.hostDark,
    borderColor: theme.hostBorder,
    borderWidth: 1,
  },
  segmentText: {
    color: theme.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  segmentTextActiveCyan: {
    color: theme.participant,
  },
  segmentTextActiveViolet: {
    color: theme.host,
  },
  segmented: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  selectorChip: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: 180,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    padding: 12,
  },
  statusBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  statusPill: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillText: {
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  submissionCard: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  submitCard: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    marginTop: 14,
    padding: 12,
  },
  taskCard: {
    backgroundColor: theme.panelStrong,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  taskCardSelected: {
    backgroundColor: theme.participantDark,
    borderColor: theme.participant,
  },
  taskTitleBlock: {
    flex: 1,
  },
  textArea: {
    minHeight: 96,
  },
  textAreaLarge: {
    minHeight: 118,
  },
  trackStack: {
    gap: 16,
  },
});
