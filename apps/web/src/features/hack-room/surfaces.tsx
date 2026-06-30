import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import type * as React from "react";

import { NativeIcon } from "@/lib/native-icons";

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
} from "./shared-ui";

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
                <EmptyState icon={<NativeIcon name="shield-outline" />} text="Create a hack room to unlock host actions." />
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
                    <NativeIcon className="size-4 shrink-0" name="key-outline" />
                    <span className="truncate">{room.inviteCode}</span>
                  </div>
                  <div className="flex gap-2">
                    <IconButton label="Copy invite" onClick={() => onCopyInvite(room)}>
                      <NativeIcon className="size-4" name="copy-outline" />
                    </IconButton>
                    <Button
                      className="h-8 rounded-[8px] border-[#1EEAB0] bg-[#061F18] text-[11px] text-[#1EEAB0] hover:bg-[#061F18]/80"
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
                <NativeIcon className="size-4" name="enter-outline" />
                Join Room
              </Button>
            </form>
            <div className="mt-3 grid gap-2">
              {joinedRooms.length ? (
                joinedRooms.map((joinedRoom) => (
                  <RoomRow key={joinedRoom._id} room={joinedRoom} role="participant" />
                ))
              ) : (
                <EmptyState icon={<NativeIcon name="key-outline" />} text="Paste the invite code from your organizer." />
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

export { HostSurface, ParticipantSurface };
