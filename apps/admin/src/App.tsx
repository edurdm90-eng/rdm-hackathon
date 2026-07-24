import {
  Activity,
  Award,
  BadgeCheck,
  Blocks,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Coins,
  Gauge,
  LayoutDashboard,
  LogOut,
  Medal,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  Users,
  WalletCards,
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  type AdminSnapshot,
  type Activity as ActivityItem,
  type HealthItem,
  type Kpi,
  type MovementPoint,
  type RankedItem,
  type RoomRow,
  type SegmentMetric,
  type Status,
  type UserInsight,
} from "./data";

const AdminSnapshotContext = createContext<AdminSnapshot | null>(null);

function useAdminSnapshot() {
  const snapshot = useContext(AdminSnapshotContext);

  if (!snapshot) {
    throw new Error("Admin dashboard data is unavailable.");
  }

  return snapshot;
}

const statusLabels: Record<Status, string> = {
  confirmed: "Confirmed",
  failed: "Failed",
  pending: "Pending",
};

const activityIcons: Record<ActivityItem["kind"], typeof Activity> = {
  approval: CheckCircle2,
  badge: BadgeCheck,
  certificate: Medal,
  join: Users,
  reward: Award,
  room: Blocks,
  submission: Activity,
  winner: ShieldCheck,
};

