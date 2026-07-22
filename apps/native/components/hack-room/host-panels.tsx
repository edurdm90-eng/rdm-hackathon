import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MiniGamePlaySurface } from "@/components/hack-room/mini-games";
import { RewardCard } from "@/components/hack-room/reward-cards";
import { SubmissionReviewCard } from "@/components/hack-room/submission-review-card";
import {
  CounterLabel,
  DateTimeField,
  EmptyState,
  Field,
  HackButton,
  HackTextInput,
  InviteActionButton,
  KindButton,
  Panel,
  ParticipantListItem,
  ProfileRow,
  QuickActionTile,
  StatusPill,
  SubmissionCard,
} from "@/components/hack-room/components";
import {
  defaultGameProofTypes,
  defaultRegularProofTypes,
  defaultSpecialProofTypes,
  defaultSpotProofTypes,
  emptyTaskForm,
  formatDate,
  gameTypeOptions,
  getEmailTokens,
  getMinimumTaskDueDate,
  getTaskDueDateError,
  getTaskProofTypes,
  getToneColors,
  isEmailLike,
  kindLabel,
  normalizeEmails,
  normalizeTaskProofTypes,
  proofTypeLabel,
  proofTypeOptions,
  taskKindTone,
  type AssignmentMode,
  type DashboardData,
  type HackReward,
  type HackRoom,
  type HackSubmission,
  type HackTask,
  type ProofType,
  type RewardForm,
  type RewardFormsByKind,
  type RewardFormSetter,
  type RewardKind,
  type RoomTab,
  type TaskKind,
  type Tone,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import type { HostWorkspaceModel } from "@/components/hack-room/workspace-models";
import { HACK_THEME as theme } from "@/lib/constants";

type HackIconName = React.ComponentProps<typeof Ionicons>["name"];
type AssignmentModeUi = {
  badgeLabel: string;
  badgeTone: Tone;
  dateLabel: string;
  defaultProofTypes: Array<ProofType>;
  defaultRewardXrdm: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  fieldLabel: string;
  proofLabel: string;
  submitIcon: HackIconName;
  submitLabel: string;
  submitTone: Tone;
  titlePlaceholder: string;
};

const assignmentModeUiByMode: Record<AssignmentMode, AssignmentModeUi> = {
  challenge: {
    badgeLabel: "All members",
    badgeTone: "cyan",
    dateLabel: "Challenge date and time",
    defaultProofTypes: defaultSpotProofTypes,
    defaultRewardXrdm: "10",
    descriptionLabel: "Rules / brief",
    descriptionPlaceholder:
      "Describe the fun challenge, who can join, and how winners will be picked.",
    fieldLabel: "Challenge name",
    proofLabel: "Challenge proof",
    submitIcon: "flash-outline",
    submitLabel: "Create Spot Challenge",
    submitTone: "orange",
    titlePlaceholder: "10-minute UX fix sprint",
  },
  game: {
    badgeLabel: "All members",
    badgeTone: "cyan",
    dateLabel: "Game date and time",
    defaultProofTypes: defaultGameProofTypes,
    defaultRewardXrdm: "10",
    descriptionLabel: "Rules / brief",
    descriptionPlaceholder:
      "Tell members what score, attempt, or result the host will verify.",
    fieldLabel: "Game name",
    proofLabel: "Game proof",
    submitIcon: "game-controller-outline",
    submitLabel: "Create Game Card",
    submitTone: "gold",
    titlePlaceholder: "Bug bash arena",
  },
  notification: {
    badgeLabel: "Room nudge",
    badgeTone: "violet",
    dateLabel: "Due date and time",
    defaultProofTypes: [],
    defaultRewardXrdm: "10",
    descriptionLabel: "Message",
    descriptionPlaceholder:
      "Nudge everyone with the next step, reminder, or deadline.",
    fieldLabel: "Notification title",
    proofLabel: "Expected proof",
    submitIcon: "notifications-outline",
    submitLabel: "Send Notification",
    submitTone: "violet",
    titlePlaceholder: "Final submission reminder",
  },
  special: {
    badgeLabel: "One member",
    badgeTone: "orange",
    dateLabel: "Special task due date and time",
    defaultProofTypes: defaultSpecialProofTypes,
    defaultRewardXrdm: "15",
    descriptionLabel: "Description",
    descriptionPlaceholder:
      "Give this member a focused follow-up task and explain the expected proof.",
    fieldLabel: "Assignment title",
    proofLabel: "Special task proof",
    submitIcon: "star-outline",
    submitLabel: "Create Special Task",
    submitTone: "orange",
    titlePlaceholder: "Private API integration follow-up",
  },
  task: {
    badgeLabel: "All members",
    badgeTone: "cyan",
    dateLabel: "Due date and time",
    defaultProofTypes: defaultRegularProofTypes,
    defaultRewardXrdm: "20",
    descriptionLabel: "Description",
    descriptionPlaceholder:
      "Submit a functional demo. GitHub and Drive proof are mandatory.",
    fieldLabel: "Assignment title",
    proofLabel: "Expected proof",
    submitIcon: "send-outline",
    submitLabel: "Publish Regular Task",
    submitTone: "violet",
    titlePlaceholder: "Build a working prototype",
  },
};

export function HostRoomWorkspace({
  workspace,
}: {
  workspace: HostWorkspaceModel;
}) {
  const {
    activeRoomTab,
    assignmentMode,
    approvedSubmissions,
    approveSubmissionPending,
    awardBySubmission,
    createdTaskCardId,
    createTaskPending,
    feedbackBySubmission,
    historySubmissions,
    issueRewardPending,
    onApproveSubmission,
    onClearCreatedTaskCard,
    onCopyInvite,
    onCreateTask,
    onIssueReward,
    onMiniGameSwitch,
    onReturnSubmission,
    onRoomTabChange,
    onSendRoomNotification,
    onSelectWinner,
    onShareRoom,
    pendingApprovalSubmissionId,
    pendingRewardKind,
    pendingSubmissions,
    pendingWinnerSubmissionId,
    proofTypes,
    returnSubmissionPending,
    rewardForms,
    rewards,
    room,
    roomTasks,
    selectWinnerPending,
    selectedTaskId,
    sendRoomNotificationPending,
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
  } = workspace;
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
          .some((value) =>
            value?.toLowerCase().includes(normalizedWinnerSearch),
          ),
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
  const activeAction = hostQuickActions.find(
    (action) => action.id === activeRoomTab,
  );

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
          style={({ pressed }) => [
            styles.actionBackButton,
            pressed && styles.pressed,
          ]}
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
                <ParticipantListItem
                  key={participant.userId}
                  participant={participant}
                />
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
            const modeUi = assignmentModeUiByMode[kind];
            setAssignmentMode(kind);
            if (kind !== "notification") {
              setTaskKind(kind);
            }
            setProofTypes([...modeUi.defaultProofTypes]);
            setTaskForm({
              ...emptyTaskForm,
              rewardXrdm: modeUi.defaultRewardXrdm,
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
            onClearCreatedTaskCard();
            setHistoryTaskId(taskId);
            onRoomTabChange("history");
          }}
          roomTasks={roomTasks}
          selectedTaskId={createdTaskCardId || selectedTaskId}
        />
      ) : null}

      {activeRoomTab === "verify" ? (
        <Panel
          action={
            <CounterLabel label={`${pendingSubmissions.length} pending`} />
          }
          eyebrow="Verification"
          icon="ribbon-outline"
          title="Review Queue"
          tone="violet"
        >
          <View style={styles.listStack}>
            {pendingSubmissions.length ? (
              pendingSubmissions.map((submission) => {
                const approvalButtonLoading =
                  pendingApprovalSubmissionId === submission._id;
                return (
                  <SubmissionReviewCard
                    approveSubmissionDisabled={approveSubmissionPending}
                    approveSubmissionLoading={approvalButtonLoading}
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
                );
              })
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

      {activeRoomTab === "games" ? (
        <HostGamesPanel onMiniGameSwitch={onMiniGameSwitch} />
      ) : null}

      {activeRoomTab === "winners" ? (
        <Panel
          action={
            <CounterLabel
              label={`${filteredApprovedSubmissions.length}/${approvedSubmissions.length} ready`}
            />
          }
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
                  style={({ pressed }) => [
                    styles.searchClearButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close-outline"
                    size={15}
                    color={theme.award}
                  />
                </Pressable>
              ) : null}
            </View>
          </Field>
          <View style={styles.listStack}>
            {approvedSubmissions.length ? (
              filteredApprovedSubmissions.length ? (
                filteredApprovedSubmissions.map((submission) => {
                  const winnerButtonLoading =
                    pendingWinnerSubmissionId === submission._id;
                  return (
                    <SubmissionReviewCard
                      award={
                        awardBySubmission[submission._id] ??
                        String(
                          submission.awardXrdm ?? submission.rewardXrdm ?? 20,
                        )
                      }
                      feedback={
                        feedbackBySubmission[submission._id] ??
                        submission.hostFeedback ??
                        "Strong contribution and clear proof of participation."
                      }
                      key={submission._id}
                      mode="winner"
                      onAwardChange={(value) =>
                        setAwardBySubmission((current) => ({
                          ...current,
                          [submission._id]: value,
                        }))
                      }
                      onFeedbackChange={(value) =>
                        setFeedbackBySubmission((current) => ({
                          ...current,
                          [submission._id]: value,
                        }))
                      }
                      onSelectWinner={() => onSelectWinner(submission)}
                      selectWinnerDisabled={selectWinnerPending}
                      selectWinnerLoading={winnerButtonLoading}
                      submission={submission}
                    />
                  );
                })
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
          pendingRewardKind={pendingRewardKind}
          rewardForms={rewardForms}
          rewards={rewards}
          room={room}
          setRewardForms={setRewardForms}
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
        <Panel
          eyebrow="Room"
          icon="person-circle-outline"
          title="Profile"
          tone="violet"
        >
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
  selectedTaskId,
}: {
  historySubmissions: DashboardData["hostSubmissions"];
  onOpenTaskHistory: (taskId: string) => void;
  roomTasks: DashboardData["tasks"];
  selectedTaskId: string;
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
    historyCountByTask.set(
      submission.taskId,
      (historyCountByTask.get(submission.taskId) ?? 0) + 1,
    );
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
            const count = roomTasks.filter(
              (task) => (task.kind ?? "task") === taskKind.kind,
            ).length;
            const toneColors = getToneColors(taskKindTone(taskKind.kind));

            return (
              <View
                key={taskKind.kind}
                style={[
                  styles.createdTaskKindChip,
                  {
                    backgroundColor: toneColors.bg,
                    borderColor: toneColors.border,
                  },
                ]}
              >
                <Ionicons
                  name={taskKind.icon}
                  size={15}
                  color={toneColors.fg}
                />
                <Text
                  style={[
                    styles.createdTaskKindCount,
                    { color: toneColors.fg },
                  ]}
                >
                  {count}
                </Text>
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
                selected={task._id === selectedTaskId}
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
    ? historySubmissions.filter(
        (submission) => submission.taskId === selectedTask._id,
      )
    : [];
  const historyCountByTask = new Map<string, number>();
  historySubmissions.forEach((submission) => {
    historyCountByTask.set(
      submission.taskId,
      (historyCountByTask.get(submission.taskId) ?? 0) + 1,
    );
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
          <Ionicons
            name="checkmark-circle-outline"
            size={16}
            color={theme.award}
          />
          <Text numberOfLines={1} style={styles.historyGroupTitle}>
            {selectedTask?.title ?? "No assignment selected"}
          </Text>
          <CounterLabel label={`${selectedHistory.length} records`} />
        </View>
        {selectedHistory.length ? (
          selectedHistory.map((submission) => (
            <SubmissionReviewCard
              key={submission._id}
              mode="history"
              submission={submission}
            />
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
  const proofTypes = getTaskProofTypes(task).map((proofType) =>
    proofTypeLabel(proofType),
  );

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
          {typeof historyCount === "number" ? (
            <CounterLabel label={`${historyCount} history`} />
          ) : null}
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

function HostGamesPanel({
  onMiniGameSwitch,
}: {
  onMiniGameSwitch: () => void;
}) {
  return (
    <Panel
      action={<CounterLabel label={`${gameTypeOptions.length} games`} />}
      eyebrow="Host Play"
      icon="game-controller-outline"
      title="Games"
      tone="lime"
    >
      <MiniGamePlaySurface onMiniGameSwitch={onMiniGameSwitch} tone="lime" />
    </Panel>
  );
}

function HostAwardsPanel({
  issueRewardPending,
  onIssueReward,
  pendingRewardKind,
  rewardForms,
  rewards,
  room,
  setRewardForms,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  pendingRewardKind: RewardKind | null;
  rewardForms: RewardFormsByKind;
  rewards: Array<HackReward>;
  room: HackRoom;
  setRewardForms: React.Dispatch<React.SetStateAction<RewardFormsByKind>>;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const [awardMode, setAwardMode] = useState<"certificates" | "nfts">(
    "certificates",
  );

  const switchMode = (mode: "certificates" | "nfts") => {
    setAwardMode(mode);
  };
  const setRewardFormForKind =
    (kind: RewardKind): RewardFormSetter =>
    (update) => {
      setRewardForms((current) => ({
        ...current,
        [kind]:
          typeof update === "function"
            ? (update as (currentForm: RewardForm) => RewardForm)(current[kind])
            : update,
      }));
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
          participantRewardForm={rewardForms.participant_certificate}
          pendingRewardKind={pendingRewardKind}
          rewards={rewards}
          room={room}
          setParticipantRewardForm={setRewardFormForKind(
            "participant_certificate",
          )}
          setWinnerRewardForm={setRewardFormForKind("winner_certificate")}
          winnerRewardForm={rewardForms.winner_certificate}
          winnerSubmissions={winnerSubmissions}
        />
      ) : (
        <HostNftBadgesPanel
          issueRewardPending={issueRewardPending}
          onIssueReward={onIssueReward}
          pendingRewardKind={pendingRewardKind}
          rewardForm={rewardForms.winner_nft_badge}
          rewards={rewards}
          room={room}
          setRewardForm={setRewardFormForKind("winner_nft_badge")}
          winnerSubmissions={winnerSubmissions}
        />
      )}
    </View>
  );
}

function HostCertificatesPanel({
  issueRewardPending,
  onIssueReward,
  participantRewardForm,
  pendingRewardKind,
  rewards,
  room,
  setParticipantRewardForm,
  setWinnerRewardForm,
  winnerRewardForm,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  participantRewardForm: RewardForm;
  pendingRewardKind: RewardKind | null;
  rewards: Array<HackReward>;
  room: HackRoom;
  setParticipantRewardForm: RewardFormSetter;
  setWinnerRewardForm: RewardFormSetter;
  winnerRewardForm: RewardForm;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const certificateRewards = rewards.filter(
    (reward) => reward.kind !== "winner_nft_badge",
  );
  const participantRewardPending =
    pendingRewardKind === "participant_certificate";
  const winnerRewardPending = pendingRewardKind === "winner_certificate";
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
              setParticipantRewardForm((current) => ({
                ...current,
                title: value,
              }))
            }
            placeholder="Member Certificate"
            value={participantRewardForm.title}
          />
        </Field>
        <Field label="Certificate note">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setParticipantRewardForm((current) => ({
                ...current,
                description: value,
              }))
            }
            placeholder="Issued for verified participation in this hack room."
            style={styles.textArea}
            value={participantRewardForm.description}
          />
        </Field>
        <Field label="XRDM attached">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) =>
              setParticipantRewardForm((current) => ({
                ...current,
                awardXrdm: value,
              }))
            }
            placeholder="0"
            value={participantRewardForm.awardXrdm}
          />
        </Field>
        <RewardRecipientEmailComposer
          room={room}
          rewardForm={participantRewardForm}
          setRewardForm={setParticipantRewardForm}
          showSelectAll
        />
        <HackButton
          disabled={!room.participants.length || issueRewardPending}
          icon="ribbon-outline"
          label="Issue Member Certificates"
          loading={participantRewardPending}
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
          rewardForm={winnerRewardForm}
          setRewardForm={setWinnerRewardForm}
          winnerSubmissions={winnerSubmissions}
        />
        <RewardRecipientEmailComposer
          room={room}
          rewardForm={winnerRewardForm}
          setRewardForm={setWinnerRewardForm}
        />
        <Field label="Winner certificate title">
          <HackTextInput
            onChangeText={(value) =>
              setWinnerRewardForm((current) => ({ ...current, title: value }))
            }
            placeholder="Winner Certificate"
            value={winnerRewardForm.title}
          />
        </Field>
        <Field label="XRDM attached">
          <HackTextInput
            keyboardType="number-pad"
            onChangeText={(value) =>
              setWinnerRewardForm((current) => ({
                ...current,
                awardXrdm: value,
              }))
            }
            placeholder="50"
            value={winnerRewardForm.awardXrdm}
          />
        </Field>
        <Field label="Ledger note">
          <HackTextInput
            multiline
            onChangeText={(value) =>
              setWinnerRewardForm((current) => ({
                ...current,
                ledgerNote: value,
              }))
            }
            placeholder="Team winner certificate issued by host."
            style={styles.textArea}
            value={winnerRewardForm.ledgerNote}
          />
        </Field>
        <HackButton
          disabled={!winnerSubmissions.length || issueRewardPending}
          icon="trophy-outline"
          label="Issue Winner Certificate"
          loading={winnerRewardPending}
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
            certificateRewards.map((reward) => (
              <RewardCard key={reward._id} reward={reward} />
            ))
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
  pendingRewardKind,
  rewardForm,
  rewards,
  room,
  setRewardForm,
  winnerSubmissions,
}: {
  issueRewardPending: boolean;
  onIssueReward: (kind: RewardKind) => void;
  pendingRewardKind: RewardKind | null;
  rewardForm: RewardForm;
  rewards: Array<HackReward>;
  room: HackRoom;
  setRewardForm: RewardFormSetter;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const nftRewards = rewards.filter(
    (reward) => reward.kind === "winner_nft_badge",
  );
  const nftRewardPending = pendingRewardKind === "winner_nft_badge";

  return (
    <View style={styles.trackStack}>
      <Panel
        action={
          <CounterLabel label={`${room.participants.length} team members`} />
        }
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
          loading={nftRewardPending}
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
            nftRewards.map((reward) => (
              <RewardCard key={reward._id} reward={reward} />
            ))
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

function RewardRecipientEmailComposer({
  room,
  rewardForm,
  setRewardForm,
  showSelectAll = false,
}: {
  room: HackRoom;
  rewardForm: RewardForm;
  setRewardForm: RewardFormSetter;
  showSelectAll?: boolean;
}) {
  const participantEmailList = normalizeEmails(
    room.participants.map((participant) => participant.email),
  );
  const participantEmails = new Set(participantEmailList);
  const selectedAllParticipants =
    participantEmailList.length > 0 &&
    participantEmailList.every((email) =>
      rewardForm.recipientEmails.includes(email),
    );
  const visibleRecipientEmails = selectedAllParticipants
    ? rewardForm.recipientEmails.filter(
        (email) => !participantEmails.has(email),
      )
    : rewardForm.recipientEmails;

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
        recipientEmails: normalizeEmails([
          ...current.recipientEmails,
          ...validEmails,
        ]),
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
          recipientEmails: normalizeEmails([
            ...current.recipientEmails,
            ...validEmails,
          ]),
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

  const clearRecipientEmails = () => {
    setRewardForm((current) => ({
      ...current,
      recipientEmailDraft: "",
      recipientEmails: [],
    }));
  };

  const selectAllParticipants = () => {
    setRewardForm((current) => ({
      ...current,
      recipientEmailDraft: "",
      recipientEmails: normalizeEmails([
        ...current.recipientEmails,
        ...participantEmailList,
      ]),
    }));
  };

  return (
    <Field label="Recipient emails">
      <View style={styles.emailComposer}>
        {showSelectAll ? (
          <View style={styles.emailComposerActionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!participantEmailList.length || selectedAllParticipants}
              onPress={selectAllParticipants}
              style={({ pressed }) => [
                styles.emailComposerAction,
                selectedAllParticipants && styles.emailComposerActionActive,
                (!participantEmailList.length || selectedAllParticipants) &&
                  styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="people-outline"
                size={14}
                color={selectedAllParticipants ? theme.participant : theme.text}
              />
              <Text
                style={[
                  styles.emailComposerActionText,
                  selectedAllParticipants &&
                    styles.emailComposerActionTextActive,
                ]}
              >
                Select all
              </Text>
            </Pressable>
            <Text style={styles.emailComposerCount}>
              {participantEmailList.length} joined
            </Text>
          </View>
        ) : null}
        {selectedAllParticipants ? (
          <View style={styles.emailSelectionSummary}>
            <View style={styles.emailSelectionSummaryIcon}>
              <Ionicons
                name="checkmark-done-outline"
                size={18}
                color={theme.participant}
              />
            </View>
            <View style={styles.emailSelectionSummaryCopy}>
              <Text style={styles.emailSelectionSummaryTitle}>
                All {participantEmailList.length} participants selected
              </Text>
              <Text style={styles.emailSelectionSummaryText}>
                Certificates will be issued to everyone who joined.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={clearRecipientEmails}
              style={({ pressed }) => [
                styles.emailSelectionSummaryClear,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emailSelectionSummaryClearText}>Clear</Text>
            </Pressable>
          </View>
        ) : null}
        {visibleRecipientEmails.length ? (
          <View style={styles.emailChipWrap}>
            {visibleRecipientEmails.map((email) => {
              const knownParticipant = participantEmails.has(email);
              return (
                <View
                  key={email}
                  style={[
                    styles.emailChip,
                    !knownParticipant && styles.emailChipWarning,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.emailChipText,
                      !knownParticipant && styles.emailChipTextWarning,
                    ]}
                  >
                    {email}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Remove ${email}`}
                    accessibilityRole="button"
                    onPress={() => removeEmail(email)}
                    style={({ pressed }) => [
                      styles.emailChipRemove,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name="close-outline"
                      size={13}
                      color={
                        knownParticipant ? theme.participant : theme.warning
                      }
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
            style={({ pressed }) => [
              styles.emailAddButton,
              pressed && styles.pressed,
            ]}
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
  rewardForm: RewardForm;
  setRewardForm: RewardFormSetter;
  winnerSubmissions: DashboardData["hostSubmissions"];
}) {
  const selectedWinnerId =
    rewardForm.sourceSubmissionId || winnerSubmissions[0]?._id || "";

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
                  style={[
                    styles.rewardSelectorText,
                    active && styles.rewardSelectorTextActive,
                  ]}
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
  const modeUi = assignmentModeUiByMode[fixedKind];
  const isRegularTask = fixedKind === "task";
  const isSpotChallenge = fixedKind === "challenge";
  const isGame = fixedKind === "game";
  const isSpecialTask = fixedKind === "special";
  const isNotification = fixedKind === "notification";
  const effectiveProofTypes = isNotification
    ? []
    : normalizeTaskProofTypes(fixedKind, proofTypes);
  const selectableProofTypeOptions = isGame
    ? proofTypeOptions.filter((option) => option.value === "game_score")
    : proofTypeOptions.filter((option) => option.value !== "game_score");
  const dueDateError = isNotification
    ? null
    : getTaskDueDateError(taskForm.dueAt);
  const canSubmitNotification =
    isNotification &&
    taskForm.title.trim() &&
    taskForm.description.trim() &&
    !sendNotificationPending;
  const canSubmitTask =
    !isNotification &&
    taskForm.title.trim() &&
    taskForm.description.trim() &&
    taskForm.dueAt.trim() &&
    !dueDateError &&
    (!isSpecialTask || taskForm.assignedToEmail.trim()) &&
    !createTaskPending;

  const handleProofTypePress = (proofType: ProofType) => {
    if (isGame || isNotification) {
      return;
    }

    const locked =
      isRegularTask && defaultRegularProofTypes.includes(proofType);

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

  return (
    <View style={styles.assignmentComposer}>
      <View style={styles.sectionHeadingRow}>
        <View>
          <Text style={styles.sectionEyebrow}>Organizer Track</Text>
          <Text style={styles.sectionTitleSmall}>{title}</Text>
        </View>
        <StatusPill label={modeUi.badgeLabel} tone={modeUi.badgeTone} />
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

      <Field label={modeUi.fieldLabel}>
        <HackTextInput
          onChangeText={(value) =>
            setTaskForm((current) => ({ ...current, title: value }))
          }
          placeholder={modeUi.titlePlaceholder}
          value={taskForm.title}
        />
      </Field>

      {!isNotification ? (
        <View style={styles.fieldWithHelper}>
          <DateTimeField
            label={modeUi.dateLabel}
            minimumDate={getMinimumTaskDueDate()}
            onChange={(value) =>
              setTaskForm((current) => ({ ...current, dueAt: value }))
            }
            value={taskForm.dueAt}
          />
          {dueDateError ? (
            <Text style={styles.fieldErrorText}>{dueDateError}</Text>
          ) : null}
        </View>
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
                    setTaskForm((current) => ({
                      ...current,
                      gameType: option.value,
                    }))
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
                    <Text
                      style={[
                        styles.gameTypeTitle,
                        active && styles.gameTypeTitleActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.gameTypeDescription}>
                      {option.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}

      <Field label={modeUi.descriptionLabel}>
        <HackTextInput
          multiline
          onChangeText={(value) =>
            setTaskForm((current) => ({ ...current, description: value }))
          }
          placeholder={modeUi.descriptionPlaceholder}
          style={styles.textAreaLarge}
          value={taskForm.description}
        />
      </Field>

      {!isNotification ? (
        <Field label={modeUi.proofLabel}>
          <View style={styles.proofGrid}>
            {selectableProofTypeOptions.map((option) => {
              const active = effectiveProofTypes.includes(option.value);
              const locked =
                isGame ||
                (isRegularTask &&
                  defaultRegularProofTypes.includes(option.value));
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
                  <Text
                    style={[
                      styles.proofChipText,
                      active && styles.proofChipTextActive,
                    ]}
                  >
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
            onChangeText={(value) =>
              setTaskForm((current) => ({ ...current, rewardXrdm: value }))
            }
            placeholder="20"
            value={taskForm.rewardXrdm}
          />
        </Field>
      ) : null}

      <HackButton
        disabled={isNotification ? !canSubmitNotification : !canSubmitTask}
        icon={modeUi.submitIcon}
        label={modeUi.submitLabel}
        loading={isNotification ? sendNotificationPending : createTaskPending}
        onPress={() =>
          isNotification
            ? onSendNotification?.()
            : onCreateTask(fixedKind as TaskKind)
        }
        tone={modeUi.submitTone}
      />
    </View>
  );
}
