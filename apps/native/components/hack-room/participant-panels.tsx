import { Ionicons } from "@expo/vector-icons";
import type React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { MiniGamePlaySurface } from "@/components/hack-room/mini-games";
import { NftBadgeCard, RewardCard } from "@/components/hack-room/reward-cards";
import {
  CounterLabel,
  EmptyState,
  Field,
  HackButton,
  HackTextInput,
  LedgerRow,
  MiniStat,
  Panel,
  ProofRequirementFields,
  QuickActionTile,
  StatusPill,
  SubmissionCard,
  TaskCard,
  WalletChip,
} from "@/components/hack-room/components";
import {
  canShowProofSubmitCard,
  emptySubmitForm,
  formatShortDateTime,
  gameTypeOptions,
  getEmailTokens,
  getGameTypeInfo,
  getTaskGameType,
  getToneColors,
  hasRequiredProofItems,
  isEmailLike,
  normalizeEmails,
  rewardKindLabel,
  statusTone,
  submissionHoldIcon,
  submissionStatusLabel,
  type DashboardData,
  type HackReward,
  type HackTask,
  type ParticipantTab,
  type SubmissionStatus,
} from "@/components/hack-room/domain";
import { styles } from "@/components/hack-room/styles";
import type { ParticipantWorkspaceModel } from "@/components/hack-room/workspace-models";
import { HACK_THEME as theme } from "@/lib/constants";

