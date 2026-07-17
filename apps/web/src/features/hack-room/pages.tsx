import { Button } from "@rdm-hack/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { usePrivyAuth } from "@/components/privy-provider";
import { authClient } from "@/lib/auth-client";
import { NativeIcon, createNativeIcon } from "@/lib/native-icons";
import { queryClient, trpc } from "@/utils/trpc";

import { RoomCommandCenter } from "./forms";
import {
  buildRoomEntries,
  countUniqueNetworkParticipants,
  emptyRoomForm,
  firstName,
  getRoomRouteParam,
  type HackRoom,
  type RoomTabSegment,
  type SessionUser,
  type Tone,
} from "./model";
import { RoomEntryLink, WebAppScreen } from "./room-shell";
import {
  Avatar,
  EmptyState,
  ProfileField,
  QuickActionGrid,
  SectionCard,
  StatBox,
  StatusBanner,
  SubmissionCard,
} from "./shared-ui";

const AssignmentsIcon = createNativeIcon("clipboard-outline");
const ChallengeIcon = createNativeIcon("flash-outline");
const GamesIcon = createNativeIcon("game-controller-outline");
const WalletIcon = createNativeIcon("diamond-outline");

function shortWalletAddress(address?: string) {
  if (!address) {
    return "";
  }

  return address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
}

export function HackRoomHomePwa({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());

  const stats = dashboard.data?.stats;
  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const recentSubmissions = dashboard.data?.mySubmissions ?? [];
  const allRooms = useMemo(() => buildRoomEntries(hostedRooms, joinedRooms), [hostedRooms, joinedRooms]);
  const firstRoom = allRooms[0]?.room;
  const walletRoom = joinedRooms[0] ?? firstRoom;

  function openRoomOrShelf(room = firstRoom, tab: RoomTabSegment = "overview") {
    if (room) {
      navigate({ to: "/hack-room/$roomId/$tab", params: { roomId: getRoomRouteParam(room), tab } });
      return;
    }
    navigate({ to: "/hack-room" });
  }

  return (
    <WebAppScreen activeNav="home">
      <section className="mb-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-[18px] py-4">
        <h1 className="text-[22px] font-extrabold leading-[30px] tracking-normal text-[#EEE8DE]">Home Hub</h1>
        <p className="mt-2 text-xs leading-[18px] text-[#9C9690]">
          Welcome back, {firstName(user.name)}. Your room activity, pending reviews, and XRDM progress live here.
        </p>

        <div className="mt-3 flex overflow-hidden rounded-[9px] border border-[rgba(238,232,222,0.12)]">
          <div className="flex min-h-9 flex-1 items-center justify-center gap-1.5 border-b-2 border-b-[#1EEAB0] bg-[#061F18]">
            <NativeIcon className="size-3.5 text-[#1EEAB0]" name="person-outline" />
            <span className="font-mono text-[10px] font-extrabold text-[#1EEAB0]">
              As Participant
            </span>
          </div>
          <div className="flex min-h-9 flex-1 items-center justify-center gap-1.5 border-b-2 border-b-[#A060FF] bg-[#160A2A]">
            <NativeIcon className="size-3.5 text-[#A060FF]" name="trophy-outline" />
            <span className="font-mono text-[10px] font-extrabold text-[#A060FF]">
              As Organizer
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-3">
          <Avatar name={user.name} tone="cyan" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-extrabold text-[#EEE8DE]">{user.name}</div>
            <div className="truncate text-xs text-[#626058]">{user.email}</div>
          </div>
          {dashboard.isLoading ? (
            <NativeIcon className="size-4 animate-spin text-[#F0C040]" name="refresh-outline" />
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatBox label="Hosted" value={stats?.activeRooms ?? hostedRooms.length} tone="violet" />
          <StatBox label="Joined" value={stats?.joinedRooms ?? joinedRooms.length} />
          <StatBox label="Reviews" value={stats?.pendingSubmissions ?? 0} tone="gold" />
        </div>
      </section>

      {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}

      <QuickActionGrid
        actions={[
          {
            icon: AssignmentsIcon,
            label: "Assignments",
            meta: "Due and past work",
            onClick: () => navigate({ to: "/hack-room" }),
            tone: "cyan",
          },
          {
            icon: ChallengeIcon,
            label: "Spot Challenge",
            meta: "Live room prompts",
            onClick: () => navigate({ to: "/hack-room" }),
            tone: "orange",
          },
          {
            icon: GamesIcon,
            label: "Games",
            meta: "Play mini games",
            onClick: () => navigate({ to: "/hack-room" }),
            tone: "lime",
          },
          {
            icon: WalletIcon,
            label: "Wallet",
            meta: "XRDM, certs, NFTs",
            onClick: () => openRoomOrShelf(walletRoom, "wallet"),
            tone: "gold",
          },
        ]}
      />

      <SectionCard badge={`${allRooms.length} active`} eyebrow="Overview" title="Hack Room Snapshot">
        <div className="grid gap-2">
          {allRooms.length ? (
            allRooms.slice(0, 4).map((entry) => <RoomEntryLink entry={entry} key={entry.room._id} />)
          ) : (
            <EmptyState icon={<NativeIcon name="home-outline" />} text="Create or join a hack room from Rooms to start seeing activity here." />
          )}
        </div>
      </SectionCard>

      <SectionCard badge={`${recentSubmissions.length} records`} eyebrow="Proof" title="Recent Submissions" tone="gold">
        <div className="grid gap-2">
          {recentSubmissions.length ? (
            recentSubmissions
              .slice(0, 2)
              .map((submission) => <SubmissionCard key={submission._id} submission={submission} />)
          ) : (
            <EmptyState icon={<NativeIcon name="checkmark-circle-outline" />} text="Your submitted proof records will appear here after you complete a task." />
          )}
        </div>
      </SectionCard>
    </WebAppScreen>
  );
}

export function HackRoomRoomsPwa({ user: _user }: { user: SessionUser }) {
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const [roomForm, setRoomForm] = useState(emptyRoomForm);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);

  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const joinedRooms = dashboard.data?.joinedRooms ?? [];
  const allRooms = useMemo(() => buildRoomEntries(hostedRooms, joinedRooms), [hostedRooms, joinedRooms]);

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
  };

  const createRoom = useMutation(
    trpc.hackRoom.createRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setRoomForm(emptyRoomForm);
        setMessage({ text: `Created ${room.name} with invite ${room.inviteCode}`, tone: "violet" });
        await invalidateDashboard();
      },
    }),
  );

  const joinRoom = useMutation(
    trpc.hackRoom.joinRoom.mutationOptions({
      onError: (error) => setMessage({ text: error.message, tone: "red" }),
      onSuccess: async (room) => {
        setInviteCode("");
        setMessage({ text: `Joined ${room.name}`, tone: "cyan" });
        await invalidateDashboard();
      },
    }),
  );

  async function shareInvite(room: HackRoom) {
    const text = `Join ${room.name} in XRDM Hack Room with invite code ${room.inviteCode}`;
    if (navigator.share) {
      await navigator.share({ text, title: `${room.name} invite` });
      return;
    }
    await navigator.clipboard?.writeText(text);
    setMessage({ text: "Invite copied to clipboard", tone: "cyan" });
  }

  return (
    <WebAppScreen activeNav="rooms">
      {(dashboard.isLoading || createRoom.isPending || joinRoom.isPending) ? (
        <div className="mb-3 flex items-center gap-2 rounded-[10px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-3 py-2 text-xs text-[#9C9690]">
          <NativeIcon className="size-4 animate-spin text-[#F0C040]" name="refresh-outline" />
          Syncing Hack Room...
        </div>
      ) : null}

      <RoomCommandCenter
        createRoomPending={createRoom.isPending}
        inviteCode={inviteCode}
        joinRoomPending={joinRoom.isPending}
        onCreateRoom={() => createRoom.mutate(roomForm)}
        onInviteCodeChange={setInviteCode}
        onJoinRoom={() => joinRoom.mutate({ inviteCode })}
        onRoomFormChange={setRoomForm}
        roomForm={roomForm}
        tone="violet"
      />

      {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}
      {message ? <StatusBanner message={message.text} tone={message.tone} /> : null}

      <SectionCard badge={`${allRooms.length} active`} eyebrow="Hack Rooms" title="Room Shelf">
        <div className="grid gap-2">
          {allRooms.length ? (
            allRooms.map((entry) => (
              <RoomEntryLink entry={entry} key={entry.room._id} onShare={entry.role === "host" ? shareInvite : undefined} />
            ))
          ) : (
            <EmptyState icon={<NativeIcon name="flash-outline" />} text="Create a room as host or paste an invite code to join as participant." />
          )}
        </div>
      </SectionCard>

    </WebAppScreen>
  );
}

