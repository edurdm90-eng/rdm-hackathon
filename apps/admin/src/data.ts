export type Status = "confirmed" | "pending" | "failed";

export type Kpi = {
  label: string;
  value: string;
  detail: string;
  trend: string;
  tone: "green" | "blue" | "amber" | "red" | "violet";
};

export type Activity = {
  id: string;
  kind: "join" | "room" | "submission" | "approval" | "reward" | "certificate" | "winner" | "badge";
  title: string;
  detail: string;
  time: string;
  status: Status;
};

export type RoomRow = {
  id: string;
  name: string;
  hostEmail: string;
  participants: number;
  assignments: number;
  submissions: number;
  rewardsIssued: number;
  createdDate: string;
  onchainStatus: Status;
};

export type MovementPoint = {
  day: string;
  users: number;
  joins: number;
  submissions: number;
};

export type RankedItem = {
  label: string;
  value: number;
  meta: string;
};

export type HealthItem = {
  label: string;
  value: string;
  status: Status;
  detail: string;
};

export type SegmentMetric = {
  segment: string;
  users: number;
  rooms: number;
  joins: number;
  submissions: number;
  approvals: number;
  winners: number;
  xrdm: number;
};

export type UserInsight = {
  id: string;
  name: string;
  email: string;
  role: "host" | "member";
  roomsHosted: number;
  roomsJoined: number;
  submissions: number;
  approvals: number;
  rewards: number;
  xrdm: number;
  lastSignal: string;
};

export type AdminSnapshot = {
  generatedAt: string;
  serverUrl: string;
  dataMode: "demo" | "live";
  kpis: Kpi[];
  activity: Activity[];
  rooms: RoomRow[];
  movement: MovementPoint[];
  activeRooms: RankedItem[];
  activeHosts: RankedItem[];
  rewardHealth: HealthItem[];
  roleSegments: SegmentMetric[];
  hostSegments: SegmentMetric[];
  roomSegments: SegmentMetric[];
  userInsights: UserInsight[];
};

const serverUrl = (import.meta.env.VITE_SERVER_URL ?? "").replace(/\/+$/, "");

