import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import { Label } from "@rdm-hack/ui/components/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Crown,
  DoorOpen,
  KeyRound,
  LinkIcon,
  Plus,
  Send,
  Shield,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { queryClient, trpc } from "@/utils/trpc";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

type ProofType = "github" | "drive" | "file" | "url" | "video" | "deck";
type Role = "participant" | "host";

const proofTypeOptions: Array<{ value: ProofType; label: string }> = [
  { value: "github", label: "GitHub" },
  { value: "drive", label: "Drive" },
  { value: "video", label: "Video" },
  { value: "deck", label: "Deck" },
  { value: "file", label: "File" },
  { value: "url", label: "URL" },
];

const emptyRoomForm = {
  name: "",
  description: "",
};

const emptyTaskForm = {
  title: "",
  description: "",
  dueAt: "",
  rewardXrdm: "20",
};

const emptySubmitForm = {
  proofUrl: "",
  notes: "",
};

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const userName = session.data?.user.name ?? "Hacker";
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());

  const [role, setRole] = useState<Role>("participant");
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [taskRoomId, setTaskRoomId] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [proofTypes, setProofTypes] = useState<Array<ProofType>>(["github", "video"]);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [submitForm, setSubmitForm] = useState(emptySubmitForm);
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
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setTaskRoomId(room._id);
        toast.success(`Hack room created: ${room.inviteCode}`);
        await invalidateDashboard();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const joinRoom = useMutation(
    trpc.hackRoom.joinRoom.mutationOptions({
      onSuccess: async (room) => {
        setInviteCode("");
        setRole("participant");
        toast.success(`Joined ${room.name}`);
        await invalidateDashboard();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const createTask = useMutation(
    trpc.hackRoom.createTask.mutationOptions({
      onSuccess: async () => {
        setTaskForm(emptyTaskForm);
        setProofTypes(["github", "video"]);
        toast.success("Task published to the hack room");
        await invalidateDashboard();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const submitProof = useMutation(
    trpc.hackRoom.submitProof.mutationOptions({
      onSuccess: async () => {
        setSubmitForm(emptySubmitForm);
        toast.success("Proof submitted for host review");
        await invalidateDashboard();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const selectWinner = useMutation(
    trpc.hackRoom.selectWinner.mutationOptions({
      onSuccess: async () => {
        toast.success("Winner selected and proof marked");
        await invalidateDashboard();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const returnSubmission = useMutation(
    trpc.hackRoom.returnSubmission.mutationOptions({
      onSuccess: async () => {
        toast.success("Submission returned with feedback");
        await invalidateDashboard();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const toggleProofType = (proofType: ProofType) => {
    setProofTypes((current) => {
      if (current.includes(proofType)) {
        return current.length === 1 ? current : current.filter((item) => item !== proofType);
      }
      return [...current, proofType];
    });
  };

  const copyInviteCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  return (
    <main className="min-h-full overflow-auto bg-[#0a0c0f] text-[#eee8de]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <section className="grid gap-4 border border-white/10 bg-[#101318] p-4 md:grid-cols-[1.35fr_.65fr]">
          <div className="flex flex-col gap-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#1eeab0]">
                XRDM Corporate · Hack Room
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#f4efe7] md:text-4xl">
                Build, submit, verify, and pick winners.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9c9690]">
                Welcome back, {userName}. Host rooms with invite codes or join as a participant to
                submit verifiable hackathon proof.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <MetricCard label="Hosted Rooms" value={dashboard.data?.stats.activeRooms ?? 0} tone="violet" />
              <MetricCard label="Joined Rooms" value={dashboard.data?.stats.joinedRooms ?? 0} tone="cyan" />
              <MetricCard
                label="Pending Reviews"
                value={dashboard.data?.stats.pendingSubmissions ?? 0}
                tone="gold"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 border border-white/10 bg-[#0d0f12] p-3">
            <div className="grid grid-cols-2 gap-2">
              <RoleButton
                active={role === "participant"}
                description="Join rooms and submit proof"
                icon={<DoorOpen />}
                label="Participant"
                onClick={() => setRole("participant")}
                tone="cyan"
              />
              <RoleButton
                active={role === "host"}
                description="Create tasks and pick winners"
                icon={<Shield />}
                label="Host"
                onClick={() => setRole("host")}
                tone="violet"
              />
            </div>
            <div className="border border-[#8a6a00]/50 bg-[#241a00]/70 p-3 text-xs leading-5 text-[#f0c040]">
              Proof status becomes a durable participation record once a host reviews a submission.
            </div>
          </div>
        </section>

        {role === "participant" ? (
          <section className="grid gap-5 lg:grid-cols-[.78fr_1.22fr]">
            <Panel
              action={
                joinedRooms.length ? (
                  <span className="font-mono text-[10px] text-[#1eeab0]">
                    {joinedRooms.length} active
                  </span>
                ) : null
              }
              eyebrow="Participant Track"
              icon={<KeyRound />}
              title="Join a Hack Room"
              tone="cyan"
            >
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  joinRoom.mutate({ inviteCode });
                }}
              >
                <Field label="Invite code">
                  <Input
                    className="h-10 border-[#0b8060] bg-[#061f18] font-mono text-sm uppercase text-[#1eeab0] placeholder:text-[#0b8060]"
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="HR-ABC123"
                    value={inviteCode}
                  />
                </Field>
                <Button
                  className="h-10 bg-[#1eeab0] text-[#03120c] hover:bg-[#1eeab0]/85"
                  disabled={!inviteCode.trim() || joinRoom.isPending}
                  type="submit"
                >
                  <DoorOpen />
                  Join Room
                </Button>
              </form>

              <div className="mt-4 grid gap-2">
                {joinedRooms.length ? (
                  joinedRooms.map((room) => (
                    <RoomStrip key={room._id} room={room} role="participant" />
                  ))
                ) : (
                  <EmptyState
                    icon={<DoorOpen />}
                    text="Paste an invite code from your hackathon host to unlock assignments."
                  />
                )}
              </div>
            </Panel>

            <Panel
              action={
                <span className="font-mono text-[10px] text-[#9c9690]">
                  {participantTasks.length} tasks
                </span>
              }
              eyebrow="My Work"
              icon={<ClipboardList />}
              title="Assignments and Proof"
              tone="cyan"
            >
              <div className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
                <div className="grid gap-3">
                  {participantTasks.length ? (
                    participantTasks.map((task) => {
                      const submission = mySubmissions.find(
                        (item) => item.taskId === task._id,
                      );
                      return (
                        <button
                          className={`border p-3 text-left transition ${
                            selectedTaskId === task._id
                              ? "border-[#1eeab0] bg-[#061f18]"
                              : "border-white/10 bg-[#141618] hover:border-[#0b8060]"
                          }`}
                          key={task._id}
                          onClick={() => setSelectedTaskId(task._id)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[#f4efe7]">
                                {task.title}
                              </div>
                              <div className="mt-1 font-mono text-[10px] text-[#626058]">
                                {task.roomName} · Due {task.dueAt}
                              </div>
                            </div>
                            <Badge tone={submission ? submission.status : "gold"}>
                              {submission ? submission.status : `+${task.rewardXrdm} XRDM`}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#9c9690]">
                            {task.description}
                          </p>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState
                      icon={<ClipboardList />}
                      text="No assignments yet. Join a room or wait for your host to publish one."
                    />
                  )}
                </div>

                <form
                  className="border border-[#0b8060]/70 bg-[#061f18] p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!selectedTask) {
                      toast.error("Choose an assignment first");
                      return;
                    }
                    submitProof.mutate({
                      roomId: selectedTask.roomId,
                      taskId: selectedTask._id,
                      proofUrl: submitForm.proofUrl,
                      notes: submitForm.notes,
                    });
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0b8060]">
                        Submit Proof
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[#1eeab0]">
                        {selectedTask?.title ?? "Select an assignment"}
                      </div>
                    </div>
                    {selectedTask ? <Badge tone="gold">+{selectedTask.rewardXrdm} XRDM</Badge> : null}
                  </div>
                  <div className="grid gap-3">
                    <Field label="Proof link">
                      <Input
                        className="h-10 border-[#0b8060] bg-[#0c1610] text-sm text-[#eee8de]"
                        onChange={(event) =>
                          setSubmitForm((current) => ({
                            ...current,
                            proofUrl: event.target.value,
                          }))
                        }
                        placeholder="https://github.com/team/project"
                        value={submitForm.proofUrl}
                      />
                    </Field>
                    <Field label="Note to host">
                      <textarea
                        className="min-h-24 w-full resize-none border border-[#0b8060] bg-[#0c1610] p-3 text-sm leading-6 text-[#eee8de] outline-none placeholder:text-[#626058] focus:border-[#1eeab0]"
                        onChange={(event) =>
                          setSubmitForm((current) => ({ ...current, notes: event.target.value }))
                        }
                        placeholder="Mention demo timestamp, repo branch, or implementation notes."
                        value={submitForm.notes}
                      />
                    </Field>
                    <Button
                      className="h-10 bg-[#1eeab0] text-[#03120c] hover:bg-[#1eeab0]/85"
                      disabled={!selectedTask || !submitForm.proofUrl.trim() || submitProof.isPending}
                      type="submit"
                    >
                      <Send />
                      Submit for Review
                    </Button>
                  </div>
                </form>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#626058]">
                  My Participation Proof
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {mySubmissions.length ? (
                    mySubmissions.map((submission) => (
                      <ProofCard key={submission._id} submission={submission} />
                    ))
                  ) : (
                    <EmptyState
                      icon={<CheckCircle2 />}
                      text="Submitted proof will appear here as your participation record."
                    />
                  )}
                </div>
              </div>
            </Panel>
          </section>
        ) : (
          <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
            <div className="grid gap-5">
              <Panel
                action={
                  hostedRooms.length ? (
                    <span className="font-mono text-[10px] text-[#a060ff]">
                      {hostedRooms.length} hosted
                    </span>
                  ) : null
                }
                eyebrow="Organizer Track"
                icon={<Plus />}
                title="Create Hack Room"
                tone="violet"
              >
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createRoom.mutate(roomForm);
                  }}
                >
                  <Field label="Room name">
                    <Input
                      className="h-10 border-[#4a1a90] bg-[#160a2a] text-sm text-[#eee8de]"
                      onChange={(event) =>
                        setRoomForm((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="AI Agents Sprint"
                      value={roomForm.name}
                    />
                  </Field>
                  <Field label="Room brief">
                    <textarea
                      className="min-h-20 w-full resize-none border border-[#4a1a90] bg-[#160a2a] p-3 text-sm leading-6 text-[#eee8de] outline-none placeholder:text-[#626058] focus:border-[#a060ff]"
                      onChange={(event) =>
                        setRoomForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Participants build and submit working demos by deadline."
                      value={roomForm.description}
                    />
                  </Field>
                  <Button
                    className="h-10 bg-[#a060ff] text-[#060214] hover:bg-[#a060ff]/85"
                    disabled={!roomForm.name.trim() || createRoom.isPending}
                    type="submit"
                  >
                    <Plus />
                    Create Room
                  </Button>
                </form>

                <div className="mt-4 grid gap-2">
                  {hostedRooms.length ? (
                    hostedRooms.map((room) => (
                      <div className="border border-white/10 bg-[#141618] p-3" key={room._id}>
                        <RoomStrip room={room} role="host" />
                        <div className="mt-3 flex items-center gap-2 border border-[#4a1a90] bg-[#160a2a] p-2">
                          <KeyRound className="size-4 text-[#a060ff]" />
                          <span className="flex-1 font-mono text-xs text-[#a060ff]">
                            {room.inviteCode}
                          </span>
                          <Button
                            className="h-7 border-[#4a1a90] bg-transparent text-[#a060ff]"
                            onClick={() => copyInviteCode(room.inviteCode)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Copy />
                            Copy
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={<Shield />} text="Create a room to get a shareable invite code." />
                  )}
                </div>
              </Panel>

              <Panel eyebrow="Awards" icon={<Trophy />} title="Winners Picked" tone="gold">
                <div className="grid gap-2">
                  {winnerSubmissions.length ? (
                    winnerSubmissions.map((submission) => (
                      <ProofCard key={submission._id} submission={submission} />
                    ))
                  ) : (
                    <EmptyState
                      icon={<Trophy />}
                      text="Selected winners will appear here with awarded XRDM."
                    />
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-5">
              <Panel
                action={
                  hostedRooms.length ? (
                    <select
                      className="border border-[#4a1a90] bg-[#160a2a] px-2 py-1 font-mono text-[10px] text-[#a060ff] outline-none"
                      onChange={(event) => setTaskRoomId(event.target.value)}
                      value={taskRoomId}
                    >
                      {hostedRooms.map((room) => (
                        <option key={room._id} value={room._id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  ) : null
                }
                eyebrow="Assignment"
                icon={<ClipboardList />}
                title="Set Task for Participants"
                tone="violet"
              >
                <form
                  className="grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!taskRoomId) {
                      toast.error("Create a room first");
                      return;
                    }
                    createTask.mutate({
                      roomId: taskRoomId,
                      title: taskForm.title,
                      description: taskForm.description,
                      dueAt: taskForm.dueAt,
                      rewardXrdm: Number(taskForm.rewardXrdm),
                      proofTypes,
                    });
                  }}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Task title">
                      <Input
                        className="h-10 border-[#4a1a90] bg-[#100c1c] text-sm text-[#eee8de]"
                        onChange={(event) =>
                          setTaskForm((current) => ({ ...current, title: event.target.value }))
                        }
                        placeholder="Build a working prototype"
                        value={taskForm.title}
                      />
                    </Field>
                    <Field label="Due date">
                      <Input
                        className="h-10 border-[#4a1a90] bg-[#100c1c] text-sm text-[#eee8de]"
                        onChange={(event) =>
                          setTaskForm((current) => ({ ...current, dueAt: event.target.value }))
                        }
                        placeholder="Tonight · 9:00 PM"
                        value={taskForm.dueAt}
                      />
                    </Field>
                  </div>
                  <Field label="Task brief">
                    <textarea
                      className="min-h-24 w-full resize-none border border-[#4a1a90] bg-[#100c1c] p-3 text-sm leading-6 text-[#eee8de] outline-none placeholder:text-[#626058] focus:border-[#a060ff]"
                      onChange={(event) =>
                        setTaskForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Submit a demo link, repo, and notes showing the core feature."
                      value={taskForm.description}
                    />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <Field label="Expected proof">
                      <div className="flex flex-wrap gap-2">
                        {proofTypeOptions.map((option) => (
                          <button
                            className={`border px-3 py-2 font-mono text-[10px] transition ${
                              proofTypes.includes(option.value)
                                ? "border-[#a060ff] bg-[#160a2a] text-[#a060ff]"
                                : "border-white/10 bg-[#141618] text-[#626058]"
                            }`}
                            key={option.value}
                            onClick={() => toggleProofType(option.value)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="XRDM reward">
                      <Input
                        className="h-10 w-28 border-[#8a6a00] bg-[#241a00] font-mono text-sm text-[#f0c040]"
                        min="0"
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            rewardXrdm: event.target.value,
                          }))
                        }
                        type="number"
                        value={taskForm.rewardXrdm}
                      />
                    </Field>
                  </div>
                  <Button
                    className="h-10 bg-[#a060ff] text-[#060214] hover:bg-[#a060ff]/85"
                    disabled={
                      !taskRoomId ||
                      !taskForm.title.trim() ||
                      !taskForm.description.trim() ||
                      !taskForm.dueAt.trim() ||
                      createTask.isPending
                    }
                    type="submit"
                  >
                    <Send />
                    Publish Task
                  </Button>
                </form>
              </Panel>

              <Panel
                action={
                  <span className="font-mono text-[10px] text-[#ff8820]">
                    {pendingHostSubmissions.length} pending
                  </span>
                }
                eyebrow="Verification"
                icon={<Crown />}
                title="Review Submissions and Pick Winners"
                tone="violet"
              >
                <div className="grid gap-3">
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
                        <article
                          className="border border-white/10 bg-[#141618] p-3"
                          key={submission._id}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="grid size-8 place-items-center border border-[#0b8060] bg-[#061f18] font-mono text-[10px] text-[#1eeab0]">
                                  {getInitials(submission.participantName)}
                                </span>
                                <div>
                                  <div className="text-sm font-semibold text-[#f4efe7]">
                                    {submission.participantName}
                                  </div>
                                  <div className="font-mono text-[10px] text-[#626058]">
                                    {submission.roomName} · {submission.taskTitle}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <Badge tone={submission.status}>{submission.status}</Badge>
                          </div>

                          <a
                            className="mt-3 flex items-center gap-2 border border-[#0b8060] bg-[#061f18] p-2 font-mono text-xs text-[#1eeab0]"
                            href={submission.proofUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <LinkIcon className="size-4" />
                            <span className="min-w-0 flex-1 truncate">{submission.proofUrl}</span>
                          </a>

                          {submission.notes ? (
                            <p className="mt-2 text-xs leading-5 text-[#9c9690]">{submission.notes}</p>
                          ) : null}

                          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px]">
                            <textarea
                              className="min-h-20 resize-none border border-[#4a1a90] bg-[#100c1c] p-3 text-xs leading-5 text-[#eee8de] outline-none focus:border-[#a060ff]"
                              onChange={(event) =>
                                setFeedbackBySubmission((current) => ({
                                  ...current,
                                  [submission._id]: event.target.value,
                                }))
                              }
                              value={feedback}
                            />
                            <div className="grid gap-2">
                              <Input
                                className="h-10 border-[#8a6a00] bg-[#241a00] font-mono text-sm text-[#f0c040]"
                                onChange={(event) =>
                                  setAwardBySubmission((current) => ({
                                    ...current,
                                    [submission._id]: event.target.value,
                                  }))
                                }
                                type="number"
                                value={award}
                              />
                              <div className="font-mono text-[10px] text-[#8a6a00]">XRDM award</div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <Button
                              className="h-9 border-[#901e14] bg-[#280a08] text-[#ff5a4a] hover:bg-[#280a08]/80"
                              disabled={returnSubmission.isPending}
                              onClick={() =>
                                returnSubmission.mutate({
                                  submissionId: submission._id,
                                  hostFeedback: feedback,
                                })
                              }
                              type="button"
                              variant="outline"
                            >
                              Return with Feedback
                            </Button>
                            <Button
                              className="h-9 bg-[#f0c040] text-[#120d00] hover:bg-[#f0c040]/85"
                              disabled={selectWinner.isPending}
                              onClick={() =>
                                selectWinner.mutate({
                                  submissionId: submission._id,
                                  hostFeedback: feedback,
                                  awardXrdm: Number(award),
                                })
                              }
                              type="button"
                            >
                              <Crown />
                              Pick Winner
                            </Button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <EmptyState
                      icon={<Crown />}
                      text="Submissions from participants will appear here for review."
                    />
                  )}
                </div>
              </Panel>
            </div>
          </section>
        )}
      </div>
    </main>
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
  icon: React.ReactNode;
  title: string;
  tone: "cyan" | "violet" | "gold";
}) {
  const toneClasses = {
    cyan: "text-[#1eeab0] border-[#0b8060]/70 bg-[#061f18]/30",
    violet: "text-[#a060ff] border-[#4a1a90]/70 bg-[#160a2a]/30",
    gold: "text-[#f0c040] border-[#8a6a00]/70 bg-[#241a00]/30",
  }[tone];

  return (
    <section className={`border p-4 ${toneClasses}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center border border-current/50 bg-black/20 [&_svg]:size-5">
            {icon}
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-70">
              {eyebrow}
            </div>
            <h2 className="mt-1 text-lg font-semibold tracking-normal text-[#f4efe7]">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#626058]">
        {label}
      </Label>
      {children}
    </div>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "cyan" | "violet" | "gold";
  value: number;
}) {
  const color = {
    cyan: "text-[#1eeab0] border-[#0b8060]/60 bg-[#061f18]",
    violet: "text-[#a060ff] border-[#4a1a90]/60 bg-[#160a2a]",
    gold: "text-[#f0c040] border-[#8a6a00]/60 bg-[#241a00]",
  }[tone];

  return (
    <div className={`border p-3 ${color}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
        {label}
      </div>
    </div>
  );
}

function RoleButton({
  active,
  description,
  icon,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  description: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "cyan" | "violet";
}) {
  const activeClasses =
    tone === "cyan"
      ? "border-[#1eeab0] bg-[#061f18] text-[#1eeab0]"
      : "border-[#a060ff] bg-[#160a2a] text-[#a060ff]";

  return (
    <button
      className={`min-h-28 border p-3 text-left transition ${
        active ? activeClasses : "border-white/10 bg-[#141618] text-[#9c9690] hover:border-white/20"
      }`}
      onClick={onClick}
      type="button"
    >
      <div className="mb-3 [&_svg]:size-5">{icon}</div>
      <div className="text-sm font-semibold">{label}</div>
      <div className="mt-1 text-xs leading-5 opacity-70">{description}</div>
    </button>
  );
}

function RoomStrip({
  role,
  room,
}: {
  role: "host" | "participant";
  room: {
    name: string;
    description: string;
    hostName: string;
    inviteCode: string;
    participants: Array<unknown>;
  };
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`grid size-10 shrink-0 place-items-center border font-mono text-[10px] ${
          role === "host"
            ? "border-[#4a1a90] bg-[#160a2a] text-[#a060ff]"
            : "border-[#0b8060] bg-[#061f18] text-[#1eeab0]"
        }`}
      >
        HR
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#f4efe7]">{room.name}</div>
        <div className="mt-1 text-xs leading-5 text-[#9c9690]">
          {room.description || `Hosted by ${room.hostName}`}
        </div>
        <div className="mt-1 font-mono text-[10px] text-[#626058]">
          {room.participants.length} participants · {room.inviteCode}
        </div>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "submitted" | "winner" | "returned" | "gold" | string;
}) {
  const className =
    tone === "winner"
      ? "border-[#8a6a00] bg-[#241a00] text-[#f0c040]"
      : tone === "returned"
        ? "border-[#901e14] bg-[#280a08] text-[#ff5a4a]"
        : tone === "submitted"
          ? "border-[#904200] bg-[#241000] text-[#ff8820]"
          : "border-[#8a6a00] bg-[#241a00] text-[#f0c040]";

  return (
    <span className={`inline-flex items-center border px-2 py-1 font-mono text-[10px] uppercase ${className}`}>
      {children}
    </span>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 border border-dashed border-white/15 bg-[#141618]/70 p-3 text-xs leading-5 text-[#9c9690]">
      <div className="grid size-9 shrink-0 place-items-center border border-white/10 bg-[#0d0f12] text-[#626058] [&_svg]:size-4">
        {icon}
      </div>
      <span>{text}</span>
    </div>
  );
}

function ProofCard({
  submission,
}: {
  submission: {
    _id: string;
    taskTitle: string;
    roomName: string;
    proofUrl: string;
    status: "submitted" | "winner" | "returned";
    awardXrdm?: number;
    rewardXrdm?: number;
    hostFeedback?: string;
    submittedAt: string;
  };
}) {
  return (
    <article className="border border-white/10 bg-[#141618] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#f4efe7]">{submission.taskTitle}</div>
          <div className="mt-1 font-mono text-[10px] text-[#626058]">{submission.roomName}</div>
        </div>
        <Badge tone={submission.status}>{submission.status}</Badge>
      </div>
      <a
        className="mt-3 flex items-center gap-2 border border-[#0b8060] bg-[#061f18] p-2 font-mono text-xs text-[#1eeab0]"
        href={submission.proofUrl}
        rel="noreferrer"
        target="_blank"
      >
        <LinkIcon className="size-4" />
        <span className="min-w-0 flex-1 truncate">{submission.proofUrl}</span>
      </a>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] text-[#626058]">
          {new Date(submission.submittedAt).toLocaleDateString()}
        </div>
        <div className="font-mono text-xs font-semibold text-[#f0c040]">
          +{submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM
        </div>
      </div>
      {submission.hostFeedback ? (
        <p className="mt-2 border-t border-white/10 pt-2 text-xs leading-5 text-[#9c9690]">
          {submission.hostFeedback}
        </p>
      ) : null}
    </article>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
