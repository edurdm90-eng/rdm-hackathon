import type { AppRouter } from "@rdm-hack/api/routers/index";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { HACK_THEME as theme } from "@/lib/constants";
import { queryClient, trpc } from "@/utils/trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type DashboardData = RouterOutputs["hackRoom"]["dashboard"];
type HackTask = DashboardData["tasks"][number];
type HackRoom = DashboardData["hostedRooms"][number];
type HackSubmission = DashboardData["hostSubmissions"][number];
type Role = "participant" | "host";
type AuthMode = "sign-in" | "sign-up";
type ProofType = "github" | "drive" | "file" | "url" | "video" | "deck";
type Tone = "cyan" | "violet" | "gold" | "orange" | "red";

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

export function HackRoomHome() {
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

  return <HackRoomDashboard user={session.user} />;
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
        <View style={styles.authHero}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <MaterialCommunityIcons name="hexagon-multiple" size={22} color={theme.participant} />
            </View>
            <View>
              <Text style={styles.eyebrow}>XRDM Corporate</Text>
              <Text style={styles.brandName}>Hack Room</Text>
            </View>
          </View>

          <Text style={styles.authHeadline}>Build, submit, verify, and win.</Text>
          <Text style={styles.authCopy}>
            Join invite-only rooms, publish tasks, submit proof, and lock in XRDM awards from a
            focused mobile command center.
          </Text>

          <View style={styles.authStatsRow}>
            <MiniStat label="Rooms" value="Live" />
            <MiniStat label="Proof" value="Verified" />
            <MiniStat label="Rewards" value="XRDM" />
          </View>
        </View>

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

          <Text style={styles.formTitle}>
            {isSignUp ? "Create your hacker profile" : "Welcome back, builder"}
          </Text>
          <Text style={styles.formSubtitle}>
            {isSignUp
              ? "Start hosting rooms or join one with an invite code."
              : "Sign in to continue your hackathon flow."}
          </Text>

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

function HackRoomDashboard({
  user,
}: {
  user: {
    email: string;
    id: string;
    name: string;
  };
}) {
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [role, setRole] = useState<Role>("participant");
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [taskRoomId, setTaskRoomId] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
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
  const firstHostedRoomId = hostedRooms[0]?._id ?? "";
  const joinedRoomIds = useMemo(() => new Set(joinedRooms.map((room) => room._id)), [joinedRooms]);
  const participantTasks = useMemo(
    () => tasks.filter((task) => joinedRoomIds.has(task.roomId)),
    [joinedRoomIds, tasks],
  );
  const selectedTask = participantTasks.find((task) => task._id === selectedTaskId);
  const pendingHostSubmissions = hostSubmissions.filter(
    (submission) => submission.status === "submitted",
  );
  const winnerSubmissions = hostSubmissions.filter((submission) => submission.status === "winner");

  useEffect(() => {
    if (!taskRoomId && firstHostedRoomId) {
      setTaskRoomId(firstHostedRoomId);
    }
  }, [firstHostedRoomId, taskRoomId]);

  useEffect(() => {
    if (!selectedTaskId && participantTasks[0]?._id) {
      setSelectedTaskId(participantTasks[0]._id);
    }
  }, [participantTasks, selectedTaskId]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
  };

  const createRoom = useMutation(
    trpc.hackRoom.createRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setTaskRoomId(room._id);
        setRole("host");
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
        setRole("participant");
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
        setMessage({ text: "Task published to the hack room", tone: "violet" });
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

  const selectWinner = useMutation(
    trpc.hackRoom.selectWinner.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setMessage({ text: "Winner selected and XRDM award recorded", tone: "gold" });
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
    selectWinner.isPending ||
    returnSubmission.isPending;

  const handleSignOut = async () => {
    await authClient.signOut();
    await queryClient.invalidateQueries();
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

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dashboardHero}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <MaterialCommunityIcons
                  name="hexagon-multiple"
                  size={22}
                  color={theme.participant}
                />
              </View>
              <View>
                <Text style={styles.eyebrow}>XRDM Hack Room</Text>
                <Text style={styles.brandName}>Mission Control</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={handleSignOut}
              style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}
            >
              <Ionicons name="log-out-outline" size={17} color={theme.danger} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>

          <Text style={styles.dashboardHeadline}>Good to see you, {firstName(user.name)}.</Text>
          <Text style={styles.dashboardCopy}>
            Host rooms with invite codes, review verifiable proof, or join a sprint and ship your
            submission.
          </Text>

          <View style={styles.profileCard}>
            <Avatar name={user.name} tone="cyan" />
            <View style={styles.profileText}>
              <Text style={styles.profileName}>{user.name}</Text>
              <Text style={styles.profileEmail}>{user.email}</Text>
            </View>
            {isBusy ? <ActivityIndicator color={theme.award} /> : null}
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

        <View style={styles.roleSwitchGrid}>
          <RoleButton
            active={role === "participant"}
            description="Join rooms and submit proof"
            icon="enter-outline"
            label="Participant"
            onPress={() => setRole("participant")}
            tone="cyan"
          />
          <RoleButton
            active={role === "host"}
            description="Create tasks and choose winners"
            icon="shield-checkmark-outline"
            label="Host"
            onPress={() => setRole("host")}
            tone="violet"
          />
        </View>

        {role === "participant" ? (
          <ParticipantTrack
            inviteCode={inviteCode}
            joinedRooms={joinedRooms}
            joinRoomPending={joinRoom.isPending}
            mySubmissions={mySubmissions}
            onInviteCodeChange={setInviteCode}
            onJoinRoom={() => joinRoom.mutate({ inviteCode })}
            onSelectTask={setSelectedTaskId}
            onSubmitProof={() => {
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
            }}
            participantTasks={participantTasks}
            selectedTask={selectedTask}
            selectedTaskId={selectedTaskId}
            submitForm={submitForm}
            submitProofPending={submitProof.isPending}
            updateSubmitForm={setSubmitForm}
          />
        ) : (
          <HostTrack
            awardBySubmission={awardBySubmission}
            createRoomPending={createRoom.isPending}
            createTaskPending={createTask.isPending}
            feedbackBySubmission={feedbackBySubmission}
            hostedRooms={hostedRooms}
            hostSubmissions={hostSubmissions}
            onCreateRoom={() => createRoom.mutate(roomForm)}
            onCreateTask={() => {
              if (!taskRoomId) {
                setMessage({ text: "Create a room before publishing a task", tone: "red" });
                return;
              }
              createTask.mutate({
                description: taskForm.description,
                dueAt: taskForm.dueAt,
                proofTypes,
                rewardXrdm: Number(taskForm.rewardXrdm),
                roomId: taskRoomId,
                title: taskForm.title,
              });
            }}
            onReturnSubmission={(submission) => {
              const feedback =
                feedbackBySubmission[submission._id] ||
                submission.hostFeedback ||
                "Thanks for the submission. Please add clearer proof and resubmit.";
              returnSubmission.mutate({
                hostFeedback: feedback,
                submissionId: submission._id,
              });
            }}
            onSelectWinner={(submission) => {
              const feedback =
                feedbackBySubmission[submission._id] ||
                submission.hostFeedback ||
                "Strong contribution and clear proof of participation.";
              const award = Number(
                awardBySubmission[submission._id] ||
                  submission.awardXrdm ||
                  submission.rewardXrdm ||
                  20,
              );
              selectWinner.mutate({
                awardXrdm: award,
                hostFeedback: feedback,
                submissionId: submission._id,
              });
            }}
            onShareRoom={handleShareCode}
            pendingHostSubmissions={pendingHostSubmissions}
            proofTypes={proofTypes}
            returnSubmissionPending={returnSubmission.isPending}
            roomForm={roomForm}
            selectWinnerPending={selectWinner.isPending}
            setAwardBySubmission={setAwardBySubmission}
            setFeedbackBySubmission={setFeedbackBySubmission}
            setProofTypes={toggleProofType}
            setRoomForm={setRoomForm}
            setTaskForm={setTaskForm}
            setTaskRoomId={setTaskRoomId}
            taskForm={taskForm}
            taskRoomId={taskRoomId}
            winnerSubmissions={winnerSubmissions}
          />
        )}
      </ScrollView>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
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
  status?: "submitted" | "winner" | "returned";
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
        {task.proofTypes.map((proofType) => (
          <Text key={proofType} style={styles.proofTypeLabel}>
            {proofType}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

function SubmissionCard({ submission }: { submission: DashboardData["mySubmissions"][number] }) {
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

function statusTone(status?: "submitted" | "winner" | "returned") {
  if (status === "winner") return "gold";
  if (status === "returned") return "red";
  if (status === "submitted") return "orange";
  return "gold";
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
    padding: 16,
  },
  authCopy: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
  },
  authHeadline: {
    color: theme.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 40,
    marginTop: 32,
  },
  authHero: {
    backgroundColor: theme.panel,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  authScrollContent: {
    gap: 16,
    padding: 18,
    paddingBottom: 28,
  },
  authStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
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
  brandMark: {
    alignItems: "center",
    backgroundColor: theme.participantDark,
    borderColor: theme.participantBorder,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  brandName: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
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
    marginTop: 20,
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
  formSubtitle: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  formTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0,
  },
  heroTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
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
  miniStat: {
    backgroundColor: theme.backgroundAlt,
    borderColor: theme.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  miniStatLabel: {
    color: theme.dim,
    fontFamily: Platform.select({ default: "monospace" }),
    fontSize: 10,
    marginTop: 3,
    textTransform: "uppercase",
  },
  miniStatValue: {
    color: theme.award,
    fontSize: 13,
    fontWeight: "800",
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
  profileName: {
    color: theme.text,
    fontSize: 14,
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
  signOutButton: {
    alignItems: "center",
    backgroundColor: theme.dangerDark,
    borderColor: theme.dangerBorder,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  signOutText: {
    color: theme.danger,
    fontSize: 11,
    fontWeight: "800",
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
