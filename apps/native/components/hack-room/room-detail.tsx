import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";

import {
  useSponsoredHackathonTransactions,
  userFacingActionError,
} from "@/components/hack-room/blockchain-hooks";
import { copyInviteCodeToClipboard } from "@/components/hack-room/clipboard";
import { HostRoomWorkspace } from "@/components/hack-room/host-panels";
import { ParticipantRoomWorkspace } from "@/components/hack-room/participant-panels";
import { RoomCommandCenter, RoomShelf } from "@/components/hack-room/room-list";
import {
  AppHeader,
  Avatar,
  CounterLabel,
  DateTimeField,
  EmptyState,
  ErrorBanner,
  Field,
  FullScreenLoader,
  HackButton,
  HackTextInput,
  InviteActionButton,
  KindButton,
  LedgerRow,
  MiniStat,
  Panel,
  ParticipantListItem,
  ProfileRow,
  ProofItemsList,
  ProofRequirementFields,
  QuickActionTile,
  StatusBanner,
  StatusPill,
  SubmissionCard,
  SubmissionMetaBlock,
  TaskCard,
  TrackLabel,
  WalletChip,
} from "@/components/hack-room/components";
import { MiniGamePlaySurface } from "@/components/hack-room/mini-games";
import {
  makeAwardNftCall,
  makeAwardXrdmCall,
  makeCreateHackathonCall,
  makeNoteWinnersCall,
  makeRegisterParticipantsCall,
  type ContractCall,
} from "@/lib/blockchain";
import { HACK_THEME as theme } from "@/lib/constants";
import { forgetPendingChainEvent } from "@/lib/pending-chain-events";
import { queryClient, trpc } from "@/utils/trpc";
import {
  buildProofItemsForTask,
  canShowProofSubmitCard,
  defaultRegularProofTypes,
  defaultRewardTitle,
  defaultSpecialProofTypes,
  defaultSpotProofTypes,
  emptyRoomForm,
  emptySubmitForm,
  emptyTaskForm,
  formatDate,
  formatShortDateTime,
  gameTypeOptions,
  getEmailTokens,
  getGameTypeInfo,
  getInvalidEmails,
  getMinimumTaskDueDate,
  getSubmissionProofItems,
  getTaskDueDateError,
  getTaskGameType,
  getTaskProofTypes,
  getToneColors,
  hasRequiredProofItems,
  isEmailLike,
  isHttpsProofUrl,
  isLinkProofType,
  kindLabel,
  makeEmptyRewardForm,
  makeEmptyRewardForms,
  makeEmptySubmitForm,
  normalizeEmails,
  normalizeTaskProofTypes,
  notificationBannerMessage,
  proofTypeLabel,
  proofTypeOptions,
  rewardKindIcon,
  rewardKindLabel,
  rewardKindTone,
  statusTone,
  submissionHoldIcon,
  submissionStatusLabel,
  taskKindTone,
  type AssignmentMode,
  type DashboardData,
  type HackReward,
  type HackRoom,
  type HackSubmission,
  type HackTask,
  type ParticipantTab,
  type PendingRoomCreate,
  type ProofType,
  type RegistrationPlan,
  type RewardForm,
  type RewardFormsByKind,
  type RewardFormSetter,
  type RewardKind,
  type Role,
  type RoomTab,
  type SessionUser,
  type SubmissionProofItem,
  type SubmissionStatus,
  type TaskKind,
  type Tone,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import type {
  HostWorkspaceModel,
  ParticipantWorkspaceModel,
} from "@/components/hack-room/workspace-models";

export function HackRoomDashboard({ user: _user }: { user: SessionUser }) {
  const router = useRouter();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const { sendContractCalls } = useSponsoredHackathonTransactions();
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [createRoomModalOpen, setCreateRoomModalOpen] = useState(false);
  const [isCreatingRoomOnchain, setIsCreatingRoomOnchain] = useState(false);
  const [pendingRoomCreate, setPendingRoomCreate] =
    useState<PendingRoomCreate | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(
    null,
  );
  const isInitialDashboardLoading = dashboard.isLoading && !dashboard.data;
  const isBackgroundDashboardSyncing =
    dashboard.isFetching && Boolean(dashboard.data);

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
    await queryClient.invalidateQueries({
      queryKey: trpc.hackRoom.dashboard.queryKey(),
    });
  };

  const createRoom = useMutation(trpc.hackRoom.createRoom.mutationOptions());

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
    isCreatingRoomOnchain ||
    joinRoom.isPending ||
    isBackgroundDashboardSyncing;

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

  const handleCreateRoom = async () => {
    if (!canCreateRoom) {
      return;
    }

    let pendingId = pendingRoomCreate?.pendingId ?? `room:create:${Date.now()}`;
    let txHash = pendingRoomCreate?.txHash;

    try {
      setIsCreatingRoomOnchain(true);

      if (txHash) {
        setMessage({
          text: "Room is being created, please wait.",
          tone: "gold",
        });
      } else {
        setMessage({
          text: "Room is being created, please wait.",
          tone: "gold",
        });
        txHash =
          (await sendContractCalls({
            calls: [makeCreateHackathonCall()],
            pendingId,
            pendingKind: "room_created",
          })) ?? undefined;
      }

      if (!txHash) {
        throw new Error("Room creation did not finish.");
      }

      setPendingRoomCreate({ pendingId, txHash });
      setMessage({
        text: "Room is being created, please wait.",
        tone: "violet",
      });
      const room = await createRoom.mutateAsync({
        ...roomForm,
        txHash,
      });

      await forgetPendingChainEvent(pendingId);
      setPendingRoomCreate(null);
      setRoomForm(emptyRoomForm);
      setCreateRoomModalOpen(false);
      setMessage({
        text: `Created ${room.name} with invite ${room.inviteCode}`,
        tone: "gold",
      });
      await invalidateDashboard();
    } catch (error) {
      const errorMessage = userFacingActionError(
        error,
        "Unable to create the room.",
      );
      const retryMessage = "Tap Create Room again to finish setup.";
      setMessage({
        text: txHash ? `${errorMessage} ${retryMessage}` : errorMessage,
        tone: "red",
      });
      await invalidateDashboard();
    } finally {
      setIsCreatingRoomOnchain(false);
    }
  };

  if (isInitialDashboardLoading) {
    return <FullScreenLoader message="Loading your hack rooms..." />;
  }

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
          createRoomPending={createRoom.isPending || isCreatingRoomOnchain}
          createRoomModalOpen={createRoomModalOpen}
          inviteCode={inviteCode}
          joinRoomPending={joinRoom.isPending}
          canCreateRoom={canCreateRoom}
          onCreateRoom={handleCreateRoom}
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
              <Text style={styles.mutedText}>
                Fetching rooms, tasks, and proof records.
              </Text>
            </View>
          </Panel>
        ) : null}

        {dashboard.error ? (
          <ErrorBanner message={dashboard.error.message} />
        ) : null}
        {message ? (
          <StatusBanner message={message.text} tone={message.tone} />
        ) : null}
      </ScrollView>
    </View>
  );
}

