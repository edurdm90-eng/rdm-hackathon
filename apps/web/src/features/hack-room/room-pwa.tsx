import { Button } from "@rdm-hack/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { usePrivyWallet } from "@/components/privy-provider";
import { NativeIcon } from "@/lib/native-icons";
import { queryClient, trpc } from "@/utils/trpc";

import { getHackRoomBlockchainErrorMessage, useHackRoomBlockchain } from "./blockchain";
import {
  buildLeaderboard,
  buildProofItemsForTask,
  buildRoomEntries,
  canViewTaskForRole,
  defaultGameProofTypes,
  defaultRegularProofTypes,
  defaultSpecialProofTypes,
  defaultSpotProofTypes,
  emptyRoomForm,
  emptyTaskForm,
  friendlyMutationMessage,
  getEmailTokens,
  getFriendlyHackRoomErrorMessage,
  getHostTabFromSegment,
  getParticipantTabFromSegment,
  getRoomRouteParam,
  hasRequiredProofItems,
  isFutureDueAt,
  hostTabSegments,
  isEmailLike,
  makeEmptyRewardForm,
  makeEmptySubmitForm,
  matchesRoomRouteParam,
  minAssignmentDescriptionLength,
  minNotificationMessageLength,
  normalizeEmails,
  normalizeTaskProofTypes,
  participantTabSegments,
  proofTypeLabel,
  rewardKindLabel,
  type AssignmentMode,
  type HackRoom,
  type HackSubmission,
  type HostTab,
  type ParticipantTab,
  type ProofType,
  type RewardKind,
  type SessionUser,
  type Tone,
} from "./model";
import { RoomHero, RoomSwitcher, WebAppScreen } from "./room-shell";
import { HostSurface, LobbySurface, ParticipantSurface } from "./surfaces";
import { EmptyState, SectionCard, StatusBanner } from "./shared-ui";

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
  const [hostTab, setHostTab] = useState<HostTab>("assign");
  const [participantTab, setParticipantTab] = useState<ParticipantTab>("submit");
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
  const { createHackathonOnchain } = useHackRoomBlockchain();
  const { walletAddress, walletError } = usePrivyWallet();

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const tasks = dashboard.data?.tasks ?? [];
  const mySubmissions = dashboard.data?.mySubmissions ?? [];
  const hostSubmissions = dashboard.data?.hostSubmissions ?? [];
  const visibleWinners = dashboard.data?.visibleWinners ?? [];
  const rewards = dashboard.data?.rewards ?? [];
  const allRooms = useMemo(() => buildRoomEntries(hostedRooms, joinedRooms), [hostedRooms, joinedRooms]);
  const canCreateRoom = dashboard.data?.viewerRole === "host";
  const createRoomBlockMessage = dashboard.data && !canCreateRoom
    ? "Only host accounts can create hack rooms. Ask the server/admin owner to make this account a host."
    : null;

  const activeSelectionId = roomId || activeRoomId;
  const selectedRoomEntry = roomId
    ? allRooms.find((entry) => matchesRoomRouteParam(entry.room, roomId))
    : undefined;
  const selectedRoom = selectedRoomEntry?.room;
  const role = selectedRoomEntry?.role ?? "host";
  const selectedRoomId = selectedRoom?._id ?? "";
  const activeHostTab = roomTab ? getHostTabFromSegment(roomTab) : hostTab;
  const activeParticipantTab = roomTab ? getParticipantTabFromSegment(roomTab) : participantTab;
  const isStandaloneWallet = activeParticipantTab === "wallet";

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
    if (roomTab === "spot-challenge" && assignmentMode !== "challenge") {
      handleAssignmentModeChange("challenge");
    }
  }, [assignmentMode, roomTab]);

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
      onError: (error) => showMessage(getFriendlyHackRoomErrorMessage(error), "red"),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setActiveRoomId(room._id);
        showMessage(`Created ${room.name} with invite ${room.inviteCode}. Syncing on-chain...`, "violet");
        await invalidateDashboard();
      },
    }),
  );
  const completeRoomOnchainCreate = useMutation(
    trpc.hackRoom.completeRoomOnchainCreate.mutationOptions({
      onSuccess: async (room) => {
        showMessage(`${room.name} is confirmed on-chain.`, "gold");
        await invalidateDashboard();
      },
    }),
  );

  const joinRoom = useMutation(
    trpc.hackRoom.joinRoom.mutationOptions({
      onError: (error) => showMessage(getFriendlyHackRoomErrorMessage(error), "red"),
      onSuccess: async (room) => {
        setInviteCode("");
        setActiveRoomId(room._id);
        showMessage(`Joined ${room.name}`, "cyan");
        await invalidateDashboard();
      },
    }),
  );

  const createRoomPending = createRoom.isPending;

  async function handleCreateRoom() {
    if (!roomForm.name.trim() || createRoomPending) {
      return;
    }

    if (!canCreateRoom) {
      showMessage(createRoomBlockMessage ?? "Only host accounts can create hack rooms.", "red");
      return;
    }

    try {
      const room = await createRoom.mutateAsync(roomForm);
      setActiveRoomId(room._id);

      if (walletError || !walletAddress) {
        showMessage(`${room.name} is created. Wallet is not ready, so on-chain sync will need a retry later.`, "gold");
        return;
      }

      void (async () => {
        try {
          showMessage(`${room.name} created. Syncing on-chain in background...`, "gold");
          const txHash = await createHackathonOnchain();
          showMessage("Transaction mined. Verifying event and saving room...", "violet");
          await completeRoomOnchainCreate.mutateAsync({
            roomId: room._id,
            txHash,
          });
        } catch (error) {
          const errorMessage = getFriendlyHackRoomErrorMessage(new Error(getHackRoomBlockchainErrorMessage(error)));
          showMessage(`${room.name} is created, but on-chain sync failed: ${errorMessage}`, "red");
        }
      })();
    } catch (error) {
      const errorMessage = getFriendlyHackRoomErrorMessage(error);
      showMessage(errorMessage, "red");
    }
  }

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

    if (!isFutureDueAt(taskForm.dueAt)) {
      showMessage("Choose a future due date and time", "red");
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
    if (room.onchainStatus !== "confirmed") {
      showMessage("Room is created. Wait for on-chain sync before sharing the invite.", "gold");
      return;
    }

    await navigator.clipboard?.writeText(room.inviteCode);
    showMessage(`Copied ${room.inviteCode}`, "cyan");
  }

  async function shareInvite(room: HackRoom) {
    if (room.onchainStatus !== "confirmed") {
      showMessage("Room is created. Wait for on-chain sync before sharing the invite.", "gold");
      return;
    }

    const message = `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`;
    if (navigator.share) {
      await navigator.share({ text: message, title: `${room.name} invite` });
      return;
    }
    await navigator.clipboard?.writeText(message);
    showMessage("Invite copied to clipboard", "cyan");
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
        <button
          className="mb-3 flex items-center gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-left"
          onClick={() => navigate({ to: "/hack-room" })}
          type="button"
        >
          <NativeIcon className="size-4 text-[#9C9690]" name="arrow-back-outline" />
          <span className="text-[13px] font-semibold text-[#EEE8DE]">Hack Rooms</span>
        </button>

        {isStandaloneWallet ? null : (
          <RoomHero
            onCopyInvite={role === "host" ? copyInviteCode : undefined}
            onShareInvite={role === "host" ? shareInvite : undefined}
            role={role}
            room={selectedRoom}
            stats={{
              participants: selectedRoom?.participants.length ?? 0,
              tasks: roomTasks.length,
              winners: roomWinners.length,
            }}
          />
        )}

        {isBusy ? (
          <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-xs text-[#9C9690]">
            <NativeIcon className="size-4 animate-spin text-[#F0C040]" name="refresh-outline" />
            Syncing Hack Room...
          </div>
        ) : null}

        {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}
        {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

        {roomId && !selectedRoom && !dashboard.isLoading ? (
          <SectionCard eyebrow="Room" title="Room Not Found" tone="red">
            <EmptyState
              icon={<NativeIcon name="flash-outline" />}
              text="This room is not available for your account. Go back and choose one of your rooms."
            />
            <Button
              className="mt-3 h-10 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
              onClick={() => navigate({ to: "/hack-room" })}
              type="button"
            >
              <NativeIcon className="size-4" name="arrow-back-outline" />
              Back to Hack Rooms
            </Button>
          </SectionCard>
        ) : isStandaloneWallet ? (
          <ParticipantSurface
            activeTab="wallet"
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
            showJoinTrack={false}
            submitForm={submitForm}
            submitProofPending={submitProof.isPending}
            tasks={roomTasks}
            user={user}
          />
        ) : role === "host" ? (
          <HostSurface
            activeTab={activeHostTab}
            approvedSubmissions={approvedSubmissions}
            assignmentMode={assignmentMode}
            createRoomPending={createRoomPending}
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
            onCreateRoom={handleCreateRoom}
            onCreateTask={handleCreateTask}
            onExitRoom={() => navigate({ to: "/hack-room" })}
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
