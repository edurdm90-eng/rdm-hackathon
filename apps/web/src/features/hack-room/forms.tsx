import { Button } from "@rdm-hack/ui/components/button";
import { Input } from "@rdm-hack/ui/components/input";
import { useEffect, useRef, useState } from "react";
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

function splitDueAtValue(value: string) {
  const [date = "", timeWithSeconds = ""] = value.split("T");
  return {
    date,
    time: timeWithSeconds.slice(0, 5),
  };
}

function mergeDueAtValue(currentValue: string, next: Partial<{ date: string; time: string }>) {
  const minimum = splitDueAtValue(getMinimumDueAtInputValue());
  const current = splitDueAtValue(currentValue);
  const date = next.date ?? current.date ?? minimum.date;
  const time = next.time ?? current.time ?? minimum.time;

  return `${date}T${time}`;
}

function parseDateOnlyValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnlyValue(date: Date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

function formatCalendarTitle(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatSelectedDate(value: string) {
  const date = parseDateOnlyValue(value);

  if (!date) {
    return "Select date";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function CalendarPicker({
  month,
  onMonthChange,
  onSelect,
  selectedDate,
}: {
  month: Date;
  onMonthChange: (date: Date) => void;
  onSelect: (date: Date) => void;
  selectedDate: string;
}) {
  const minimumDate = parseDateOnlyValue(splitDueAtValue(getMinimumDueAtInputValue()).date) ?? new Date();
  const selected = parseDateOnlyValue(selectedDate);
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = firstOfMonth.getDay();
  const days = Array.from({ length: leadingDays + daysInMonth }, (_, index) =>
    index < leadingDays ? null : new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1),
  );
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="w-full max-w-[320px] rounded-[11px] border border-[rgba(238,232,222,0.14)] bg-[#0B0E10] p-3 shadow-2xl shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          className="grid size-8 place-items-center rounded-[8px] border border-[rgba(238,232,222,0.12)] text-[#EEE8DE] transition hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          type="button"
        >
          <NativeIcon className="size-4" name="chevron-back-outline" />
        </button>
        <div className="text-sm font-bold text-[#EEE8DE]">{formatCalendarTitle(month)}</div>
        <button
          className="grid size-8 place-items-center rounded-[8px] border border-[rgba(238,232,222,0.12)] text-[#EEE8DE] transition hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          type="button"
        >
          <NativeIcon className="size-4" name="chevron-forward-outline" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {weekDays.map((day) => (
          <div className="py-1 text-center font-mono text-[10px] font-bold uppercase text-[#626058]" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <div className="aspect-square" key={`empty-${index}`} />;
          }

          const dateValue = formatDateOnlyValue(day);
          const isSelected = selected ? formatDateOnlyValue(selected) === dateValue : false;
          const isDisabled = getStartOfDay(day).getTime() < getStartOfDay(minimumDate).getTime();

          return (
            <button
              className={`grid aspect-square place-items-center rounded-[8px] text-xs font-bold transition ${
                isSelected
                  ? "bg-[#1EEAB0] text-[#03120C]"
                  : "border border-[rgba(238,232,222,0.08)] text-[#CCC6BA] hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
              } ${isDisabled ? "cursor-not-allowed opacity-35 hover:border-[rgba(238,232,222,0.08)] hover:text-[#CCC6BA]" : ""}`}
              disabled={isDisabled}
              key={dateValue}
              onClick={() => onSelect(day)}
              type="button"
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatSelectedTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return "Select time";
  }

  const [hour = "00", minute = "00"] = value.split(":");
  const hourNumber = Number(hour);
  const hour12 = hourNumber % 12 || 12;
  const period = hourNumber >= 12 ? "PM" : "AM";

  return `${hour12}:${minute} ${period}`;
}

function to24HourTime(hour: number, minute: string, period: "AM" | "PM") {
  const normalizedHour = period === "PM" ? (hour % 12) + 12 : hour % 12;
  return `${normalizedHour.toString().padStart(2, "0")}:${minute}`;
}

function clampTimePart(value: number, max: number) {
  return ((value % max) + max) % max;
}

function TimePicker({
  onSelect,
  selectedTime,
}: {
  onSelect: (time: string) => void;
  selectedTime: string;
}) {
  const [selectedHourValue = "", selectedMinute = ""] = selectedTime.split(":");
  const selectedHourNumber = Number(selectedHourValue);
  const selectedHour = selectedHourNumber % 12 || 12;
  const selectedPeriod: "AM" | "PM" = selectedHourNumber >= 12 ? "PM" : "AM";
  const minuteNumber = Number(selectedMinute || "00");

  function selectHour(nextHour: number) {
    const normalizedHour = nextHour === 0 ? 12 : nextHour;
    onSelect(to24HourTime(normalizedHour, selectedMinute || "00", selectedPeriod));
  }

  function selectMinute(nextMinute: number) {
    onSelect(to24HourTime(selectedHour, nextMinute.toString().padStart(2, "0"), selectedPeriod));
  }

  return (
    <div className="absolute right-0 top-12 z-20 w-[220px] rounded-[11px] border border-[rgba(238,232,222,0.14)] bg-[#0B0E10] p-2.5 shadow-2xl shadow-black/30">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#626058]">
          Select time
        </div>
        <div className="flex rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-1">
          {(["AM", "PM"] as const).map((period) => (
            <button
              className={`h-6 rounded-[6px] px-2.5 text-xs font-bold transition ${
                selectedPeriod === period
                  ? "bg-[#1EEAB0] text-[#03120C]"
                  : "text-[#9C9690] hover:text-[#EEE8DE]"
              }`}
              key={period}
              onClick={() => onSelect(to24HourTime(selectedHour, selectedMinute || "00", period))}
              type="button"
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <TimeStepper
          label="Hour"
          onDown={() => selectHour(clampTimePart(selectedHour - 2, 12) + 1)}
          onUp={() => selectHour((selectedHour % 12) + 1)}
          value={selectedHour.toString().padStart(2, "0")}
        />
        <div className="pt-4 text-base font-extrabold text-[#626058]">:</div>
        <TimeStepper
          label="Minute"
          onDown={() => selectMinute(clampTimePart(minuteNumber - 5, 60))}
          onUp={() => selectMinute((minuteNumber + 5) % 60)}
          value={(Number(selectedMinute || "00") || 0).toString().padStart(2, "0")}
        />
      </div>

      <Button
        className="mt-2 h-8 w-full rounded-[8px] bg-[#1EEAB0] text-xs text-[#03120C] hover:bg-[#1EEAB0]/85"
        onClick={() => onSelect(to24HourTime(selectedHour, selectedMinute || "00", selectedPeriod))}
        type="button"
      >
        Done
      </Button>
    </div>
  );
}

function TimeStepper({
  label,
  onDown,
  onUp,
  value,
}: {
  label: string;
  onDown: () => void;
  onUp: () => void;
  value: string;
}) {
  return (
    <div className="grid gap-1">
      <div className="text-center font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#626058]">
        {label}
      </div>
      <button
        className="grid h-7 place-items-center rounded-[7px] border border-[rgba(238,232,222,0.12)] text-[#EEE8DE] transition hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
        onClick={onUp}
        type="button"
      >
        <NativeIcon className="size-4 -rotate-90" name="chevron-forward-outline" />
      </button>
      <div className="grid h-10 place-items-center rounded-[8px] border border-[#1EEAB0] bg-[#061F18] text-lg font-extrabold text-[#EEE8DE]">
        {value}
      </div>
      <button
        className="grid h-7 place-items-center rounded-[7px] border border-[rgba(238,232,222,0.12)] text-[#EEE8DE] transition hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
        onClick={onDown}
        type="button"
      >
        <NativeIcon className="size-4 rotate-90" name="chevron-forward-outline" />
      </button>
    </div>
  );
}

function DueAtField({
  error,
  onPickerOpenChange,
  onChange,
  value,
}: {
  error: string;
  onPickerOpenChange?: (open: boolean) => void;
  onChange: (value: string) => void;
  value: string;
}) {
  const dueAt = splitDueAtValue(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () => parseDateOnlyValue(dueAt.date) ?? parseDateOnlyValue(splitDueAtValue(getMinimumDueAtInputValue()).date) ?? new Date(),
  );
  const hasOpenPicker = calendarOpen || timeOpen;

  useEffect(() => {
    onPickerOpenChange?.(hasOpenPicker);
  }, [hasOpenPicker, onPickerOpenChange]);

  useEffect(() => {
    if (!hasOpenPicker) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }

      setCalendarOpen(false);
      setTimeOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setCalendarOpen(false);
      setTimeOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [hasOpenPicker]);

  return (
    <Field label="Due Date and Time">
      <div className="relative" ref={containerRef}>
        <div className="flex min-h-10 items-center gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#061F18] p-1.5">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
            <button
              className={`inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[7px] border px-2 text-xs font-black transition ${
                dueAt.date
                  ? "border-[#1EEAB0] bg-[#06382B] text-[#1EEAB0]"
                  : "border-[rgba(238,232,222,0.1)] bg-[#0D0F12] text-[#9C9690] hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
              }`}
              onClick={() => {
                setCalendarOpen((open) => !open);
                setTimeOpen(false);
              }}
              type="button"
            >
              <NativeIcon className="size-3.5" name="calendar-outline" />
              <span className="truncate">{dueAt.date ? formatSelectedDate(dueAt.date) : "Date"}</span>
            </button>
            <button
              className={`inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-[7px] border px-2 text-xs font-black transition ${
                dueAt.time
                  ? "border-[#1EEAB0] bg-[#06382B] text-[#1EEAB0]"
                  : "border-[rgba(238,232,222,0.1)] bg-[#0D0F12] text-[#9C9690] hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
              }`}
              onClick={() => {
                setTimeOpen((open) => !open);
                setCalendarOpen(false);
              }}
              type="button"
            >
              <NativeIcon className="size-3.5" name="time-outline" />
              <span className="truncate">{dueAt.time ? formatSelectedTime(dueAt.time) : "Time"}</span>
            </button>
          </div>
        </div>
        {calendarOpen ? (
          <div className="absolute left-0 top-12 z-20 w-full">
            <CalendarPicker
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelect={(date) => {
                onChange(mergeDueAtValue(value, { date: formatDateOnlyValue(date) }));
                setCalendarMonth(date);
                setCalendarOpen(false);
              }}
              selectedDate={dueAt.date}
            />
          </div>
        ) : null}
        {timeOpen ? (
          <TimePicker
            onSelect={(time) => {
              onChange(mergeDueAtValue(value, { time }));
              setTimeOpen(false);
            }}
            selectedTime={dueAt.time}
          />
        ) : null}
      </div>
      {error ? <p className="text-xs leading-5 text-[#FF5A4A]">{error}</p> : null}
    </Field>
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
  const [dueAtPickerOpen, setDueAtPickerOpen] = useState(false);
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
        className={`grid gap-3 ${dueAtPickerOpen ? "pb-6" : ""}`}
        onSubmit={(event) => {
          event.preventDefault();
          onCreateTask();
        }}
      >
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <Field label={isNotification ? "Notification Title" : isGame ? "Game Name" : "Assignment Title"}>
            <Input
              className="h-10 rounded-[9px] border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[13px] text-[#CCC6BA]"
              onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
              placeholder={isNotification ? "Demo check-in" : "Build a working prototype"}
              value={taskForm.title}
            />
          </Field>
          {!isNotification ? (
            <DueAtField
              error={dueAtError}
              onPickerOpenChange={setDueAtPickerOpen}
              onChange={(value) => setTaskForm((current) => ({ ...current, dueAt: value }))}
              value={taskForm.dueAt}
            />
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