export function HackRoomDetailDashboard({
  initialParticipantTab,
  roomId,
  user,
}: {
  initialParticipantTab: ParticipantTab | null;
  roomId: string;
  user: SessionUser;
}) {
  const router = useRouter();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const { sendContractCalls } = useSponsoredHackathonTransactions();
  const [activeRoomTab, setActiveRoomTab] = useState<RoomTab | null>(null);
  const [activeParticipantTab, setActiveParticipantTab] =
    useState<ParticipantTab | null>(initialParticipantTab);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [taskKind, setTaskKind] = useState<TaskKind>("task");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("task");
  const [proofTypes, setProofTypes] = useState<Array<ProofType>>(
    defaultRegularProofTypes,
  );
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [submitForm, setSubmitForm] = useState(() =>
    makeEmptySubmitForm(user.name),
  );
  const [rewardForms, setRewardForms] = useState(makeEmptyRewardForms);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(
    null,
  );
  const [feedbackBySubmission, setFeedbackBySubmission] = useState<
    Record<string, string>
  >({});
  const [awardBySubmission, setAwardBySubmission] = useState<
    Record<string, string>
  >({});
  const [createdTaskCardId, setCreatedTaskCardId] = useState("");
  const [pendingRewardKind, setPendingRewardKind] = useState<RewardKind | null>(
    null,
  );
  const [pendingApprovalSubmissionId, setPendingApprovalSubmissionId] =
    useState("");
  const [pendingWinnerSubmissionId, setPendingWinnerSubmissionId] =
    useState("");
  const detailScrollRef = useRef<ScrollView | null>(null);
  const approvalInFlightRef = useRef(false);
  const rewardIssueInFlightRef = useRef(false);
  const winnerSelectionInFlightRef = useRef(false);
  const isInitialDashboardLoading = dashboard.isLoading && !dashboard.data;
  const isBackgroundDashboardSyncing =
    dashboard.isFetching && Boolean(dashboard.data);

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
  const effectiveRoomRole =
    activeParticipantTab === "wallet" ? "member" : selectedRoomRole;
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
    () =>
      notifications.filter((notification) => notification.roomId === roomId),
    [notifications, roomId],
  );
  const myRoomRewards = useMemo(
    () =>
      roomRewards.filter((reward) =>
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
  const winnerSubmissions = roomSubmissions.filter(
    (submission) => submission.status === "winner",
  );

  useEffect(() => {
    if (!roomTasks.length) {
      if (selectedTaskId) {
        setSelectedTaskId("");
      }
      return;
    }

    if (
      !selectedTaskId ||
      !roomTasks.some((task) => task._id === selectedTaskId)
    ) {
      setSelectedTaskId(roomTasks[0]?._id ?? "");
    }
  }, [roomTasks, selectedTaskId]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.hackRoom.dashboard.queryKey(),
    });
  };

  const createTask = useMutation(
    trpc.hackRoom.createTask.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (task) => {
        setTaskForm(emptyTaskForm);
        setAssignmentMode("task");
        setTaskKind("task");
        setProofTypes(defaultRegularProofTypes);
        setSelectedTaskId(task._id);
        setCreatedTaskCardId(task._id);
        setActiveRoomTab("created");
        setMessage({
          text: `${kindLabel(task.kind ?? "task")} card created`,
          tone: "violet",
        });
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
        setMessage({
          text: "Notification nudged to all room members",
          tone: "violet",
        });
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
    trpc.hackRoom.completeSubmissionApproval.mutationOptions({
      onError: (error) =>
        setMessage({
          text: userFacingActionError(error, "Unable to approve proof."),
          tone: "red",
        }),
      onSuccess: async () => {
        setMessage({ text: "Proof verified and XRDM added.", tone: "gold" });
        await invalidateDashboard();
      },
    }),
  );

  const selectWinner = useMutation(
    trpc.hackRoom.completeWinnerSelection.mutationOptions({
      onError: (error) =>
        setMessage({
          text: userFacingActionError(error, "Unable to announce winner."),
          tone: "red",
        }),
      onSuccess: async () => {
        setMessage({ text: "Winner announced.", tone: "gold" });
        await invalidateDashboard();
      },
    }),
  );

  const returnSubmission = useMutation(
    trpc.hackRoom.returnSubmission.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async () => {
        setMessage({
          text: "Submission returned with feedback",
          tone: "orange",
        });
        await invalidateDashboard();
      },
    }),
  );

  const prepareReward = useMutation(
    trpc.hackRoom.prepareReward.mutationOptions({
      onError: (error) =>
        setMessage({
          text: userFacingActionError(error, "Unable to issue reward."),
          tone: "red",
        }),
    }),
  );
  const completeReward = useMutation(
    trpc.hackRoom.completeReward.mutationOptions({
      onError: (error) =>
        setMessage({
          text: userFacingActionError(error, "Unable to issue reward."),
          tone: "red",
        }),
      onSuccess: async () => {
        setMessage({ text: "Reward issued.", tone: "gold" });
        await invalidateDashboard();
      },
    }),
  );
  const completeParticipantRegistration = useMutation(
    trpc.hackRoom.completeParticipantRegistration.mutationOptions({
      onError: (error) =>
        setMessage({
          text: userFacingActionError(error, "Unable to prepare recipients."),
          tone: "red",
        }),
    }),
  );
  const issueRewardPending =
    Boolean(pendingRewardKind) ||
    prepareReward.isPending ||
    completeReward.isPending;
  const approveSubmissionPending =
    Boolean(pendingApprovalSubmissionId) || approveSubmission.isPending;
  const selectWinnerPending =
    Boolean(pendingWinnerSubmissionId) || selectWinner.isPending;

  const isBusy =
    createTask.isPending ||
    submitProof.isPending ||
    approveSubmissionPending ||
    selectWinnerPending ||
    returnSubmission.isPending ||
    issueRewardPending ||
    completeParticipantRegistration.isPending ||
    sendRoomNotification.isPending ||
    isBackgroundDashboardSyncing;

  useEffect(() => {
    if (initialParticipantTab) {
      setActiveRoomTab(null);
      setActiveParticipantTab(initialParticipantTab);
    }
  }, [initialParticipantTab]);

  const handleNotifications = () => {
    setMessage({
      text: notificationBannerMessage(roomNotifications),
      tone: roomNotifications.length ? "violet" : "cyan",
    });
  };

  const handleBackToRooms = () => {
    router.replace("/hack-room");
  };

  const scrollDetailToTop = () => {
    detailScrollRef.current?.scrollTo({ animated: true, y: 0 });
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
      setMessage({
        text: "Only the host can publish inside this room",
        tone: "red",
      });
      return;
    }
    if (!taskForm.dueAt.trim()) {
      setMessage({
        text: "Select a due date and time before publishing",
        tone: "red",
      });
      return;
    }

    const dueDateError = getTaskDueDateError(taskForm.dueAt);
    if (dueDateError) {
      setMessage({ text: dueDateError, tone: "red" });
      return;
    }

    const taskProofTypes = normalizeTaskProofTypes(kind, proofTypes);

    createTask.mutate({
      assignedToEmail:
        kind === "special" ? taskForm.assignedToEmail : undefined,
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
      setMessage({
        text: "Choose an assignment before submitting proof",
        tone: "red",
      });
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
      setMessage({
        text: "Add your name, team name, and submission description",
        tone: "red",
      });
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
      setMessage({
        text: `Add required proof: ${missingProofTypes.join(", ")}`,
        tone: "red",
      });
      return;
    }

    const invalidProofItem = proofItems.find(
      (item) => isLinkProofType(item.type) && !isHttpsProofUrl(item.value),
    );

    if (invalidProofItem) {
      setMessage({
        text: `${proofTypeLabel(invalidProofItem.type)} proof must start with https://`,
        tone: "red",
      });
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

  const registerMissingParticipants = async (input: {
    hackathonId: string | null;
    pendingId: string;
    registration: RegistrationPlan;
    roomId: string;
  }) => {
    if (!input.registration.length) {
      return;
    }

    if (!input.hackathonId) {
      throw new Error(
        "Room setup is still finishing. Please try again shortly.",
      );
    }

    setMessage({ text: "Preparing recipients...", tone: "gold" });
    const txHash = await sendContractCalls({
      calls: [
        makeRegisterParticipantsCall({
          hackathonId: input.hackathonId,
          participantAddresses: input.registration.map(
            (entry) => entry.address,
          ),
        }),
      ],
      pendingId: `${input.pendingId}:register`,
      pendingKind: "participants_registered",
    });

    if (!txHash) {
      return;
    }

    await completeParticipantRegistration.mutateAsync({
      participantIds: input.registration.map((entry) => entry.userId),
      roomId: input.roomId,
      txHash,
    });
    await forgetPendingChainEvent(`${input.pendingId}:register`);
  };

  const handleApproveSubmission = (submission: HackSubmission) => {
    if (approvalInFlightRef.current || approveSubmissionPending) {
      return;
    }

    const feedback =
      feedbackBySubmission[submission._id] ||
      submission.hostFeedback ||
      "Verified. Clear proof and solid contribution.";

    approvalInFlightRef.current = true;
    setPendingApprovalSubmissionId(submission._id);
    void (async () => {
      try {
        setMessage({ text: "Verifying proof...", tone: "gold" });
        const plan = await queryClient.fetchQuery(
          trpc.hackRoom.prepareSubmissionApproval.queryOptions({
            submissionId: submission._id,
          }),
        );
        await registerMissingParticipants({
          hackathonId: plan.hackathonId,
          pendingId: `submission:${submission._id}:approval`,
          registration: plan.registration,
          roomId: plan.roomId,
        });

        let txHash: string | undefined;
        if (plan.amount > 0 && plan.hackathonId && plan.recipientAddress) {
          setMessage({ text: "Adding XRDM...", tone: "gold" });
          txHash =
            (await sendContractCalls({
              calls: [
                makeAwardXrdmCall({
                  amounts: [plan.amount],
                  hackathonId: plan.hackathonId,
                  recipientAddresses: [plan.recipientAddress],
                }),
              ],
              pendingId: `submission:${submission._id}:approval:xrdm`,
              pendingKind: "submission_xrdm_awarded",
            })) ?? undefined;
        }

        await approveSubmission.mutateAsync({
          hostFeedback: feedback,
          submissionId: submission._id,
          txHash,
        });
        await forgetPendingChainEvent(
          `submission:${submission._id}:approval:xrdm`,
        );
      } catch (error) {
        setMessage({
          text: userFacingActionError(error, "Unable to approve proof."),
          tone: "red",
        });
      } finally {
        approvalInFlightRef.current = false;
        setPendingApprovalSubmissionId("");
      }
    })();
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
    if (winnerSelectionInFlightRef.current || selectWinnerPending) {
      return;
    }

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

    if (!Number.isFinite(award) || award < 0) {
      setMessage({ text: "Enter a valid winner XRDM amount", tone: "red" });
      return;
    }

    winnerSelectionInFlightRef.current = true;
    setPendingWinnerSubmissionId(submission._id);
    void (async () => {
      try {
        setMessage({ text: "Announcing winner...", tone: "gold" });
        const plan = await queryClient.fetchQuery(
          trpc.hackRoom.prepareWinnerSelection.queryOptions({
            awardXrdm: award,
            submissionId: submission._id,
          }),
        );
        await registerMissingParticipants({
          hackathonId: plan.hackathonId,
          pendingId: `submission:${submission._id}:winner`,
          registration: plan.registration,
          roomId: plan.roomId,
        });

        if (!plan.hackathonId || !plan.recipientAddress) {
          throw new Error("Winner profile is not ready yet.");
        }

        const calls = [
          makeNoteWinnersCall({
            hackathonId: plan.hackathonId,
            winnerAddresses: [plan.recipientAddress],
          }),
        ];

        if (award > 0) {
          calls.push(
            makeAwardXrdmCall({
              amounts: [award],
              hackathonId: plan.hackathonId,
              recipientAddresses: [plan.recipientAddress],
            }),
          );
        }

        setMessage({ text: "Saving winner...", tone: "gold" });
        const txHash =
          (await sendContractCalls({
            calls,
            pendingId: `submission:${submission._id}:winner:chain`,
            pendingKind: "winner_noted",
          })) ?? undefined;

        if (!txHash) {
          throw new Error("Winner confirmation did not finish.");
        }

        await selectWinner.mutateAsync({
          awardTxHash: award > 0 ? txHash : undefined,
          awardXrdm: award,
          hostFeedback: feedback,
          submissionId: submission._id,
          winnerTxHash: txHash,
        });
        await forgetPendingChainEvent(
          `submission:${submission._id}:winner:chain`,
        );
      } catch (error) {
        setMessage({
          text: userFacingActionError(error, "Unable to announce winner."),
          tone: "red",
        });
      } finally {
        winnerSelectionInFlightRef.current = false;
        setPendingWinnerSubmissionId("");
      }
    })();
  };

  const handleIssueReward = (kind: RewardKind) => {
    if (rewardIssueInFlightRef.current || issueRewardPending) {
      return;
    }
    if (!selectedRoom) {
      setMessage({ text: "Room is still loading", tone: "red" });
      return;
    }
    if (selectedRoomRole !== "host") {
      setMessage({ text: "Only the host can issue room rewards", tone: "red" });
      return;
    }

    const rewardForm = rewardForms[kind];
    const awardXrdm = Number(rewardForm.awardXrdm || 0);
    if (!Number.isFinite(awardXrdm) || awardXrdm < 0) {
      setMessage({ text: "Enter a valid XRDM amount", tone: "red" });
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
      setMessage({
        text: `Check recipient email: ${invalidRecipientEmails[0]}`,
        tone: "red",
      });
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
    const recipientIds = recipientEmails
      .map((email) => participantsByEmail.get(email)?.userId ?? "")
      .filter(Boolean);

    rewardIssueInFlightRef.current = true;
    setPendingRewardKind(kind);
    void (async () => {
      try {
        setMessage({ text: "Issuing reward...", tone: "gold" });
        const prepared = await prepareReward.mutateAsync({
          awardXrdm,
          description: rewardForm.description,
          kind,
          ledgerNote: rewardForm.ledgerNote,
          recipientIds,
          roomId: selectedRoom._id,
          sourceSubmissionId,
          title: rewardForm.title || defaultRewardTitle(kind),
        });
        await registerMissingParticipants({
          hackathonId: prepared.onchain.hackathonId,
          pendingId: `reward:${prepared.reward._id}`,
          registration: prepared.onchain.registration,
          roomId: selectedRoom._id,
        });

        const calls: Array<ContractCall> = [];

        if (prepared.onchain.requiresNft && prepared.onchain.metadataUri) {
          prepared.onchain.recipientAddresses.forEach((recipientAddress) => {
            calls.push(
              makeAwardNftCall({
                hackathonId: prepared.onchain.hackathonId ?? "",
                metadataUri: prepared.onchain.metadataUri ?? "",
                recipientAddress,
              }),
            );
          });
        }

        if (prepared.onchain.requiresXrdm) {
          calls.push(
            makeAwardXrdmCall({
              amounts: prepared.onchain.recipientAddresses.map(
                () => prepared.onchain.awardXrdm,
              ),
              hackathonId: prepared.onchain.hackathonId ?? "",
              recipientAddresses: prepared.onchain.recipientAddresses,
            }),
          );
        }

        let txHash: string | undefined;
        if (calls.length) {
          setMessage({ text: "Saving reward...", tone: "gold" });
          txHash =
            (await sendContractCalls({
              calls,
              pendingId: `reward:${prepared.reward._id}:chain`,
              pendingKind: kind,
            })) ?? undefined;
        }

        await completeReward.mutateAsync({
          nftTxHash: prepared.onchain.requiresNft ? txHash : undefined,
          rewardId: prepared.reward._id,
          xrdmTxHash: prepared.onchain.requiresXrdm ? txHash : undefined,
        });
        await forgetPendingChainEvent(`reward:${prepared.reward._id}:chain`);
        setRewardForms((current) => ({
          ...current,
          [kind]: makeEmptyRewardForm(),
        }));
      } catch (error) {
        setMessage({
          text: userFacingActionError(error, "Unable to issue reward."),
          tone: "red",
        });
      } finally {
        rewardIssueInFlightRef.current = false;
        setPendingRewardKind(null);
      }
    })();
  };

  const roomWorkspaceRewards =
    effectiveRoomRole === "host" ? roomRewards : myRoomRewards;
  const hostWorkspace: HostWorkspaceModel | null = selectedRoom
    ? {
        activeRoomTab,
        assignmentMode,
        approvedSubmissions: approvedHostSubmissions,
        approveSubmissionPending,
        awardBySubmission,
        createdTaskCardId,
        createTaskPending: createTask.isPending,
        feedbackBySubmission,
        historySubmissions,
        issueRewardPending,
        onApproveSubmission: handleApproveSubmission,
        onClearCreatedTaskCard: () => setCreatedTaskCardId(""),
        onCopyInvite: handleCopyInviteCode,
        onCreateTask: handleCreateTask,
        onIssueReward: handleIssueReward,
        onMiniGameSwitch: scrollDetailToTop,
        onReturnSubmission: handleReturnSubmission,
        onRoomTabChange: setActiveRoomTab,
        onSendRoomNotification: handleSendRoomNotification,
        onSelectWinner: handleSelectWinner,
        onShareRoom: handleShareCode,
        pendingApprovalSubmissionId,
        pendingRewardKind,
        pendingSubmissions: pendingHostSubmissions,
        pendingWinnerSubmissionId,
        proofTypes,
        returnSubmissionPending: returnSubmission.isPending,
        rewardForms,
        rewards: roomWorkspaceRewards,
        room: selectedRoom,
        roomTasks,
        selectWinnerPending,
        selectedTaskId,
        sendRoomNotificationPending: sendRoomNotification.isPending,
        setAwardBySubmission,
        setAssignmentMode,
        setFeedbackBySubmission,
        setProofTypes,
        setRewardForms,
        setTaskForm,
        setTaskKind,
        taskForm,
        taskKind,
        winnerSubmissions,
      }
    : null;
  const participantWorkspace: ParticipantWorkspaceModel = {
    activeParticipantTab,
    mySubmissions: roomMySubmissions,
    onMiniGameSwitch: scrollDetailToTop,
    onParticipantTabChange: setActiveParticipantTab,
    onSelectTask: setSelectedTaskId,
    onSubmitProof: handleSubmitProof,
    rewards: roomWorkspaceRewards,
    roomTasks,
    roomWinners,
    selectedTask,
    selectedTaskId,
    setSubmitForm,
    submitForm,
    submitProofPending: submitProof.isPending,
  };

  if (isInitialDashboardLoading) {
    return <FullScreenLoader message="Loading this room..." />;
  }

  return (
    <View style={styles.screen}>
      <AppHeader
        notificationCount={roomNotifications.length}
        onNotificationPress={handleNotifications}
      />
      <ScrollView
        ref={detailScrollRef}
        contentContainerStyle={styles.dashboardContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          onPress={handleBackToRooms}
          style={({ pressed }) => [
            styles.detailBackButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="chevron-back-outline"
            size={18}
            color={theme.participant}
          />
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

        {dashboard.error ? (
          <ErrorBanner message={dashboard.error.message} />
        ) : null}
        {message ? (
          <StatusBanner message={message.text} tone={message.tone} />
        ) : null}

        {selectedRoom ? (
          <RoomWorkspace
            activeParticipantTab={activeParticipantTab}
            activeRoomTab={activeRoomTab}
            hostWorkspace={hostWorkspace}
            participantWorkspace={participantWorkspace}
            room={selectedRoom}
            roomRole={effectiveRoomRole}
            roomTasks={roomTasks}
            roomWinners={roomWinners}
          />
        ) : !dashboard.isLoading ? (
          <Panel
            eyebrow="Room"
            icon="alert-circle-outline"
            title="Room Not Found"
            tone="red"
          >
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

function RoomWorkspace({
  activeParticipantTab,
  activeRoomTab,
  hostWorkspace,
  participantWorkspace,
  room,
  roomRole,
  roomTasks,
  roomWinners,
}: {
  activeParticipantTab: ParticipantTab | null;
  activeRoomTab: RoomTab | null;
  hostWorkspace: HostWorkspaceModel | null;
  participantWorkspace: ParticipantWorkspaceModel;
  room: HackRoom;
  roomRole: Role;
  roomTasks: DashboardData["tasks"];
  roomWinners: DashboardData["visibleWinners"];
}) {
  const tone = roomRole === "host" ? "violet" : "cyan";
  const focusedActionOpen =
    roomRole === "host"
      ? Boolean(activeRoomTab)
      : Boolean(activeParticipantTab);

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
            <MiniStat
              icon="people-outline"
              label="Members"
              value={room.participants.length}
            />
            <MiniStat
              icon="clipboard-outline"
              label="Tasks"
              value={roomTasks.length}
            />
            <MiniStat
              icon="trophy-outline"
              label="Winners"
              value={roomWinners.length}
            />
          </View>

          {roomRole === "host" ? (
            <TrackLabel label="Organizer track" tone="violet" />
          ) : (
            <TrackLabel label="Member track" tone="cyan" />
          )}
        </>
      ) : null}

      {roomRole === "host" ? (
        hostWorkspace ? (
          <HostRoomWorkspace workspace={hostWorkspace} />
        ) : null
      ) : (
        <ParticipantRoomWorkspace workspace={participantWorkspace} />
      )}
    </View>
  );
}
