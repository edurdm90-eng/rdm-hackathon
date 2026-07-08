import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import { useState } from "react";
import type * as React from "react";

import { NativeIcon } from "@/lib/native-icons";

import {
  buildProofItemsForTask,
  defaultRegularProofTypes,
  emptyRoomForm,
  emptyTaskForm,
  gameTypeOptions,
  getMinimumDueAtInputValue,
  getSubmissionProofItems,
  getTaskProofTypes,
  hasRequiredProofItems,
  isFutureDueAt,
  isEmailLike,
  makeEmptySubmitForm,
  minAssignmentDescriptionLength,
  minNotificationMessageLength,
  normalizeTaskProofTypes,
  proofTypeIcon,
  proofTypeLabel,
  proofTypeOptions,
  proofTypePlaceholder,
  type AssignmentMode,
  type DashboardData,
  type HackRoom,
  type HackTask,
  type ProofType,
  type SessionUser,
} from "./model";
import { ProofRequirementFields, TeamMateEmailComposer } from "./panels";
import {
  Badge,
  ChipButton,
  EmptyState,
  Field,
  ProofItemsList,
  SectionCard,
  StatusBanner,
  SubmissionHoldCard,
  TaskCard,
  TaskKindButton,
  TextArea,
} from "./shared-ui";

