import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import type * as React from "react";

import { NativeIcon } from "@/lib/native-icons";

import {
  buildProofItemsForTask,
  formatDate,
  getEmailTokens,
  getGameTypeInfo,
  getSubmissionLedgerXrdm,
  getSubmissionProofItems,
  getTaskProofTypes,
  isEmailLike,
  kindLabel,
  makeEmptyRewardForm,
  makeEmptySubmitForm,
  normalizeEmails,
  proofTypeIcon,
  proofTypeLabel,
  proofTypePlaceholder,
  rewardKindLabel,
  statusTone,
  submissionStatusLabel,
  type DashboardData,
  type HackReward,
  type HackRoom,
  type HackSubmission,
  type HackTask,
  type RewardKind,
  type SessionUser,
  type Tone,
} from "./model";
import {
  Avatar,
  Badge,
  ChipButton,
  EmptyState,
  Field,
  LedgerRow,
  ProofItemsList,
  ProofTag,
  ProfileField,
  RewardCard,
  SectionCard,
  StatBox,
  SubmissionCard,
  TaskCard,
  TaskKindButton,
  TextArea,
} from "./shared-ui";

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
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {(["participant_certificate", "winner_certificate", "winner_nft_badge"] as RewardKind[]).map((kind) => (
              <TaskKindButton
                active={rewardForm.kind === kind}
                icon={
                  kind === "participant_certificate" ? (
                    <NativeIcon className="size-4" name="ribbon-outline" />
                  ) : kind === "winner_certificate" ? (
                    <NativeIcon className="size-4" name="trophy-outline" />
                  ) : (
                    <NativeIcon className="size-4" name="diamond-outline" />
                  )
                }
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
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#CCC6BA]"
                onChange={(event) => onRewardFormChange((current) => ({ ...current, title: event.target.value }))}
                placeholder={rewardKindLabel(rewardForm.kind)}
                value={rewardForm.title}
              />
            </Field>
            <Field label="XRDM Attached">
              <Input
                className="h-10 rounded-[9px] border-[#F0C040] bg-[#241A00] font-mono text-[13px] text-[#F0C040]"
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
            className="h-11 w-full rounded-[10px] bg-[#F0C040] text-[#120d00] hover:bg-[#F0C040]/85"
            disabled={issueRewardPending || !room}
            onClick={() => onIssueReward(rewardForm.kind)}
            type="button"
          >
            <NativeIcon className="size-4" name="send-outline" />
            Issue {rewardKindLabel(rewardForm.kind)}
          </Button>
        </div>
      </SectionCard>

      <SectionCard badge={`${rewards.length} issued`} eyebrow="Ledger" title="Issued Awards">
        <div className="grid gap-2">
          {rewards.length ? (
            rewards.map((reward) => <RewardCard key={reward._id} reward={reward} />)
          ) : (
            <EmptyState icon={<NativeIcon name="ribbon-outline" />} text="Certificates and NFT badge records will appear here." />
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
                      className="h-10 rounded-[9px] border-[#F0C040] bg-[#241A00] font-mono text-[13px] text-[#F0C040]"
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
                    <NativeIcon className="size-4" name="trophy-outline" />
                    Award XRDM
                  </Button>
                </div>
              }
            />
          ))
        ) : (
          <EmptyState icon={<NativeIcon name="trophy-outline" />} text="Verify submissions before announcing winners." />
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
                    <NativeIcon className="size-4" name="checkmark-outline" />
                    Verify
                  </Button>
                  <Button
                    className="h-10 rounded-[10px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
                    onClick={() => onReturnSubmission(submission)}
                    type="button"
                    variant="outline"
                  >
                    <NativeIcon className="size-4" name="close-outline" />
                    Return
                  </Button>
                </div>
              }
            />
          ))
        ) : (
          <EmptyState icon={<NativeIcon name="shield-checkmark-outline" />} text="Submitted proof from participants will appear here." />
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
            <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">
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
        <p className="mt-2 text-xs leading-[18px] text-[#9C9690]">{submission.submissionDescription}</p>
      ) : null}
      {submission.notes ? <p className="mt-2 text-xs leading-[18px] text-[#626058]">{submission.notes}</p> : null}
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
          <EmptyState icon={<NativeIcon name="checkmark-circle-outline" />} text="Submitted, returned, verified, and winner records will appear here." />
        )}
      </div>
    </SectionCard>
  );
}

function WalletPanel({
  myRewards,
  mySubmissions,
  ownerName,
  room,
}: {
  myRewards: HackReward[];
  mySubmissions: DashboardData["mySubmissions"];
  ownerName?: string;
  room?: HackRoom;
}) {
  const balance =
    mySubmissions.reduce((total, submission) => total + getSubmissionLedgerXrdm(submission), 0) +
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
          <NativeIcon className="size-5 text-[#F0C040]" name="wallet-outline" />
        </div>
        <div className="text-[13px] font-semibold text-[#F0C040]">XRDM Wallet</div>
        <p className="mt-2 text-xs leading-[18px] text-[#9C9690]">
          Certificates, NFT badges, winner awards, and verified proof issued on the in-app So.Good Ledger.
        </p>
        <div className="mt-3 inline-flex items-center gap-1 rounded-[8px] border border-[#F0C040] bg-[#241A00] px-3 py-1 font-mono text-[10px] uppercase text-[#F0C040]">
          <NativeIcon className="size-3" name="diamond-outline" />
          Issued - Ledger
        </div>
      </div>

      <SectionCard eyebrow="My XRDM Balance" title={ownerName ?? "Wallet"} badge={`${balance} XRDM`}>
        <div className="mb-3 flex items-baseline gap-2">
          <div className="text-[32px] font-medium text-[#EEE8DE]">{balance}</div>
          <div className="text-[13px] font-medium text-[#626058]">XRDM</div>
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
              value={`+${getSubmissionLedgerXrdm(submission)} XRDM`}
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
            <EmptyState icon={<NativeIcon name="diamond-outline" />} text="Verified proof, certificates, NFT badges, and XRDM records will appear here." />
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
              <div className="w-7 font-mono text-[13px] font-semibold text-[#F0C040]">#{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{entry.name}</div>
                <div className="truncate text-[11px] text-[#626058]">{entry.email}</div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-semibold text-[#1EEAB0]">+{entry.points} XRDM</div>
                <div className="text-[10px] text-[#626058]">{entry.wins} wins</div>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={<NativeIcon name="podium-outline" />} text="Leaderboard starts once participants join or win XRDM." />
        )}
      </div>
    </SectionCard>
  );
}

