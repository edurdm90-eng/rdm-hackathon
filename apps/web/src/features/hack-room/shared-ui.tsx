import { Button } from "@rdm-hack/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@rdm-hack/ui/components/card";
import type * as React from "react";

import { NativeIcon, type NativeIconComponent } from "@/lib/native-icons";

import {
  formatDate,
  getInitials,
  getSubmissionProofItems,
  getTaskProofTypes,
  kindLabel,
  proofTypeIcon,
  proofTypeLabel,
  rewardKindLabel,
  statusTone,
  submissionStatusHeadline,
  submissionStatusLabel,
  toExternalUrl,
  tonePanelSurface,
  toneSurface,
  toneText,
  toneTopBorder,
  type DashboardData,
  type HackReward,
  type HackRoom,
  type HackSubmission,
  type HackTask,
  type ProofType,
  type Role,
  type SubmissionStatus,
  type Tone,
} from "./model";

function Tabs<T extends string>({
  activeTab,
  onSelect,
  tabs,
}: {
  activeTab: T;
  onSelect: (tab: T) => void;
  tabs: Array<{ id: T; icon: NativeIconComponent; label: string }>;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-[5px]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            className={`inline-flex items-center gap-1.5 rounded-[9px] border px-3 py-2 text-xs transition ${
              active
                ? "border-[#1EEAB0] bg-[#061F18] font-medium text-[#1EEAB0]"
                : "border-[rgba(238,232,222,0.12)] bg-[#141618] text-[#626058] hover:text-[#9C9690]"
            }`}
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            type="button"
          >
            <Icon className="size-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ActionScreen({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-left">
        <span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-[#626058]">
            Action
          </span>
          <span className="block text-base font-medium text-[#EEE8DE]">{title}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

function QuickActionGrid({
  actions,
  columns = 4,
}: {
  actions: Array<{ icon: NativeIconComponent; label: string; meta?: string; onClick: () => void; tone?: Tone }>;
  columns?: 2 | 4;
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#626058]">
        Quick Actions
      </div>
      <div className={`grid gap-2 ${columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        {actions.map((action) => {
          const Icon = action.icon;
          const tone = action.tone ?? "cyan";
          const hasMeta = Boolean(action.meta);
          return (
            <button
              className={
                hasMeta
                  ? `flex min-h-[92px] flex-col items-start justify-center rounded-[11px] border p-[11px] text-left transition hover:brightness-110 ${tonePanelSurface(tone)}`
                  : `flex min-h-[72px] flex-col items-center justify-center gap-[5px] rounded-[11px] border border-[rgba(238,232,222,0.12)] border-t-2 bg-[#222528] px-2 py-[9px] text-center transition hover:bg-[#2A2E32] ${toneTopBorder(tone)}`
              }
              key={action.label}
              onClick={action.onClick}
              type="button"
            >
              {hasMeta ? (
                <Icon className={`size-[18px] ${toneText(tone)}`} />
              ) : (
                <span className="grid size-8 place-items-center rounded-[12px] border border-[rgba(238,232,222,0.12)] bg-[#222528]">
                  <Icon className="size-[18px] text-[#CCC6BA]" />
                </span>
              )}
              <span className={`${hasMeta ? `mt-2 ${toneText(tone)}` : "text-[#9C9690]"} text-xs font-extrabold`}>
                {action.label}
              </span>
              {action.meta ? (
                <span className="mt-0.5 line-clamp-2 text-[10px] leading-[14px] text-[#9C9690]">
                  {action.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionCard({
  badge,
  children,
  eyebrow,
  title,
  tone = "cyan",
}: {
  badge?: string;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  tone?: Tone;
}) {
  return (
    <Card className={`mb-3 gap-0 rounded-[11px] border py-0 text-[#EEE8DE] ring-0 ${tonePanelSurface(tone)}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pb-3 pt-3.5">
        <div>
          <div className={`font-mono text-[10px] uppercase tracking-[0.12em] ${toneText(tone, true)}`}>
            {eyebrow}
          </div>
          <CardTitle className="mt-0.5 text-[13px] font-extrabold tracking-normal text-[#EEE8DE]">{title}</CardTitle>
        </div>
        {badge ? <Badge tone={tone}>{badge}</Badge> : null}
      </CardHeader>
      <CardContent className="px-4 pb-3.5">{children}</CardContent>
    </Card>
  );
}

function TaskCard({
  onSelect,
  selected = false,
  status,
  task,
}: {
  onSelect?: () => void;
  selected?: boolean;
  status?: SubmissionStatus;
  task: HackTask;
}) {
  const Component = onSelect ? "button" : "article";
  return (
    <Component
      className={`w-full rounded-[10px] border p-3 text-left transition ${
        selected
          ? "border-[#1EEAB0] bg-[#061F18]"
          : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] hover:border-[#1EEAB0]"
      }`}
      onClick={onSelect}
      type={onSelect ? "button" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{task.title}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-[#626058]">
            {task.roomName} - Due {formatDate(task.dueAt)}
          </div>
        </div>
        <Badge tone={status ? statusTone(status) : "gold"}>
          {status ? submissionStatusLabel(status) : `+${task.rewardXrdm} XRDM`}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-[18px] text-[#9C9690]">{task.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ProofTag label={kindLabel(task.kind ?? "task")} />
        {getTaskProofTypes(task).map((proofType) => (
          <ProofTag key={proofType} label={proofTypeLabel(proofType)} />
        ))}
      </div>
    </Component>
  );
}

function SubmissionCard({
  submission,
}: {
  submission: DashboardData["mySubmissions"][number] | HackSubmission;
}) {
  return (
    <article className="rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{submission.taskTitle}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-[#626058]">{submission.roomName}</div>
        </div>
        <Badge tone={statusTone(submission.status)}>{submissionStatusLabel(submission.status)}</Badge>
      </div>
      <ProofItemsList proofItems={getSubmissionProofItems(submission)} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] text-[#626058]">{formatDate(submission.submittedAt)}</div>
        <div className="font-mono text-xs font-semibold text-[#F0C040]">
          +{submission.awardXrdm ?? submission.rewardXrdm ?? 0} XRDM
        </div>
      </div>
      {submission.hostFeedback ? (
        <p className="mt-2 border-t border-[rgba(238,232,222,0.12)] pt-2 text-xs leading-[18px] text-[#9C9690]">
          {submission.hostFeedback}
        </p>
      ) : null}
    </article>
  );
}

function SubmissionHoldCard({ submission }: { submission: DashboardData["mySubmissions"][number] }) {
  return (
    <div className={`rounded-[11px] border p-3 ${toneSurface(statusTone(submission.status))}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold">{submissionStatusHeadline(submission.status)}</div>
          <p className="mt-1 text-xs leading-[18px] text-[#9C9690]">
            {submission.status === "submitted"
              ? "Your proof is with the host. This form reopens if the host returns it."
              : "This proof is locked into your room history."}
          </p>
        </div>
        <Badge tone={statusTone(submission.status)}>{submissionStatusLabel(submission.status)}</Badge>
      </div>
      <SubmissionCard submission={submission} />
    </div>
  );
}

function RewardCard({ reward }: { reward: HackReward }) {
  return (
    <article className="rounded-[10px] border border-[#8A6A00] bg-[#241A00] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{reward.title}</div>
          <div className="mt-1 truncate font-mono text-[10px] text-[#626058]">
            {reward.roomName} - {formatDate(reward.issuedAt)}
          </div>
        </div>
        <Badge tone="gold">{rewardKindLabel(reward.kind)}</Badge>
      </div>
      {reward.description ? <p className="mt-2 text-xs leading-[18px] text-[#9C9690]">{reward.description}</p> : null}
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[#626058]">{reward.recipientCount} recipients</span>
        <span className="font-mono font-semibold text-[#F0C040]">
          {reward.awardXrdm ? `+${reward.awardXrdm} XRDM` : "Issued"}
        </span>
      </div>
    </article>
  );
}

function ProofItemsList({ proofItems }: { proofItems: Array<{ type: ProofType; value: string }> }) {
  if (!proofItems.length) {
    return <EmptyState icon={<NativeIcon name="link-outline" />} text="No proof links were attached." />;
  }

  return (
    <div className="mt-3 grid gap-1.5">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#626058]">
        Submitted Proof
      </div>
      {proofItems.map((proofItem, index) => {
        const Icon = proofTypeIcon(proofItem.type);
        const isLinkProof = proofItem.type !== "game_score";
        return (
          <a
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-2.5 py-2"
            href={isLinkProof ? toExternalUrl(proofItem.value) : undefined}
            key={`${proofItem.type}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-[7px] bg-[#0D0F12]">
                <Icon className="size-4 text-[#9C9690]" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-[#CCC6BA]">
                  {proofTypeLabel(proofItem.type)} {index + 1}
                </span>
                <span className="block truncate text-[10px] text-[#626058]">{proofItem.value}</span>
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-[#1EEAB0]">
              {isLinkProof ? "Open" : "Result"}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function LedgerRow({ label, meta, value }: { label: string; meta: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2">
      <span className="size-2 shrink-0 rounded-full bg-[#1EEAB0]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[#EEE8DE]">{label}</span>
        <span className="block truncate text-[10px] text-[#626058]">{meta}</span>
      </span>
      <span className="font-mono text-xs font-semibold text-[#F0C040]">{value}</span>
    </div>
  );
}

function BottomNav({
  active,
  onHome,
  onProfile,
  onRooms,
}: {
  active: "home" | "profile" | "rooms";
  onHome: () => void;
  onProfile: () => void;
  onRooms: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 bg-[#0A0C0F] px-3 pb-2.5 pt-1.5">
      <div className="mx-auto grid min-h-[54px] w-full max-w-[560px] grid-cols-3 gap-1 rounded-[14px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-1 shadow-[0_8px_18px_rgba(0,0,0,0.2)]">
        <BottomNavButton
          active={active === "home"}
          icon={<NativeIcon className="size-[18px]" name="home-outline" />}
          label="Home"
          onClick={onHome}
          tone="cyan"
        />
        <BottomNavButton
          active={active === "rooms"}
          icon={<NativeIcon className="size-[18px]" name="flash-outline" />}
          label="Rooms"
          onClick={onRooms}
          tone="violet"
        />
        <BottomNavButton
          active={active === "profile"}
          icon={<NativeIcon className="size-[18px]" name="person-circle-outline" />}
          label="Profile"
          onClick={onProfile}
          tone="gold"
        />
      </div>
    </nav>
  );
}

function BottomNavButton({
  active = false,
  icon,
  label,
  onClick,
  tone,
}: {
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: Tone;
}) {
  return (
    <button
      className={`flex min-h-[44px] flex-col items-center justify-center gap-px rounded-[10px] border px-2 py-1 text-[10px] transition ${
        active
          ? `border-[rgba(238,232,222,0.12)] bg-[#222528] font-extrabold ${toneText(tone)}`
          : "border-transparent font-semibold text-[#626058] hover:text-[#9C9690]"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-[#9C9690]">
        {label}
      </span>
      {children}
    </div>
  );
}

function TextArea({
  onChange,
  placeholder,
  value,
}: {
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <textarea
      className="min-h-[72px] w-full resize-none rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2 text-[13px] leading-5 text-[#CCC6BA] outline-none placeholder:text-[#626058] focus:border-[#1EEAB0]"
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  );
}

function TaskKindButton({
  active,
  icon,
  label,
  onClick,
  tone,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: Tone;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-xs font-semibold transition ${
        active ? toneSurface(tone) : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#9C9690] hover:border-[rgba(238,232,222,0.2)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: Tone | SubmissionStatus | string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[8px] border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] ${toneSurface(
        tone,
      )}`}
    >
      {children}
    </span>
  );
}

function ProofTag({ label }: { label: string }) {
  return (
    <span className="rounded-[7px] border border-[#1EEAB0] bg-[#0D0F12] px-2 py-1 font-mono text-[10px] uppercase text-[#1EEAB0]">
      {label}
    </span>
  );
}

function ChipButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`max-w-full truncate rounded-[7px] border px-3 py-1.5 font-mono text-[10px] uppercase ${
        active ? "border-[#1EEAB0] bg-[#061F18] text-[#1EEAB0]" : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] text-[#626058]"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="grid size-8 place-items-center rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#141618] text-[#9C9690] transition hover:border-[#1EEAB0] hover:text-[#1EEAB0]"
      onClick={onClick}
      type="button"
      title={label}
    >
      {children}
    </button>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[9px] border border-dashed border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3 text-xs leading-[18px] text-[#9C9690]">
      <div className="grid size-9 shrink-0 place-items-center rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#141618] text-base text-[#626058] [&_svg]:size-4">
        {icon}
      </div>
      <span>{text}</span>
    </div>
  );
}

function StatusBanner({ message, tone }: { message: string; tone: Tone }) {
  return (
    <div className={`mb-3 flex items-start gap-2 rounded-[10px] border px-3 py-2 text-xs leading-[18px] ${toneSurface(tone)}`}>
      {tone === "red" ? (
        <NativeIcon className="mt-0.5 size-4 shrink-0" name="alert-circle-outline" />
      ) : (
        <NativeIcon className="mt-0.5 size-4 shrink-0" name="checkmark-circle-outline" />
      )}
      <span>{message}</span>
    </div>
  );
}

function StatBox({ label, tone = "cyan", value }: { label: string; tone?: Tone; value: number | string }) {
  return (
    <div className={`min-h-[76px] rounded-[10px] border p-2.5 ${tonePanelSurface(tone)}`}>
      <div className="mt-1 text-xl font-extrabold tracking-normal text-[#EEE8DE]">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-normal text-[#9C9690]">{label}</div>
    </div>
  );
}

function Avatar({ name, tone }: { name: string; tone: "cyan" | "violet" }) {
  return (
    <div
      className={`grid size-8 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-bold ${
        tone === "cyan"
          ? "border-[#0B8060] bg-[#061F18] text-[#1EEAB0]"
          : "border-[#4A1A90] bg-[#160A2A] text-[#A060FF]"
      }`}
    >
      {getInitials(name)}
    </div>
  );
}

function RoomRow({ onClick, role, room }: { onClick?: () => void; role: Role; room: HackRoom }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      className={`flex w-full items-start gap-3 rounded-[9px] border p-3 text-left transition ${
        onClick
          ? "border-[rgba(238,232,222,0.12)] bg-[#0D0F12] hover:border-[#1EEAB0]"
          : "border-[rgba(238,232,222,0.12)] bg-[#0D0F12]"
      }`}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <Avatar name={room.name} tone={role === "host" ? "violet" : "cyan"} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{room.name}</div>
        <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-[#9C9690]">
          {room.description || `Hosted by ${room.hostName}`}
        </p>
        <div className="mt-1 font-mono text-[10px] text-[#626058]">
          {room.participants.length} participants - {room.inviteCode}
        </div>
      </div>
    </Component>
  );
}

function ProfileField({ label, tone, value }: { label: string; tone?: Tone; value: string }) {
  return (
    <div className="mb-1.5 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#626058]">{label}</div>
      <div className={`mt-0.5 text-[13px] font-semibold ${tone ? toneText(tone) : "text-[#EEE8DE]"}`}>{value}</div>
    </div>
  );
}

export {
  ActionScreen,
  Avatar,
  Badge,
  BottomNav,
  ChipButton,
  EmptyState,
  Field,
  IconButton,
  LedgerRow,
  ProfileField,
  ProofItemsList,
  ProofTag,
  QuickActionGrid,
  RewardCard,
  RoomRow,
  SectionCard,
  StatBox,
  StatusBanner,
  SubmissionCard,
  SubmissionHoldCard,
  Tabs,
  TaskCard,
  TaskKindButton,
  TextArea,
};