export const adminSnapshot: AdminSnapshot = {
  generatedAt: new Date().toISOString(),
  serverUrl,
  dataMode: "demo",
  kpis: [
    {
      label: "Total Users",
      value: "1,248",
      detail: "Across hosts and participants",
      trend: "+18.4% this week",
      tone: "blue",
    },
    {
      label: "Active Today",
      value: "312",
      detail: "Session-based activity view",
      trend: "+42 since yesterday",
      tone: "green",
    },
    {
      label: "Total Rooms",
      value: "86",
      detail: "72 confirmed on-chain",
      trend: "+9 new rooms",
      tone: "violet",
    },
    {
      label: "Submissions",
      value: "3,941",
      detail: "2,806 approved submissions",
      trend: "71.2% approval rate",
      tone: "green",
    },
    {
      label: "XRDM Awarded",
      value: "184,500",
      detail: "Confirmed rewards only",
      trend: "+22,400 today",
      tone: "amber",
    },
    {
      label: "Certificates",
      value: "1,036",
      detail: "Participant and winner certificates",
      trend: "+126 issued",
      tone: "blue",
    },
    {
      label: "NFT Badges",
      value: "214",
      detail: "Winner badge ledger records",
      trend: "18 pending",
      tone: "violet",
    },
    {
      label: "Chain Events",
      value: "97.8%",
      detail: "Confirmed event success rate",
      trend: "8 pending, 3 failed",
      tone: "green",
    },
  ],
  activity: [
    {
      id: "act-1",
      kind: "reward",
      title: "XRDM reward confirmed",
      detail: "Team NeuralForge received 3,500 XRDM in AI Agents Sprint.",
      time: "2 min ago",
      status: "confirmed",
    },
    {
      id: "act-2",
      kind: "submission",
      title: "New proof submitted",
      detail: "Riya Sharma submitted GitHub and deck proofs for Wallet UX Challenge.",
      time: "8 min ago",
      status: "pending",
    },
    {
      id: "act-3",
      kind: "join",
      title: "Participant joined room",
      detail: "5 new participants joined Zero Knowledge Lab.",
      time: "14 min ago",
      status: "confirmed",
    },
    {
      id: "act-4",
      kind: "winner",
      title: "Winner selected",
      detail: "DataPulse was marked winner by host kavya@rdm.io.",
      time: "21 min ago",
      status: "confirmed",
    },
    {
      id: "act-5",
      kind: "badge",
      title: "NFT badge pending",
      detail: "Winner badge mint is waiting for chain confirmation.",
      time: "29 min ago",
      status: "pending",
    },
    {
      id: "act-6",
      kind: "room",
      title: "Room created",
      detail: "New room Climate Buildathon was created and confirmed on-chain.",
      time: "36 min ago",
      status: "confirmed",
    },
  ],
  rooms: [
    {
      id: "room-1",
      name: "AI Agents Sprint",
      hostEmail: "kavya@rdm.io",
      participants: 182,
      assignments: 14,
      submissions: 498,
      rewardsIssued: 46,
      createdDate: "Jul 24, 2026",
      onchainStatus: "confirmed",
    },
    {
      id: "room-2",
      name: "Wallet UX Challenge",
      hostEmail: "arjun@rdm.io",
      participants: 141,
      assignments: 11,
      submissions: 386,
      rewardsIssued: 31,
      createdDate: "Jul 23, 2026",
      onchainStatus: "confirmed",
    },
    {
      id: "room-3",
      name: "Zero Knowledge Lab",
      hostEmail: "mira@rdm.io",
      participants: 96,
      assignments: 9,
      submissions: 211,
      rewardsIssued: 18,
      createdDate: "Jul 22, 2026",
      onchainStatus: "pending",
    },
    {
      id: "room-4",
      name: "Climate Buildathon",
      hostEmail: "dev@rdm.io",
      participants: 78,
      assignments: 7,
      submissions: 174,
      rewardsIssued: 12,
      createdDate: "Jul 21, 2026",
      onchainStatus: "confirmed",
    },
    {
      id: "room-5",
      name: "DeFi Security Drill",
      hostEmail: "nisha@rdm.io",
      participants: 64,
      assignments: 6,
      submissions: 129,
      rewardsIssued: 9,
      createdDate: "Jul 19, 2026",
      onchainStatus: "failed",
    },
  ],
  movement: [
    { day: "Jul 18", users: 38, joins: 92, submissions: 148 },
    { day: "Jul 19", users: 44, joins: 120, submissions: 201 },
    { day: "Jul 20", users: 59, joins: 148, submissions: 238 },
    { day: "Jul 21", users: 52, joins: 132, submissions: 254 },
    { day: "Jul 22", users: 73, joins: 184, submissions: 319 },
    { day: "Jul 23", users: 81, joins: 211, submissions: 374 },
    { day: "Jul 24", users: 96, joins: 236, submissions: 421 },
  ],
  activeRooms: [
    { label: "AI Agents Sprint", value: 498, meta: "182 participants" },
    { label: "Wallet UX Challenge", value: 386, meta: "141 participants" },
    { label: "Zero Knowledge Lab", value: 211, meta: "96 participants" },
    { label: "Climate Buildathon", value: 174, meta: "78 participants" },
  ],
  activeHosts: [
    { label: "kavya@rdm.io", value: 14, meta: "46 rewards issued" },
    { label: "arjun@rdm.io", value: 11, meta: "31 rewards issued" },
    { label: "mira@rdm.io", value: 9, meta: "18 rewards issued" },
    { label: "dev@rdm.io", value: 7, meta: "12 rewards issued" },
  ],
  rewardHealth: [
    {
      label: "Confirmed XRDM",
      value: "184,500",
      status: "confirmed",
      detail: "Submission and room rewards confirmed on Polygon Amoy.",
    },
    {
      label: "Pending Chain Events",
      value: "8",
      status: "pending",
      detail: "Waiting for room, reward, or badge confirmations.",
    },
    {
      label: "Failed Chain Events",
      value: "3",
      status: "failed",
      detail: "Needs host follow-up before reward ledger is complete.",
    },
    {
      label: "Winners",
      value: "328",
      status: "confirmed",
      detail: "Submissions marked as winner by hosts.",
    },
    {
      label: "Certificates",
      value: "1,036",
      status: "confirmed",
      detail: "Participant and winner certificates issued.",
    },
    {
      label: "NFT Badges",
      value: "214",
      status: "pending",
      detail: "196 confirmed, 18 awaiting mint confirmation.",
    },
  ],
  roleSegments: [
    {
      segment: "Host",
      users: 42,
      rooms: 86,
      joins: 0,
      submissions: 0,
      approvals: 2806,
      winners: 328,
      xrdm: 184500,
    },
    {
      segment: "Member",
      users: 1206,
      rooms: 0,
      joins: 3480,
      submissions: 3941,
      approvals: 2806,
      winners: 328,
      xrdm: 184500,
    },
  ],
  hostSegments: [
    {
      segment: "kavya@rdm.io",
      users: 182,
      rooms: 14,
      joins: 612,
      submissions: 498,
      approvals: 384,
      winners: 52,
      xrdm: 38500,
    },
    {
      segment: "arjun@rdm.io",
      users: 141,
      rooms: 11,
      joins: 438,
      submissions: 386,
      approvals: 291,
      winners: 43,
      xrdm: 29100,
    },
    {
      segment: "mira@rdm.io",
      users: 96,
      rooms: 9,
      joins: 304,
      submissions: 211,
      approvals: 166,
      winners: 28,
      xrdm: 16800,
    },
    {
      segment: "dev@rdm.io",
      users: 78,
      rooms: 7,
      joins: 226,
      submissions: 174,
      approvals: 122,
      winners: 18,
      xrdm: 12400,
    },
  ],
  roomSegments: [
    {
      segment: "AI Agents Sprint",
      users: 182,
      rooms: 1,
      joins: 612,
      submissions: 498,
      approvals: 384,
      winners: 52,
      xrdm: 38500,
    },
    {
      segment: "Wallet UX Challenge",
      users: 141,
      rooms: 1,
      joins: 438,
      submissions: 386,
      approvals: 291,
      winners: 43,
      xrdm: 29100,
    },
    {
      segment: "Zero Knowledge Lab",
      users: 96,
      rooms: 1,
      joins: 304,
      submissions: 211,
      approvals: 166,
      winners: 28,
      xrdm: 16800,
    },
    {
      segment: "Climate Buildathon",
      users: 78,
      rooms: 1,
      joins: 226,
      submissions: 174,
      approvals: 122,
      winners: 18,
      xrdm: 12400,
    },
  ],
  userInsights: [
    {
      id: "user-1",
      name: "Kavya Rao",
      email: "kavya@rdm.io",
      role: "host",
      roomsHosted: 14,
      roomsJoined: 0,
      submissions: 0,
      approvals: 384,
      rewards: 46,
      xrdm: 38500,
      lastSignal: "Approved submission 12 min ago",
    },
    {
      id: "user-2",
      name: "Riya Sharma",
      email: "riya@student.dev",
      role: "member",
      roomsHosted: 0,
      roomsJoined: 6,
      submissions: 18,
      approvals: 13,
      rewards: 4,
      xrdm: 4200,
      lastSignal: "Submitted proof 8 min ago",
    },
    {
      id: "user-3",
      name: "Arjun Mehta",
      email: "arjun@rdm.io",
      role: "host",
      roomsHosted: 11,
      roomsJoined: 1,
      submissions: 2,
      approvals: 291,
      rewards: 31,
      xrdm: 29100,
      lastSignal: "Issued reward 26 min ago",
    },
    {
      id: "user-4",
      name: "Nikhil Sen",
      email: "nikhil@builders.dev",
      role: "member",
      roomsHosted: 0,
      roomsJoined: 5,
      submissions: 14,
      approvals: 11,
      rewards: 3,
      xrdm: 3600,
      lastSignal: "Winner badge pending",
    },
  ],
};