export function ParticipantRoomWorkspace({
  workspace,
}: {
  workspace: ParticipantWorkspaceModel;
}) {
  const {
    activeParticipantTab,
    mySubmissions,
    onMiniGameSwitch,
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
  } = workspace;
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
  const activeAction = participantActions.find(
    (action) => action.id === activeParticipantTab,
  );

  const openAction = (action: ParticipantTab) => {
    if (action === "submit" && regularTasks.length) {
      const selectedRegularTask = regularTasks.find(
        (task) => task._id === selectedTaskId,
      );
      onSelectTask(selectedRegularTask?._id ?? regularTasks[0]._id);
    }
    if (action === "games" && challengeTasks.length) {
      const selectedChallengeTask = challengeTasks.find(
        (task) => task._id === selectedTaskId,
      );
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
                tone={
                  action.id === "games"
                    ? "lime"
                    : action.id === "wallet"
                      ? "gold"
                      : "cyan"
                }
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
          <Ionicons
            name="chevron-back-outline"
            size={17}
            color={theme.participant}
          />
          <Text
            style={[styles.actionBackText, styles.participantActionBackText]}
          >
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
            ["task", "special"].includes(selectedTask?.kind ?? "task")
              ? selectedTask
              : undefined
          }
          selectedTaskId={selectedTaskId}
          setSubmitForm={setSubmitForm}
          submitForm={submitForm}
          submitProofPending={submitProofPending}
        />
      ) : null}

      {activeParticipantTab === "history" ? (
        <ParticipantHistoryPanel
          mySubmissions={mySubmissions}
          roomTasks={roomTasks}
        />
      ) : null}

      {activeParticipantTab === "games" ? (
        <ParticipantGamesPanel
          challengeTasks={challengeTasks}
          mySubmissions={mySubmissions}
          onMiniGameSwitch={onMiniGameSwitch}
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
  const showProofForm =
    !selectedTask || canShowProofSubmitCard(selectedSubmission?.status);

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
            const submission = mySubmissions.find(
              (item) => item.taskId === task._id,
            );
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
    {
      icon: "checkmark-circle-outline",
      statuses: ["approved"],
      title: "Verified",
    },
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
        <MiniStat
          icon="clipboard-outline"
          label="Room Tasks"
          value={taskCount}
        />
        <MiniStat
          icon="checkmark-circle-outline"
          label="Proof Records"
          value={mySubmissions.length}
        />
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
                  <Ionicons
                    name={group.icon}
                    size={16}
                    color={theme.participant}
                  />
                  <Text style={styles.historyGroupTitle}>{group.title}</Text>
                  <CounterLabel label={`${submissions.length}`} />
                </View>
                {submissions.map((submission) => (
                  <SubmissionCard
                    key={submission._id}
                    submission={submission}
                  />
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
  onMiniGameSwitch,
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
  onMiniGameSwitch: () => void;
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  selectedTask?: HackTask;
  selectedTaskId: string;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
}) {
  const selectedProofTask =
    selectedTask?.kind === "challenge" ? selectedTask : undefined;
  const selectedSubmission = selectedProofTask
    ? mySubmissions.find(
        (submission) => submission.taskId === selectedProofTask._id,
      )
    : undefined;
  const showProofForm =
    !selectedProofTask || canShowProofSubmitCard(selectedSubmission?.status);

  return (
    <View style={styles.trackStack}>
      <Panel
        action={<CounterLabel label={`${gameTypeOptions.length} games`} />}
        eyebrow="Member"
        icon="game-controller-outline"
        title="Games"
        tone="cyan"
      >
        <MiniGamePlaySurface onMiniGameSwitch={onMiniGameSwitch} tone="cyan" />
        <View style={styles.divider} />
        <Text style={styles.sectionEyebrow}>Spot Challenges</Text>
        <View style={styles.listStack}>
          {challengeTasks.length ? (
            challengeTasks.map((task) => {
              const submission = mySubmissions.find(
                (item) => item.taskId === task._id,
              );
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
              icon="flash-outline"
              text="Spot challenges from the host will appear here."
            />
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
    submitForm.submitterName.trim() &&
    submitForm.teamName.trim() &&
    submitForm.description.trim(),
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
        {selectedTask ? (
          <StatusPill label={`+${selectedTask.rewardXrdm} XRDM`} tone="gold" />
        ) : null}
      </View>

      <View style={styles.submitMetaGrid}>
        <View style={styles.submitMetaField}>
          <Field label="Your name">
            <HackTextInput
              onChangeText={(value) =>
                setSubmitForm((current) => ({
                  ...current,
                  submitterName: value,
                }))
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

      <TeamMateEmailComposer
        setSubmitForm={setSubmitForm}
        submitForm={submitForm}
      />

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
          onChangeText={(value) =>
            setSubmitForm((current) => ({ ...current, notes: value }))
          }
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
        label={
          selectedTask?.kind === "game" ? "Submit Game Proof" : "Submit Proof"
        }
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
        teamMateEmails: normalizeEmails([
          ...current.teamMateEmails,
          ...validEmails,
        ]),
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
          teamMateEmails: normalizeEmails([
            ...current.teamMateEmails,
            ...validEmails,
          ]),
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
                  style={({ pressed }) => [
                    styles.emailChipRemove,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name="close-outline"
                    size={13}
                    color={theme.participant}
                  />
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

function ReturnedSubmissionNotice({
  submission,
}: {
  submission: DashboardData["mySubmissions"][number];
}) {
  return (
    <View style={styles.returnedNoticeCard}>
      <View style={styles.submissionHoldHeader}>
        <View
          style={[
            styles.submissionHoldIcon,
            { borderColor: theme.dangerBorder },
          ]}
        >
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
    <View
      style={[
        styles.submissionHoldCard,
        { backgroundColor: toneColors.bg, borderColor: toneColors.border },
      ]}
    >
      <View style={styles.submissionHoldHeader}>
        <View
          style={[
            styles.submissionHoldIcon,
            { borderColor: toneColors.border },
          ]}
        >
          <Ionicons
            name={submissionHoldIcon(submission.status)}
            size={16}
            color={toneColors.fg}
          />
        </View>
        <View style={styles.profileText}>
          <Text style={[styles.submissionHoldTitle, { color: toneColors.fg }]}>
            {title}
          </Text>
          <Text style={styles.submissionHoldText}>{text}</Text>
        </View>
        <StatusPill
          label={submissionStatusLabel(submission.status)}
          tone={tone}
        />
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
          label={
            status ? submissionStatusLabel(status) : `+${task.rewardXrdm} XRDM`
          }
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

function ParticipantWalletPanel({
  mySubmissions,
  rewards,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  rewards: Array<HackReward>;
}) {
  const certificateRewards = rewards.filter(
    (reward) => reward.kind !== "winner_nft_badge",
  );
  const nftRewards = rewards.filter(
    (reward) => reward.kind === "winner_nft_badge",
  );
  const confirmedSubmissions = mySubmissions.filter((submission) =>
    ["approved", "winner"].includes(submission.status),
  );
  const xrdmTotal =
    rewards.reduce((total, reward) => total + (reward.awardXrdm ?? 0), 0) +
    confirmedSubmissions.reduce(
      (total, submission) =>
        total + (submission.awardXrdm ?? submission.rewardXrdm ?? 0),
      0,
    );
  const verifiedCount = confirmedSubmissions.length;

  return (
    <View style={styles.trackStack}>
      <View style={styles.certificateHero}>
        <View style={styles.certificateHeroIcon}>
          <Ionicons name="wallet-outline" size={30} color={theme.award} />
        </View>
        <Text style={styles.certificateHeroTitle}>XRDM Wallet</Text>
        <Text style={styles.certificateHeroText}>
          Certificates, NFT badges, winner awards, and verified proof issued on
          the in-app So.Good Ledger.
        </Text>
        <StatusPill
          label={rewards.length ? "Issued - ledger" : "Awaiting issue"}
          tone="gold"
        />
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
              <NftBadgeCard key={reward._id} reward={reward} showTimestamp />
            ))}
          </ScrollView>
        ) : (
          <EmptyState
            icon="diamond-outline"
            text="Winner NFT badges will appear here."
          />
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
            certificateRewards.map((reward) => (
              <RewardCard key={reward._id} reward={reward} showTimestamp />
            ))
          ) : (
            <EmptyState
              icon="document-text-outline"
              text="Member and winner certificates will appear here after the host issues them."
            />
          )}
        </View>
      </Panel>

      <Panel
        action={
          <CounterLabel
            label={`${confirmedSubmissions.length + rewards.length} rows`}
          />
        }
        eyebrow="Ledger"
        icon="shield-checkmark-outline"
        title="So.Good Ledger Rows"
        tone="cyan"
      >
        <View style={styles.listStack}>
          {confirmedSubmissions.map((submission) => (
            <LedgerRow
              key={submission._id}
              label={submission.taskTitle}
              meta={`${submissionStatusLabel(submission.status)} - ${formatShortDateTime(submission.reviewedAt ?? submission.submittedAt)}`}
              value={`+${submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM`}
            />
          ))}
          {rewards.map((reward) => (
            <LedgerRow
              key={reward._id}
              label={reward.title}
              meta={`${rewardKindLabel(reward.kind)} - ${formatShortDateTime(reward.issuedAt)}`}
              value={reward.awardXrdm ? `+${reward.awardXrdm} XRDM` : "Issued"}
            />
          ))}
          {!confirmedSubmissions.length && !rewards.length ? (
            <EmptyState
              icon="shield-checkmark-outline"
              text="Verified proof, certificates, NFT badges, and XRDM records will appear here."
            />
          ) : null}
        </View>
      </Panel>

      <View style={styles.ledgerLinkCard}>
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={theme.participant}
        />
        <View style={styles.profileText}>
          <Text style={styles.ledgerTitle}>So.Good Ledger</Text>
          <Text style={styles.ledgerText}>
            Verified career record inside this hack room.
          </Text>
        </View>
        <Ionicons
          name="chevron-forward-outline"
          size={17}
          color={theme.participantBorder}
        />
      </View>
    </View>
  );
}
