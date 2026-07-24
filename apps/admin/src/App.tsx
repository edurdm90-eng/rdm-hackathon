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
  Medal,
  Radio,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import {
  adminSnapshot,
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
  const maxValue = Math.max(...points.flatMap((point) => [point.users, point.joins, point.submissions]));

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
  const maxValue = Math.max(...items.map((item) => item.value));

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
            <time>{item.time}</time>
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
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>
                <strong>{room.name}</strong>
              </td>
              <td>{room.hostEmail}</td>
              <td>{room.participants}</td>
              <td>{room.assignments}</td>
              <td>{room.submissions}</td>
              <td>{room.rewardsIssued}</td>
              <td>{room.createdDate}</td>
              <td>
                <span className={statusClass(room.onchainStatus)}>{statusLabels[room.onchainStatus]}</span>
              </td>
            </tr>
          ))}
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
          {segments.map((segment) => (
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
          ))}
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
          {users.map((user) => (
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
              <td>{user.lastSignal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthPanel({ items }: { items: HealthItem[] }) {
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
  return (
    <section className="dashboard-grid">
      <article className="panel panel-wide">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Role Analysis</p>
            <h2>Stats by role</h2>
          </div>
        </div>
        <SegmentTable label="Role" segments={adminSnapshot.roleSegments} />
      </article>
    </section>
  );
}

function UsersRoute() {
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
    default:
      return <NotFoundRoute />;
  }
}

export function App() {
  const [activeRoute, setActiveRoute] = useState<DashboardRoute | null>(() =>
    resolveRoute(window.location.pathname),
  );
  const routeHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasMountedRef = useRef(false);

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
          <div className="server-pill">
            <Radio size={15} />
            <span>{adminSnapshot.serverUrl || "Server URL missing"}</span>
          </div>
        </header>

        <section className="toolbar" aria-label="Dashboard filters">
          <label>
            Date range
            <select defaultValue="7d">
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </label>
          <label>
            Status
            <select defaultValue="all">
              <option value="all">All statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label>
            Room
            <select defaultValue="all">
              <option value="all">All rooms</option>
              {adminSnapshot.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="search-box">
            Search
            <span>
              <Search size={15} />
              <input placeholder="Room, host, wallet, team" />
            </span>
          </label>
        </section>

        <section className="notice">
          <Gauge size={18} />
          <p>
            Read-only v1 interface. No create, update, delete, or blockchain transaction controls are
            included. The current build is wired to the server URL and uses demo analytics until a
            protected read-only analytics endpoint is available.
          </p>
        </section>

        <div className="route-content" key={activeRoute?.id ?? "not-found"}>
          <RouteContent routeId={activeRoute?.id ?? null} />
        </div>
      </main>
    </div>
  );
}
