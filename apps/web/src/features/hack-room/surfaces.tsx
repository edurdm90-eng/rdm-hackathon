import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import type * as React from "react";

import { NativeIcon, createNativeIcon } from "@/lib/native-icons";

import { AssignmentComposer, ParticipantSubmitPanel, RoomCommandCenter } from "./forms";
import { MiniGameArena, ParticipantGamesPanel } from "./mini-games";
import {
  emptyRoomForm,
  emptyTaskForm,
  hostTabs,
  isParticipantSubmitTask,
  makeEmptyRewardForm,
  makeEmptySubmitForm,
  participantTabs,
  type AssignmentMode,
  type DashboardData,
  type HackReward,
  type HackRoom,
  type HackSubmission,
  type HackTask,
  type HostTab,
  type ParticipantTab,
  type ProofType,
  type RewardKind,
  type Role,
  type SessionUser,
} from "./model";
import {
  AwardPanel,
  CreatedTasks,
  LeaderboardPanel,
  MemberList,
  ParticipantHistoryPanel,
  RewardsPanel,
  ReviewQueue,
  RoomProfile,
  SubmissionList,
  WalletPanel,
} from "./panels";
import {
  ActionScreen,
  EmptyState,
  Field,
  IconButton,
  RoomRow,
  SectionCard,
  Tabs,
  QuickActionGrid,
} from "./shared-ui";

export function LobbySurface({
  allRooms,
  createRoomPending,
  inviteCode,
  joinRoomPending,
  onCreateRoom,
  onInviteCodeChange,
  onJoinRoom,
  onRoomFormChange,
  onSelectRoom,
  roomForm,
}: {
  allRooms: Array<{ role: Role; room: HackRoom }>;
  createRoomPending: boolean;
  inviteCode: string;
  joinRoomPending: boolean;
  onCreateRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  onSelectRoom: (roomId: string) => void;
  roomForm: typeof emptyRoomForm;
}) {
  return (
    <section className="grid gap-3">
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
      <SectionCard eyebrow="Hack Rooms" title="Your Room Shelf" badge={`${allRooms.length} total`}>
        <div className="grid gap-2">
          {allRooms.length ? (
            allRooms.map((entry) => (
              <RoomRow
                key={entry.room._id}
                role={entry.role}
                room={entry.room}
                onClick={() => onSelectRoom(entry.room._id)}
              />
            ))
          ) : (
            <EmptyState
              icon={<NativeIcon name="home-outline" />}
              text="Create a hack room or join one with an invite code."
            />
          )}
        </div>
      </SectionCard>
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
  onExitRoom,
  onInviteCodeChange,
  onIssueReward,
  onJoinRoom,
  onReturnSubmission,
  onRewardFormChange,
  onRoomFormChange,
  onSelectTab,
  onSelectWinner,
  onShareInvite,
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
  onExitRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onIssueReward: (kind: RewardKind) => void;
  onJoinRoom: () => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRewardFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptyRewardForm>>>;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  onSelectTab: (tab: HostTab) => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareInvite: (room: HackRoom) => void;
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



      {activeTab === "assign" ? (
        <ActionScreen title="Assignments" >
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
        </ActionScreen>
      ) : null}

      {activeTab === "created" ? (
        <ActionScreen title="Created Tasks" >
          <CreatedTasks tasks={tasks} />
        </ActionScreen>
      ) : null}

      {activeTab === "members" ? (
        <ActionScreen title="Members" >
          <SectionCard badge={`${room?.participants.length ?? 0} joined`} eyebrow="Host Menu" title="Participants">
            {room ? (
              <>
                <div className="mb-3 flex items-center justify-between rounded-[9px] border border-[#1EEAB0] bg-[#0D0F12] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2 font-mono text-[13px] font-semibold text-[#1EEAB0]">
                    <NativeIcon className="size-4 shrink-0" name="key-outline" />
                    <span className="truncate">{room.inviteCode}</span>
                  </div>
                  <div className="flex gap-2">
                    <IconButton label="Copy invite" onClick={() => onCopyInvite(room)}>
                      <NativeIcon className="size-4" name="copy-outline" />
                    </IconButton>
                    <Button
                      className="h-8 rounded-[8px] border-[#1EEAB0] bg-[#061F18] text-xs font-semibold text-[#1EEAB0] hover:bg-[#061F18]/80"
                      onClick={() => onShareInvite(room)}
                      type="button"
                      variant="outline"
                    >
                      <NativeIcon className="size-3.5" name="share-outline" />
                      Share Invite
                    </Button>
                  </div>
                </div>
                <MemberList room={room} />
              </>
            ) : (
              <EmptyState icon={<NativeIcon name="people-outline" />} text="Create or select a hosted room first." />
            )}
          </SectionCard>
        </ActionScreen>
      ) : null}

      {activeTab === "verify" ? (
        <ActionScreen title="Verify" >
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
        <ActionScreen title="History" >
          <SubmissionList
            emptyText="Verified, returned, and winner records will appear here after review."
            submissions={historySubmissions}
            title="Verified Proof"
            tone="gold"
          />
        </ActionScreen>
      ) : null}

      {activeTab === "award" ? (
        <ActionScreen title="Award XRDM" >
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
        <ActionScreen title="Awards" >
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
        <ActionScreen title="Games" >
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
        <ActionScreen title="Leaderboard" >
          <LeaderboardPanel leaderboard={leaderboard} />
        </ActionScreen>
      ) : null}

      {activeTab === "profile" ? (
        <ActionScreen title="Profile" >
          <RoomProfile
            onExitRoom={onExitRoom}
            onShareInvite={onShareInvite}
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

  if (activeTab === "wallet") {
    return (
      <section>
        <WalletPanel myRewards={myRewards} mySubmissions={mySubmissions} ownerName={user.name} room={room} />
      </section>
    );
  }

  return (
    <section>
      <Tabs activeTab={activeTab} onSelect={onSelectTab} tabs={participantTabs} />



      {activeTab === "submit" ? (
        <ActionScreen title="Submit Task" >
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
        <ActionScreen title="History" >
          <ParticipantHistoryPanel mySubmissions={mySubmissions} tasks={tasks} />
        </ActionScreen>
      ) : null}

      {activeTab === "games" ? (
        <ActionScreen title="Games" >
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

    </section>
  );
}

export { HostSurface, ParticipantSurface };