export function HackRoomProfilePwa({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const { logout } = usePrivyAuth();
  const dashboard = useQuery(trpc.hackRoom.dashboard.queryOptions());
  const stats = dashboard.data?.stats;
  const hostedRooms = dashboard.data?.hostedRooms ?? [];
  const networkCount = countUniqueNetworkParticipants(hostedRooms, user.id);

  async function handleSignOut() {
    await logout();
    await authClient.signOut();
    await queryClient.invalidateQueries();
    navigate({ to: "/login" });
  }

  return (
    <WebAppScreen activeNav="profile">
      <section className="mb-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] px-[18px] py-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} tone="cyan" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold tracking-normal text-[#EEE8DE]">{user.name}</h1>
            <p className="truncate text-xs text-[#626058]">{user.email}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBox label="Rooms" value={(stats?.activeRooms ?? 0) + (stats?.joinedRooms ?? 0)} />
          <StatBox label="Wins" value={stats?.winners ?? 0} tone="gold" />
          <StatBox label="Network" value={networkCount} tone="violet" />
        </div>
      </section>

      {dashboard.error ? <StatusBanner message={dashboard.error.message} tone="red" /> : null}

      <SectionCard badge="Account" eyebrow="Profile" title="Account Details">
        <ProfileField label="Name" value={user.name} />
        <ProfileField label="Email" value={user.email} />
        {user.walletAddress ? (
          <ProfileField label="Wallet" value={shortWalletAddress(user.walletAddress)} tone="gold" />
        ) : null}
        <Button
          className="mt-3 h-10 w-full rounded-[10px] border-[#FF5A4A] bg-[#280A08] text-[#FF5A4A] hover:bg-[#280A08]/80"
          onClick={handleSignOut}
          type="button"
          variant="outline"
        >
          <NativeIcon className="size-4" name="log-out-outline" />
          Sign Out
        </Button>
      </SectionCard>
    </WebAppScreen>
  );
}