function RoomProfile({
  onExitRoom,
  onShareInvite,
  room,
  user,
}: {
  onExitRoom: () => void;
  onShareInvite: (room: HackRoom) => void;
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
              <NativeIcon className="size-4" name="share-outline" />
              Share Invite
            </Button>
            <Button
              className="h-10 rounded-[10px] border-[#F0C040] bg-[#241A00] text-[#F0C040] hover:bg-[#241A00]/80"
              onClick={onExitRoom}
              type="button"
              variant="outline"
            >
              <NativeIcon className="size-4" name="arrow-back-outline" />
              Exit Room
            </Button>
          </div>
        </>
      ) : (
        <>
          <ProfileField label="Name" value={user.name} />
          <ProfileField label="Email" value={user.email} />
          <Button
            className="mt-3 h-10 w-full rounded-[10px] border-[#F0C040] bg-[#241A00] text-[#F0C040]"
            onClick={onExitRoom}
            type="button"
            variant="outline"
          >
            <NativeIcon className="size-4" name="arrow-back-outline" />
            Back to Rooms
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
          <EmptyState icon={<NativeIcon name="layers-outline" />} text="Created assignments, challenges, games, and special tasks will appear here." />
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
          <EmptyState icon={<NativeIcon name="time-outline" />} text={emptyText} />
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
              <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{participant.name}</div>
              <div className="truncate text-[11px] text-[#626058]">{participant.email}</div>
            </div>
            <div className="text-[11px] text-[#626058]">{formatDate(participant.joinedAt)}</div>
          </div>
        ))
      ) : (
        <EmptyState icon={<NativeIcon name="people-outline" />} text="No participants yet. Share the invite code to fill the room." />
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
      <div className="flex flex-wrap gap-2">
        <ChipButton
          active={selectedRecipientIds.length === allIds.length}
          label="All participants"
          onClick={() => onRewardFormChange((current) => ({ ...current, recipientIds: allIds }))}
        />
        {room.participants.map((participant) => {
          const active = selectedRecipientIds.includes(participant.userId);
          return (
            <RecipientButton
              active={active}
              key={participant.userId}
              participant={participant}
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

function RecipientButton({
  active,
  onClick,
  participant,
}: {
  active: boolean;
  onClick: () => void;
  participant: HackRoom["participants"][number];
}) {
  return (
    <button
      aria-pressed={active}
      className={`flex min-h-12 max-w-full items-center gap-2 rounded-[8px] border px-3 py-2 text-left transition ${
        active
          ? "border-[#1EEAB0] bg-[#061F18] text-[#1EEAB0]"
          : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690] hover:border-[#1EEAB0]/60"
      }`}
      onClick={onClick}
      title={`${participant.name} - ${participant.email}`}
      type="button"
    >
      <Avatar name={participant.name} tone={active ? "cyan" : "violet"} />
      <span className="min-w-0">
        <span className="block truncate font-mono text-[10px] font-semibold uppercase tracking-[0.08em]">
          {participant.name}
        </span>
        <span className={`block truncate text-[11px] ${active ? "text-[#9CFFF0]" : "text-[#626058]"}`}>
          {participant.email}
        </span>
      </span>
    </button>
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
      <div className="flex flex-wrap gap-2">
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
          <EmptyState icon={<NativeIcon name="trophy-outline" />} text="Announce a winner before issuing winner certificates or NFT badges." />
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
      <div className="rounded-[9px] border border-[#1EEAB0] bg-[#061F18] p-2">
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
                  <NativeIcon className="size-3" name="close-outline" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            className="h-9 rounded-[8px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#EEE8DE]"
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
            <NativeIcon className="size-4" name="add-outline" />
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
    return <EmptyState icon={<NativeIcon name="clipboard-outline" />} text="Select an assignment to see required proof." />;
  }

  return (
    <div className="grid gap-3">
      {getTaskProofTypes(selectedTask).map((proofType) => (
        <Field key={proofType} label={`${proofTypeLabel(proofType)} Proof`}>
          <Input
            className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#061F18] text-[13px] text-[#EEE8DE]"
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

export {
  AwardPanel,
  CreatedTasks,
  LeaderboardPanel,
  MemberList,
  ParticipantHistoryPanel,
  ProofRequirementFields,
  RecipientSelector,
  RewardsPanel,
  ReviewQueue,
  RoomProfile,
  SubmissionList,
  TeamMateEmailComposer,
  WalletPanel,
  WinnerSourceSelector,
};