function statusClass(status: Status) {
  return `status status-${status}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }

  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1_000);
  const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(elapsedSeconds) < 60) {
    return relativeTime.format(elapsedSeconds, "second");
  }

  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) {
    return relativeTime.format(elapsedMinutes, "minute");
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) {
    return relativeTime.format(elapsedHours, "hour");
  }

  return relativeTime.format(Math.round(elapsedHours / 24), "day");
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <article className={`kpi-card tone-${kpi.tone}`}>
      <div>
        <p className="eyebrow">{kpi.label}</p>
        <strong>{kpi.value}</strong>
      </div>
      <p>{kpi.detail}</p>
      <span>{kpi.trend}</span>
    </article>
  );
}

function MovementChart({ points }: { points: MovementPoint[] }) {
  const maxValue = Math.max(
    1,
    ...points.flatMap((point) => [point.users, point.joins, point.submissions]),
  );

  return (
    <div className="chart-grid" aria-label="User movement by day">
      {points.map((point) => (
        <div className="chart-column" key={point.day}>
          <div className="bar-stack">
            <span
              className="bar bar-users"
              style={{ height: `${Math.max((point.users / maxValue) * 100, 8)}%` }}
              title={`${point.users} new users`}
            />
            <span
              className="bar bar-joins"
              style={{ height: `${Math.max((point.joins / maxValue) * 100, 8)}%` }}
              title={`${point.joins} joins`}
            />
            <span
              className="bar bar-submissions"
              style={{ height: `${Math.max((point.submissions / maxValue) * 100, 8)}%` }}
              title={`${point.submissions} submissions`}
            />
          </div>
          <span className="chart-label">{point.day}</span>
        </div>
      ))}
    </div>
  );
}

function RankedList({ items }: { items: RankedItem[] }) {
  if (items.length === 0) {
    return <p className="empty-copy">No ranked activity is available for this period.</p>;
  }

  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return (
    <div className="rank-list">
      {items.map((item) => (
        <div className="rank-row" key={item.label}>
          <div className="rank-copy">
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </div>
          <div className="rank-meter" aria-label={`${item.label}: ${item.value}`}>
            <span style={{ width: `${(item.value / maxValue) * 100}%` }} />
          </div>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="empty-copy">No recent platform activity.</p>;
  }

  return (
    <div className="activity-list">
      {items.map((item) => {
        const Icon = activityIcons[item.kind];

        return (
          <article className="activity-row" key={item.id}>
            <div className="activity-icon">
              <Icon size={16} />
            </div>
            <div>
              <div className="row-heading">
                <strong>{item.title}</strong>
                <span className={statusClass(item.status)}>{statusLabels[item.status]}</span>
              </div>
              <p>{item.detail}</p>
            </div>
            <time dateTime={item.time}>{formatRelativeTime(item.time)}</time>
          </article>
        );
      })}
    </div>
  );
}

function RoomsTable({ rooms }: { rooms: RoomRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Room</th>
            <th>Host</th>
            <th>Participants</th>
            <th>Assignments</th>
            <th>Submissions</th>
            <th>Rewards</th>
            <th>Created</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rooms.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={8}>
                No rooms match the current view.
              </td>
            </tr>
          ) : (
            rooms.map((room) => (
              <tr key={room.id}>
                <td>
                  <strong>{room.name}</strong>
                </td>
                <td>{room.hostEmail}</td>
                <td>{room.participants}</td>
                <td>{room.assignments}</td>
                <td>{room.submissions}</td>
                <td>{room.rewardsIssued}</td>
                <td>{formatDate(room.createdDate)}</td>
                <td>
                  <span className={statusClass(room.onchainStatus)}>
                    {statusLabels[room.onchainStatus]}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SegmentTable({ label, segments }: { label: string; segments: SegmentMetric[] }) {
  return (
    <div className="table-wrap">
      <table className="metric-table">
        <thead>
          <tr>
            <th>{label}</th>
            <th>Users</th>
            <th>Rooms</th>
            <th>Joins</th>
            <th>Submissions</th>
            <th>Approved</th>
            <th>Winners</th>
            <th>XRDM</th>
          </tr>
        </thead>
        <tbody>
          {segments.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={8}>
                No grouped statistics are available.
              </td>
            </tr>
          ) : (
            segments.map((segment) => (
              <tr key={segment.segment}>
                <td>
                  <strong>{segment.segment}</strong>
                </td>
                <td>{segment.users.toLocaleString()}</td>
                <td>{segment.rooms.toLocaleString()}</td>
                <td>{segment.joins.toLocaleString()}</td>
                <td>{segment.submissions.toLocaleString()}</td>
                <td>{segment.approvals.toLocaleString()}</td>
                <td>{segment.winners.toLocaleString()}</td>
                <td>{segment.xrdm.toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function UsersTable({ users }: { users: UserInsight[] }) {
  return (
    <div className="table-wrap">
      <table className="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Hosted</th>
            <th>Joined</th>
            <th>Submissions</th>
            <th>Approved</th>
            <th>Rewards</th>
            <th>XRDM</th>
            <th>Last signal</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={9}>
                No users match the current view.
              </td>
            </tr>
          ) : (
            users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>
                  <span className="muted-cell">{user.email}</span>
                </td>
                <td>
                  <span className={`role-chip role-${user.role}`}>{user.role}</span>
                </td>
                <td>{user.roomsHosted}</td>
                <td>{user.roomsJoined}</td>
                <td>{user.submissions}</td>
                <td>{user.approvals}</td>
                <td>{user.rewards}</td>
                <td>{user.xrdm.toLocaleString()}</td>
                <td>{formatRelativeTime(user.lastSignal)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function HealthPanel({ items }: { items: HealthItem[] }) {
  if (items.length === 0) {
    return <p className="empty-copy">No reward or chain health records are available.</p>;
  }

  return (
    <div className="health-grid">
      {items.map((item) => (
        <article className="health-row" key={item.label}>
          <div>
            <span className={statusClass(item.status)}>{statusLabels[item.status]}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
          <b>{item.value}</b>
        </article>
      ))}
    </div>
  );
}

const dashboardRoutes = [
  {
    id: "overview",
    path: "/overview",
    label: "Overview",
    detail: "KPIs and movement",
    description: "An operational summary across users, rooms, submissions, and rewards.",
    icon: LayoutDashboard,
  },
  {
    id: "roles",
    path: "/roles",
    label: "Roles",
    detail: "Host vs member",
    description: "Compare participation, approvals, winners, and rewards by platform role.",
    icon: UsersRound,
  },
  {
    id: "users",
    path: "/users",
    label: "Users",
    detail: "Person-level insight",
    description: "Inspect user movement, contributions, approvals, and earned rewards.",
    icon: UserRound,
  },
  {
    id: "hosts",
    path: "/hosts",
    label: "Hosts",
    detail: "Host performance",
    description: "Compare host activity, room ownership, approvals, and reward output.",
    icon: ShieldCheck,
  },
  {
    id: "rooms",
    path: "/rooms",
    label: "Rooms",
    detail: "Room operations",
    description: "Monitor participation, assignments, submissions, rewards, and room status.",
    icon: Blocks,
  },
  {
    id: "rewards",
    path: "/rewards",
    label: "Rewards",
    detail: "XRDM and certificates",
    description: "Track XRDM, winners, certificates, and NFT badge issuance.",
    icon: Coins,
  },
  {
    id: "chain",
    path: "/chain",
    label: "Chain",
    detail: "Event health",
    description: "Review confirmed, pending, and failed blockchain events by room.",
    icon: WalletCards,
  },
  {
    id: "operations",
    path: "/operations",
    label: "Operations",
    detail: "Risk and mismatch signals",
    description: "Review pending confirmations, failed events, and ledger mismatches.",
    icon: CircleAlert,
  },
] as const;

type DashboardRoute = (typeof dashboardRoutes)[number];
type DashboardRouteId = DashboardRoute["id"];

function resolveRoute(pathname: string): DashboardRoute | null {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return normalizedPath === "/"
    ? dashboardRoutes[0]
    : (dashboardRoutes.find((route) => route.path === normalizedPath) ?? null);
}

function OverviewRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <>
      <section className="kpi-grid" aria-label="Top KPIs">
        {adminSnapshot.kpis.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel panel-wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Movement</p>
              <h2>Users, joins, and submissions</h2>
            </div>
            <div className="legend">
              <span className="legend-users">Users</span>
              <span className="legend-joins">Joins</span>
              <span className="legend-submissions">Submissions</span>
            </div>
          </div>
          <MovementChart points={adminSnapshot.movement} />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Activity Feed</p>
              <h2>Recent activity</h2>
            </div>
            <Clock3 size={18} />
          </div>
          <ActivityFeed items={adminSnapshot.activity} />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Rooms</p>
              <h2>Most active rooms</h2>
            </div>
          </div>
          <RankedList items={adminSnapshot.activeRooms} />
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Hosts</p>
              <h2>Most active hosts</h2>
            </div>
          </div>
          <RankedList items={adminSnapshot.activeHosts} />
        </article>
      </section>
    </>
  );
}

function RolesRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Role Analysis</p>
            <h2>Actions and outcomes by role</h2>
            <p className="panel-copy">
              Events use each person&apos;s current role. Approvals use the room
              host&apos;s role; winner outcomes and XRDM use the recipient&apos;s role.
            </p>
          </div>
        </div>
        <SegmentTable label="Role" segments={adminSnapshot.roleSegments} />
      </article>
    </section>
  );
}

function UsersRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">User Analysis</p>
            <h2>User-level activity and rewards</h2>
          </div>
        </div>
        <UsersTable users={adminSnapshot.userInsights} />
      </article>
    </section>
  );
}

function HostsRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Host Ranking</p>
            <h2>Most active hosts</h2>
          </div>
        </div>
        <RankedList items={adminSnapshot.activeHosts} />
      </article>

      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Host Analysis</p>
            <h2>Stats grouped by host</h2>
          </div>
        </div>
        <SegmentTable label="Host" segments={adminSnapshot.hostSegments} />
      </article>
    </section>
  );
}

function RoomsRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <section className="dashboard-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Room Ranking</p>
            <h2>Most active rooms</h2>
          </div>
        </div>
        <RankedList items={adminSnapshot.activeRooms} />
      </article>

      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Room Analysis</p>
            <h2>Stats grouped by room</h2>
          </div>
        </div>
        <SegmentTable label="Room" segments={adminSnapshot.roomSegments} />
      </article>

      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Rooms Table</p>
            <h2>Room, host, assignment, reward, and chain view</h2>
          </div>
        </div>
        <RoomsTable rooms={adminSnapshot.rooms} />
      </article>
    </section>
  );
}

function RewardsRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Rewards</p>
            <h2>XRDM, winners, certificates, and badges</h2>
          </div>
          <Award size={18} />
        </div>
        <HealthPanel items={adminSnapshot.rewardHealth} />
      </article>
    </section>
  );
}

function ChainRoute() {
  const adminSnapshot = useAdminSnapshot();
  const chainHealthItems = adminSnapshot.rewardHealth.filter((item) =>
    ["Confirmed XRDM", "Pending Chain Events", "Failed Chain Events"].includes(item.label),
  );

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Chain Events</p>
            <h2>Blockchain event health</h2>
          </div>
          <CircleAlert size={18} />
        </div>
        <HealthPanel items={chainHealthItems} />
      </article>

      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Room Ledger</p>
            <h2>Chain status by room</h2>
          </div>
          <WalletCards size={18} />
        </div>
        <RoomsTable rooms={adminSnapshot.rooms} />
      </article>
    </section>
  );
}

function OperationsRoute() {
  const adminSnapshot = useAdminSnapshot();

  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operations and Risk</p>
            <h2>Confirmation and ledger signals</h2>
          </div>
          <CircleAlert size={18} />
        </div>
        <HealthPanel items={adminSnapshot.opsHealth} />
      </article>

      <article className="panel panel-wide ops-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Authentication audit coverage</strong>
          <p>
            Failed logins and unauthorized email attempts are not persisted by the
            current server, so this dashboard does not invent counts for them.
          </p>
        </div>
      </article>
    </section>
  );
}

function NotFoundRoute() {
  return (
    <section className="empty-state panel">
      <CircleAlert size={24} />
      <h2>Page not found</h2>
      <p>Choose an available dashboard route from the sidebar.</p>
    </section>
  );
}

function RouteContent({ routeId }: { routeId: DashboardRouteId | null }) {
  switch (routeId) {
    case "overview":
      return <OverviewRoute />;
    case "roles":
      return <RolesRoute />;
    case "users":
      return <UsersRoute />;
    case "hosts":
      return <HostsRoute />;
    case "rooms":
      return <RoomsRoute />;
    case "rewards":
      return <RewardsRoute />;
    case "chain":
      return <ChainRoute />;
    case "operations":
      return <OperationsRoute />;
    default:
      return <NotFoundRoute />;
  }
}

type DashboardAppProps = {
  adminUser: {
    email: string;
    name: string;
  };
  isRefreshing: boolean;
  onRefresh: () => void;
  onSignOut: () => void;
  snapshot: AdminSnapshot;
};

export function DashboardApp({
  adminUser,
  isRefreshing,
  onRefresh,
  onSignOut,
  snapshot: adminSnapshot,
}: DashboardAppProps) {
  const [dateRange, setDateRange] = useState<"today" | "7d">("7d");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [roomFilter, setRoomFilter] = useState("all");
  const [hostFilter, setHostFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRoute, setActiveRoute] = useState<DashboardRoute | null>(() =>
    resolveRoute(window.location.pathname),
  );
  const routeHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasMountedRef = useRef(false);
  const filteredSnapshot = useMemo<AdminSnapshot>(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const selectedRoom = adminSnapshot.rooms.find((room) => room.id === roomFilter);
    const selectedHostRoomNames = new Set(
      adminSnapshot.rooms
        .filter((room) => hostFilter === "all" || room.hostEmail === hostFilter)
        .map((room) => room.name),
    );
    const activityCutoff = new Date();
    activityCutoff.setUTCHours(0, 0, 0, 0);
    if (dateRange === "7d") {
      activityCutoff.setUTCDate(activityCutoff.getUTCDate() - 6);
    }
    const matchesSearch = (...values: string[]) =>
      !normalizedSearch ||
      values.some((value) => value.toLowerCase().includes(normalizedSearch));
    const matchesSelectedRoom = (roomName: string) =>
      !selectedRoom || roomName === selectedRoom.name;
    const matchesSelectedHost = (roomName: string) =>
      hostFilter === "all" || selectedHostRoomNames.has(roomName);
    const matchesActivityScope = (detail: string) =>
      (!selectedRoom || detail.includes(selectedRoom.name)) &&
      (hostFilter === "all" ||
        [...selectedHostRoomNames].some((roomName) => detail.includes(roomName)));

    return {
      ...adminSnapshot,
      movement: dateRange === "today" ? adminSnapshot.movement.slice(-1) : adminSnapshot.movement,
      activity: adminSnapshot.activity.filter(
        (item) =>
          Date.parse(item.time) >= activityCutoff.getTime() &&
          (statusFilter === "all" || item.status === statusFilter) &&
          matchesActivityScope(item.detail) &&
          matchesSearch(item.title, item.detail),
      ),
      rooms: adminSnapshot.rooms.filter(
        (room) =>
          (roomFilter === "all" || room.id === roomFilter) &&
          (hostFilter === "all" || room.hostEmail === hostFilter) &&
          (statusFilter === "all" || room.onchainStatus === statusFilter) &&
          matchesSearch(room.name, room.hostEmail),
      ),
      roomSegments: adminSnapshot.roomSegments.filter(
        (room) =>
          matchesSelectedRoom(room.segment) &&
          matchesSelectedHost(room.segment) &&
          matchesSearch(room.segment),
      ),
      activeRooms: adminSnapshot.activeRooms.filter(
        (room) =>
          matchesSelectedRoom(room.label) &&
          matchesSelectedHost(room.label) &&
          matchesSearch(room.label, room.meta),
      ),
      hostSegments: adminSnapshot.hostSegments.filter(
        (host) =>
          (hostFilter === "all" || host.segment === hostFilter) &&
          matchesSearch(host.segment),
      ),
      activeHosts: adminSnapshot.activeHosts.filter(
        (host) =>
          (hostFilter === "all" || host.label === hostFilter) &&
          matchesSearch(host.label, host.meta),
      ),
      userInsights: adminSnapshot.userInsights.filter(
        (user) =>
          (hostFilter === "all" || user.email === hostFilter) &&
          matchesSearch(user.name, user.email, user.role),
      ),
      rewardHealth: adminSnapshot.rewardHealth.filter(
        (item) => statusFilter === "all" || item.status === statusFilter,
      ),
      opsHealth: adminSnapshot.opsHealth.filter(
        (item) => statusFilter === "all" || item.status === statusFilter,
      ),
    };
  }, [
    adminSnapshot,
    dateRange,
    hostFilter,
    roomFilter,
    searchQuery,
    statusFilter,
  ]);
  const hostOptions = useMemo(
    () => [...new Set(adminSnapshot.rooms.map((room) => room.hostEmail))].sort(),
    [adminSnapshot.rooms],
  );

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", dashboardRoutes[0].path);
    }

    const handlePopState = () => {
      setActiveRoute(resolveRoute(window.location.pathname));
      window.scrollTo({ top: 0 });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = `${activeRoute?.label ?? "Page not found"} | RDM Hack Admin`;

    if (hasMountedRef.current) {
      const focusFrame = window.requestAnimationFrame(() => routeHeadingRef.current?.focus());
      return () => window.cancelAnimationFrame(focusFrame);
    }

    hasMountedRef.current = true;
  }, [activeRoute]);

  function handleRouteChange(event: ReactMouseEvent<HTMLAnchorElement>, route: DashboardRoute) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    if (window.location.pathname !== route.path) {
      window.history.pushState({}, "", route.path);
      setActiveRoute(route);
      window.scrollTo({ top: 0 });
    }
  }

  return (
    <AdminSnapshotContext.Provider value={filteredSnapshot}>
      <div className="app-shell">
        <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">R</span>
          <span>
            <strong>RDM Hack</strong>
            <small>Admin Console</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Admin dashboard routes">
          <p className="sidebar-label">Workspace</p>
          {dashboardRoutes.map((route) => {
            const Icon = route.icon;

            return (
              <a
                aria-current={activeRoute?.id === route.id ? "page" : undefined}
                className={activeRoute?.id === route.id ? "active" : undefined}
                href={route.path}
                key={route.id}
                onClick={(event) => handleRouteChange(event, route)}
              >
                <Icon size={17} />
                <span>
                  <strong>{route.label}</strong>
                  <small>{route.detail}</small>
                </span>
              </a>
            );
          })}
        </nav>

          <div className="sidebar-footer">
            <span className="readonly-dot" />
            <span>
              <strong>Read-only mode</strong>
              <small>Production monitoring</small>
            </span>
          </div>

          <div className="sidebar-account">
            <div>
              <strong>{adminUser.name}</strong>
              <small>{adminUser.email}</small>
            </div>
            <button onClick={onSignOut} title="Sign out" type="button">
              <LogOut size={16} />
            </button>
          </div>
        </aside>

        <main className="admin-shell">
        <header className="topbar">
          <div className="route-heading">
            <p className="eyebrow">Founder Dashboard</p>
            <h1 ref={routeHeadingRef} tabIndex={-1}>
              {activeRoute?.label ?? "Page not found"}
            </h1>
            <p>
              {activeRoute?.description ??
                "This address does not match an available admin dashboard route."}
            </p>
          </div>
          <div className="topbar-actions">
            <button
              className="refresh-button"
              disabled={isRefreshing}
              onClick={onRefresh}
              title="Refresh dashboard data"
              type="button"
            >
              <RefreshCw className={isRefreshing ? "spinning" : undefined} size={16} />
            </button>
            <div className="server-pill">
              <Radio size={15} />
              <span>Live data</span>
            </div>
          </div>
        </header>

        <section className="toolbar" aria-label="Dashboard filters">
          <label>
            Activity range
            <select
              onChange={(event) => setDateRange(event.target.value as "today" | "7d")}
              value={dateRange}
            >
              <option value="today">Today (UTC)</option>
              <option value="7d">Last 7 days</option>
            </select>
          </label>
          <label>
            Status
            <select
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | Status)
              }
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label>
            Room
            <select
              onChange={(event) => setRoomFilter(event.target.value)}
              value={roomFilter}
            >
              <option value="all">All rooms</option>
              {adminSnapshot.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Host
            <select
              onChange={(event) => setHostFilter(event.target.value)}
              value={hostFilter}
            >
              <option value="all">All hosts</option>
              {hostOptions.map((host) => (
                <option key={host} value={host}>
                  {host}
                </option>
              ))}
            </select>
          </label>
          <label className="search-box">
            Search
            <span>
              <Search size={15} />
              <input
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Room, host, email, role"
                value={searchQuery}
              />
            </span>
          </label>
        </section>

        <section className="notice">
          <Gauge size={18} />
          <p>
            Authorized read-only monitoring. Data refreshes from the production analytics endpoint;
            no create, update, delete, or blockchain transaction controls are available.
          </p>
        </section>

        <div className="route-content" key={activeRoute?.id ?? "not-found"}>
          <RouteContent routeId={activeRoute?.id ?? null} />
        </div>
        </main>
      </div>
    </AdminSnapshotContext.Provider>
  );
}