function RoomCommandCenter({
  createRoomPending,
  inviteCode,
  joinRoomPending,
  onCreateRoom,
  onInviteCodeChange,
  onJoinRoom,
  onRoomFormChange,
  roomForm,
  tone: _tone,
}: {
  createRoomPending: boolean;
  inviteCode: string;
  joinRoomPending: boolean;
  onCreateRoom: () => void;
  onInviteCodeChange: (value: string) => void;
  onJoinRoom: () => void;
  onRoomFormChange: React.Dispatch<React.SetStateAction<typeof emptyRoomForm>>;
  roomForm: typeof emptyRoomForm;
  tone: "cyan" | "violet";
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <SectionCard badge="Invite Only" eyebrow="Lobby" title="Join Hack Room">
      <div className="grid gap-3">
        <form
          className="grid gap-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onJoinRoom();
          }}
        >
          <Field label="Invite Code">
            <Input
              className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#141618] font-mono text-[13px] uppercase text-[#EEE8DE] placeholder:text-[#626058] focus-visible:border-[#1EEAB0]"
              onChange={(event) => onInviteCodeChange(event.target.value)}
              placeholder="HR-ABC123"
              value={inviteCode}
            />
          </Field>
          <Button
            className="h-10 self-end rounded-[9px] bg-[#1EEAB0] px-4 text-[#03120C] hover:bg-[#1EEAB0]/85"
            disabled={!inviteCode.trim() || joinRoomPending}
            type="submit"
          >
            <NativeIcon className="size-4" name="enter-outline" />
            Join
          </Button>
        </form>

        <button
          className="flex min-h-10 items-center justify-center gap-2 rounded-[9px] border border-[#4A1A90] bg-[#160A2A] px-3 text-xs font-extrabold text-[#A060FF] transition hover:bg-[#160A2A]/80"
          onClick={() => setCreateOpen((open) => !open)}
          type="button"
        >
          <NativeIcon className="size-4" name="add-outline" />
          {createOpen ? "Hide Create Room" : "Create Hack Room"}
        </button>

        {createOpen ? (
          <form
            className="grid gap-3 rounded-[11px] border border-[#4A1A90] bg-[#160A2A] p-3"
            onSubmit={(event) => {
              event.preventDefault();
              onCreateRoom();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#A060FF]">
                  Host
                </div>
                <div className="mt-0.5 text-[13px] font-extrabold text-[#EEE8DE]">Create Hack Room</div>
              </div>
              <Badge tone="violet">Host Owns Room</Badge>
            </div>

            <Field label="Room Name">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#EEE8DE] placeholder:text-[#626058] focus-visible:border-[#A060FF]"
                onChange={(event) => onRoomFormChange((current) => ({ ...current, name: event.target.value }))}
                placeholder="AI Agents Sprint"
                value={roomForm.name}
              />
            </Field>
            <Field label="Room Brief">
              <TextArea
                onChange={(value) => onRoomFormChange((current) => ({ ...current, description: value }))}
                placeholder="Participants build and submit working demos by deadline."
                value={roomForm.description}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                className="h-10 rounded-[9px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
                onClick={() => setCreateOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="h-10 rounded-[9px] bg-[#A060FF] text-[#060214] hover:bg-[#A060FF]/85"
                disabled={!roomForm.name.trim() || createRoomPending}
                type="submit"
              >
                <NativeIcon className="size-4" name="add-outline" />
                Create Room
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </SectionCard>
  );
}

function AssignmentComposer({
  assignmentMode,
  createTaskPending,
  onAssignmentModeChange,
  onCreateTask,
  proofTypes,
  room,
  sendNotificationPending,
  setProofTypes,
  setTaskForm,
  taskForm,
}: {
  assignmentMode: AssignmentMode;
  createTaskPending: boolean;
  onAssignmentModeChange: (mode: AssignmentMode) => void;
  onCreateTask: () => void;
  proofTypes: ProofType[];
  room?: HackRoom;
  sendNotificationPending: boolean;
  setProofTypes: React.Dispatch<React.SetStateAction<ProofType[]>>;
  setTaskForm: React.Dispatch<React.SetStateAction<typeof emptyTaskForm>>;
  taskForm: typeof emptyTaskForm;
}) {
  const isNotification = assignmentMode === "notification";
  const isSpecial = assignmentMode === "special";
  const isGame = assignmentMode === "game";
  const effectiveProofTypes = isNotification ? [] : normalizeTaskProofTypes(assignmentMode, proofTypes);
  const descriptionLength = taskForm.description.trim().length;
  const dueAtError =
    !isNotification && taskForm.dueAt.trim() && !isFutureDueAt(taskForm.dueAt)
      ? "Choose a future due date and time."
      : "";
  const minimumDescriptionLength = isNotification
    ? minNotificationMessageLength
    : minAssignmentDescriptionLength;
  const canSubmit =
    room &&
    taskForm.title.trim().length >= 3 &&
    descriptionLength >= minimumDescriptionLength &&
    (isNotification || taskForm.dueAt.trim()) &&
    !dueAtError &&
    (!isSpecial || taskForm.assignedToEmail.trim()) &&
    !createTaskPending &&
    !sendNotificationPending;

  return (
    <SectionCard
      badge={isSpecial ? "One participant" : isNotification ? "Room nudge" : "All Participants"}
      eyebrow="Organizer Track"
      title={isNotification ? "Send Notification" : "Create Assignment"}
    >
      <div className="mb-3 grid grid-cols-2 gap-[7px]">
        <TaskKindButton
          active={assignmentMode === "task"}
          icon={<NativeIcon className="size-4" name="clipboard-outline" />}
          label="Regular Task"
          onClick={() => onAssignmentModeChange("task")}
          tone="cyan"
        />
        <TaskKindButton
          active={assignmentMode === "challenge"}
          icon={<NativeIcon className="size-4" name="flash-outline" />}
          label="Spot Challenge"
          onClick={() => onAssignmentModeChange("challenge")}
          tone="cyan"
        />
        <TaskKindButton
          active={assignmentMode === "special"}
          icon={<NativeIcon className="size-4" name="star-outline" />}
          label="Special Task"
          onClick={() => onAssignmentModeChange("special")}
          tone="orange"
        />
        <TaskKindButton
          active={assignmentMode === "notification"}
          icon={<NativeIcon className="size-4" name="notifications-outline" />}
          label="Notification"
          onClick={() => onAssignmentModeChange("notification")}
          tone="violet"
        />
      </div>

      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onCreateTask();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={isNotification ? "Notification Title" : isGame ? "Game Name" : "Assignment Title"}>
            <Input
              className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#CCC6BA]"
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={isNotification ? "Demo check-in" : "Build a working prototype"}
              value={taskForm.title}
            />
          </Field>
          {!isNotification ? (
            <Field label="Due Date and Time">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#CCC6BA]"
                min={getMinimumDueAtInputValue()}
                onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))}
                type="datetime-local"
                value={taskForm.dueAt}
              />
              {dueAtError ? <p className="text-xs leading-5 text-[#FF5A4A]">{dueAtError}</p> : null}
            </Field>
          ) : (
            <Field label="Audience">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#626058]"
                disabled
                value={`${room?.participants.length ?? 0} participants`}
              />
            </Field>
          )}
        </div>

        {isSpecial ? (
          <Field label="Participant Email">
            <Input
              className="h-10 rounded-[9px] border-[#FF8820] bg-[#241000] text-[13px] text-[#FF8820]"
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, assignedToEmail: event.target.value }))
              }
              placeholder="student@example.com"
              value={taskForm.assignedToEmail}
            />
          </Field>
        ) : null}

        {isGame ? (
          <Field label="Game Type">
            <div className="grid gap-2 sm:grid-cols-3">
              {gameTypeOptions.map((option) => {
                const Icon = option.icon;
                const active = taskForm.gameType === option.value;
                return (
                  <button
                    className={`rounded-[9px] border px-3 py-2 text-left text-xs font-semibold transition ${
                      active
                        ? "border-[#F0C040] bg-[#241A00] text-[#F0C040]"
                        : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690]"
                    }`}
                    key={option.value}
                    onClick={() => setTaskForm((current) => ({ ...current, gameType: option.value }))}
                    type="button"
                  >
                    <Icon className="mb-2 size-4" />
                    <span className="block font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}

        <Field label={isNotification ? "Message" : "Description"}>
          <TextArea
            onChange={(value) => setTaskForm((current) => ({ ...current, description: value }))}
            placeholder={
              isNotification
                ? "Share a reminder, deadline update, or room-wide nudge."
                : "Submit a functional demo. GitHub and Drive proof are mandatory."
            }
            value={taskForm.description}
          />
          <p
            className={`text-[11px] ${
              descriptionLength && descriptionLength < minimumDescriptionLength
                ? "text-[#FF5A4A]"
                : "text-[#626058]"
            }`}
          >
            {descriptionLength}/{minimumDescriptionLength} characters minimum
          </p>
        </Field>

        {!isNotification ? (
          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="Expected Proof">
              <div className="flex flex-wrap gap-2">
                {proofTypeOptions
                  .filter((option) => (isGame ? option.value === "game_score" : option.value !== "game_score"))
                  .map((option) => {
                    const locked = assignmentMode === "task" && defaultRegularProofTypes.includes(option.value);
                    const active = effectiveProofTypes.includes(option.value);
                    return (
                      <button
                        className={`rounded-[7px] border px-3 py-1.5 font-mono text-[10px] uppercase transition ${
                          active
                            ? "border-[#1EEAB0] bg-[#061F18] text-[#1EEAB0]"
                            : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#626058]"
                        } ${locked ? "cursor-default" : ""}`}
                        disabled={locked || isGame}
                        key={option.value}
                        onClick={() =>
                          setProofTypes((current) =>
                            current.includes(option.value)
                              ? current.filter((item) => item !== option.value)
                              : [...current, option.value],
                          )
                        }
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
              </div>
            </Field>
            <Field label="XRDM Reward">
              <Input
                className="h-10 rounded-[9px] border-[#F0C040] bg-[#241A00] font-mono text-[13px] text-[#F0C040]"
                min={0}
                onChange={(event) => setTaskForm((current) => ({ ...current, rewardXrdm: event.target.value }))}
                type="number"
                value={taskForm.rewardXrdm}
              />
            </Field>
          </div>
        ) : null}

        <Button
          className="h-11 rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
          disabled={!canSubmit}
          type="submit"
        >
          {isNotification ? (
            <NativeIcon className="size-4" name="notifications-outline" />
          ) : (
            <NativeIcon className="size-4" name="send-outline" />
          )}
          {isNotification ? "Send Notification" : "Create Assignment"}
        </Button>
      </form>
    </SectionCard>
  );
}

function ParticipantSubmitPanel({
  mySubmissions,
  onSelectTask,
  onSubmitFormChange,
  onSubmitProof,
  selectedSubmission,
  selectedTask,
  selectedTaskId,
  submitForm,
  submitProofPending,
  tasks,
  user,
}: {
  mySubmissions: DashboardData["mySubmissions"];
  onSelectTask: (taskId: string) => void;
  onSubmitFormChange: React.Dispatch<React.SetStateAction<ReturnType<typeof makeEmptySubmitForm>>>;
  onSubmitProof: () => void;
  selectedSubmission?: DashboardData["mySubmissions"][number];
  selectedTask?: HackTask;
  selectedTaskId: string;
  submitForm: ReturnType<typeof makeEmptySubmitForm>;
  submitProofPending: boolean;
  tasks: HackTask[];
  user: SessionUser;
}) {
  const canSubmit =
    selectedTask &&
    submitForm.submitterName.trim() &&
    submitForm.teamName.trim() &&
    submitForm.description.trim() &&
    hasRequiredProofItems(selectedTask, submitForm) &&
    !submitProofPending;
  const canShowForm = !selectedSubmission || selectedSubmission.status === "returned";

  return (
    <SectionCard badge={`${tasks.length} tasks`} eyebrow="Participant" title="Submit Task">
      <div className="mb-3 grid gap-2">
        {tasks.length ? (
          tasks.map((task) => {
            const submission = mySubmissions.find((item) => item.taskId === task._id);
            return (
              <TaskCard
                key={task._id}
                onSelect={() => onSelectTask(task._id)}
                selected={selectedTaskId === task._id}
                status={submission?.status}
                task={task}
              />
            );
          })
        ) : (
          <EmptyState icon={<NativeIcon name="clipboard-outline" />} text="The host has not assigned work yet." />
        )}
      </div>

      {selectedSubmission?.status === "returned" ? (
        <StatusBanner
          message={selectedSubmission.hostFeedback || "Proof returned. Update the fields and resubmit."}
          tone="red"
        />
      ) : null}

      {!canShowForm && selectedSubmission ? (
        <SubmissionHoldCard submission={selectedSubmission} />
      ) : (
        <form
          className="grid gap-3 rounded-[11px] border border-[#1EEAB0] bg-[#0D0F12] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmitProof();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#1EEAB0]">
                Submit Proof
              </div>
              <div className="mt-1 text-[13px] font-semibold text-[#EEE8DE]">
                {selectedTask?.title ?? "Select an assignment"}
              </div>
            </div>
            {selectedTask ? <Badge tone="gold">+{selectedTask.rewardXrdm} XRDM</Badge> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your Name">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#061F18] text-[13px] text-[#EEE8DE]"
                onChange={(event) =>
                  onSubmitFormChange((current) => ({ ...current, submitterName: event.target.value }))
                }
                placeholder={user.name}
                value={submitForm.submitterName}
              />
            </Field>
            <Field label="Team Name">
              <Input
                className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#061F18] text-[13px] text-[#EEE8DE]"
                onChange={(event) =>
                  onSubmitFormChange((current) => ({ ...current, teamName: event.target.value }))
                }
                placeholder="Team XRDM"
                value={submitForm.teamName}
              />
            </Field>
          </div>
          <TeamMateEmailComposer setSubmitForm={onSubmitFormChange} submitForm={submitForm} />
          <Field label="Description">
            <TextArea
              onChange={(value) => onSubmitFormChange((current) => ({ ...current, description: value }))}
              placeholder="Summarize what your team built, changed, or completed."
              value={submitForm.description}
            />
          </Field>
          <ProofRequirementFields
            selectedTask={selectedTask}
            setSubmitForm={onSubmitFormChange}
            submitForm={submitForm}
          />
          <Field label="Note to Host">
            <TextArea
              onChange={(value) => onSubmitFormChange((current) => ({ ...current, notes: value }))}
              placeholder="Mention branch, demo timestamp, game result, or implementation notes."
              value={submitForm.notes}
            />
          </Field>
          <Button
            className="h-11 w-full rounded-[10px] bg-[#1EEAB0] text-[#03120C] hover:bg-[#1EEAB0]/85"
            disabled={!canSubmit}
            type="submit"
          >
            <NativeIcon className="size-4" name="send-outline" />
            {selectedTask?.kind === "game" ? "Submit Game Proof" : "Submit Proof"}
          </Button>
        </form>
      )}
    </SectionCard>
  );
}

export { AssignmentComposer, ParticipantSubmitPanel, RoomCommandCenter };
