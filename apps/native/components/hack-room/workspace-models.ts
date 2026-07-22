import type React from "react";

import {
  emptySubmitForm,
  emptyTaskForm,
  type AssignmentMode,
  type DashboardData,
  type HackReward,
  type HackRoom,
  type HackSubmission,
  type HackTask,
  type ParticipantTab,
  type ProofType,
  type RewardFormsByKind,
  type RewardKind,
  type RoomTab,
  type TaskKind,
} from "@/components/hack-room/domain";

export type HostWorkspaceModel = {
  activeRoomTab: RoomTab | null;
  assignmentMode: AssignmentMode;
  approvedSubmissions: DashboardData["hostSubmissions"];
  approveSubmissionPending: boolean;
  awardBySubmission: Record<string, string>;
  createdTaskCardId: string;
  createTaskPending: boolean;
  feedbackBySubmission: Record<string, string>;
  historySubmissions: DashboardData["hostSubmissions"];
  issueRewardPending: boolean;
  onApproveSubmission: (submission: HackSubmission) => void;
  onClearCreatedTaskCard: () => void;
  onCopyInvite: (room: HackRoom) => void;
  onCreateTask: (kind: TaskKind) => void;
  onIssueReward: (kind: RewardKind) => void;
  onMiniGameSwitch: () => void;
  onReturnSubmission: (submission: HackSubmission) => void;
  onRoomTabChange: (tab: RoomTab | null) => void;
  onSendRoomNotification: () => void;
  onSelectWinner: (submission: HackSubmission) => void;
  onShareRoom: (room: HackRoom) => void;
  pendingApprovalSubmissionId: string;
  pendingRewardKind: RewardKind | null;
  pendingSubmissions: DashboardData["hostSubmissions"];
  pendingWinnerSubmissionId: string;
  proofTypes: Array<ProofType>;
  returnSubmissionPending: boolean;
  rewardForms: RewardFormsByKind;
  rewards: Array<HackReward>;
  room: HackRoom;
  roomTasks: DashboardData["tasks"];
  selectWinnerPending: boolean;
  selectedTaskId: string;
  sendRoomNotificationPending: boolean;
  setAwardBySubmission: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setAssignmentMode: React.Dispatch<React.SetStateAction<AssignmentMode>>;
  setFeedbackBySubmission: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setProofTypes: React.Dispatch<React.SetStateAction<Array<ProofType>>>;
  setRewardForms: React.Dispatch<React.SetStateAction<RewardFormsByKind>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  setTaskKind: React.Dispatch<React.SetStateAction<TaskKind>>;
  taskForm: typeof emptyTaskForm;
  taskKind: TaskKind;
  winnerSubmissions: DashboardData["hostSubmissions"];
};

export type ParticipantWorkspaceModel = {
  activeParticipantTab: ParticipantTab | null;
  mySubmissions: DashboardData["mySubmissions"];
  onMiniGameSwitch: () => void;
  onParticipantTabChange: (tab: ParticipantTab | null) => void;
  onSelectTask: (taskId: string) => void;
  onSubmitProof: () => void;
  rewards: Array<HackReward>;
  roomTasks: DashboardData["tasks"];
  roomWinners: DashboardData["visibleWinners"];
  selectedTask?: HackTask;
  selectedTaskId: string;
  setSubmitForm: React.Dispatch<React.SetStateAction<typeof emptySubmitForm>>;
  submitForm: typeof emptySubmitForm;
  submitProofPending: boolean;
};
