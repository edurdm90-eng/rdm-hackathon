import type { AdminDashboardData } from "./api";

export type AdminSnapshot = AdminDashboardData & {
  serverUrl: string;
};

export type Status = AdminDashboardData["rooms"][number]["onchainStatus"];
export type Kpi = AdminDashboardData["kpis"][number];
export type Activity = AdminDashboardData["activity"][number];
export type RoomRow = AdminDashboardData["rooms"][number];
export type MovementPoint = AdminDashboardData["movement"][number];
export type RankedItem = AdminDashboardData["activeRooms"][number];
export type HealthItem = AdminDashboardData["rewardHealth"][number];
export type SegmentMetric = AdminDashboardData["roleSegments"][number];
export type UserInsight = AdminDashboardData["userInsights"][number];
