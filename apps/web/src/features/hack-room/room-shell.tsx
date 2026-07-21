import { Link, useNavigate } from "@tanstack/react-router";
import type * as React from "react";

import { NativeIcon } from "@/lib/native-icons";

import { Avatar, Badge, BottomNav, IconButton, StatBox } from "./shared-ui";
import { getRoomRouteParam, type HackRoom, type Role, type RoomEntry } from "./model";

function WebAppScreen({
  activeNav,
  children,
}: {
  activeNav: "home" | "profile" | "rooms";
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-full overflow-auto bg-[#0A0C0F] pb-24 text-[#EEE8DE]">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-5 pt-3 sm:px-0">{children}</div>
      <AppBottomNav active={activeNav} />
    </main>
  );
}

function AppBottomNav({ active }: { active: "home" | "profile" | "rooms" }) {
  const navigate = useNavigate();

  return (
    <BottomNav
      active={active}
      onHome={() => navigate({ to: "/dashboard" })}
      onProfile={() => navigate({ to: "/profile" })}
      onRooms={() => navigate({ to: "/hack-room" })}
    />
  );
}

function RoomEntryLink({
  entry,
  onShare,
  showMeta = true,
}: {
  entry: RoomEntry;
  onShare?: (room: HackRoom) => void;
  showMeta?: boolean;
}) {
  return (
    <div className="flex items-stretch gap-2 rounded-[9px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <Link
        className="flex min-w-0 flex-1 items-start gap-3"
        params={{ roomId: getRoomRouteParam(entry.room), tab: "overview" }}
        to="/hack-room/$roomId/$tab"
      >
        <Avatar name={entry.room.name} tone={entry.role === "host" ? "violet" : "cyan"} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-[#EEE8DE]">{entry.room.name}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-[18px] text-[#B8B0A7]">
                {entry.room.description || `Hosted by ${entry.room.hostName}`}
              </p>
            </div>
            <Badge tone={entry.role === "host" ? "violet" : "cyan"}>
              {entry.role === "host" ? "Host" : "Participant"}
            </Badge>
          </div>
          {showMeta ? (
            <div className="mt-1 font-mono text-[10px] text-[#A8A29A]">
              {entry.room.participants.length} participants - {entry.room.inviteCode}
            </div>
          ) : null}
        </div>
      </Link>
      {onShare ? (
        <IconButton label="Share invite" onClick={() => onShare(entry.room)}>
          <NativeIcon className="size-4" name="share-outline" />
        </IconButton>
      ) : null}
    </div>
  );
}

function RoomSwitcher({
  activeRoomId,
  allRooms,
  onRoomChange,
}: {
  activeRoomId: string;
  allRooms: RoomEntry[];
  onRoomChange: (roomId: string) => void;
}) {
  if (!allRooms.length) {
    return null;
  }

  const activeEntry = allRooms.find((entry) => entry.room._id === activeRoomId) ?? allRooms[0];
  const tone = activeEntry.role === "host" ? "violet" : "cyan";
  const colors =
    activeEntry.role === "host"
      ? "border-[#4A1A90] text-[#CECBF6]"
      : "border-[#1EEAB0] text-[#1EEAB0]";

  return (
    <label className="mb-3 grid gap-2 rounded-[12px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
      <span className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#626058]">
          Active Room
        </span>
        <Badge tone={tone}>{activeEntry.role === "host" ? "Host View" : "Participant View"}</Badge>
      </span>
      <select
        className={`h-10 rounded-[9px] border bg-[#141618] px-2 text-[13px] font-medium outline-none ${colors}`}
        onChange={(event) => onRoomChange(event.target.value)}
        value={activeEntry.room._id}
      >
        {allRooms.map((entry) => (
          <option key={entry.room._id} value={entry.room._id}>
            {entry.role === "host" ? "Host" : "Participant"} - {entry.room.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function RoomHero({
  onCopyInvite,
  onShareInvite,
  role,
  room,
  stats,
}: {
  onCopyInvite?: (room: HackRoom) => void;
  onShareInvite?: (room: HackRoom) => void;
  role: Role;
  room?: HackRoom;
  stats: { participants: number; tasks: number; winners: number };
}) {
  const canUseInvite = Boolean(room && role === "host");

  return (
    <section className="mb-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-[18px] py-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#A8A29A]">
            Inside Hack Room
          </div>
          <h1 className="text-[17px] font-extrabold leading-[21px] tracking-normal text-[#EEE8DE]">
            {room?.name ?? "Create or join a room"}
          </h1>
          <p className="mt-1 text-xs leading-[18px] text-[#B8B0A7]">
            {room?.description ||
              "Hosts create invite rooms, participants submit proof, and winners receive XRDM records."}
          </p>
        </div>
        <Badge tone={role === "host" ? "violet" : "cyan"}>{role}</Badge>
      </div>
      {room && canUseInvite ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-[#1EEAB0] bg-[#061F18] px-3 py-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#7FFFD6]">
              Invite Code
            </div>
            <div className="mt-0.5 font-mono text-[14px] font-extrabold text-[#EEE8DE]">
              {room.inviteCode}
            </div>
          </div>
          <div className="flex gap-2">
            {onCopyInvite ? (
              <IconButton label="Copy invite code" onClick={() => onCopyInvite(room)}>
                <NativeIcon className="size-4" name="copy-outline" />
              </IconButton>
            ) : null}
            {onShareInvite ? (
              <IconButton label="Share invite" onClick={() => onShareInvite(room)}>
                <NativeIcon className="size-4" name="share-outline" />
              </IconButton>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Participants" value={stats.participants} />
        <StatBox label="Tasks" value={stats.tasks} />
        <StatBox label="Winners" value={stats.winners} />
      </div>
    </section>
  );
}

export { RoomEntryLink, RoomHero, RoomSwitcher, WebAppScreen };
