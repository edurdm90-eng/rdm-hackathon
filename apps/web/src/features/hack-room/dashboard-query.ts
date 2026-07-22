import { trpc } from "@/utils/trpc";

const dashboardRefetchIntervalMs = 30_000 + Math.floor(Math.random() * 10_000);
const dashboardStaleTimeMs = 15_000;
const dashboardCacheTimeMs = 5 * 60_000;

export function dashboardQueryOptions(options: { enabled?: boolean } = {}) {
  return {
    ...trpc.hackRoom.dashboard.queryOptions(),
    enabled: options.enabled,
    gcTime: dashboardCacheTimeMs,
    refetchInterval: dashboardRefetchIntervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(1_000 * 2 ** attemptIndex, 8_000),
    staleTime: dashboardStaleTimeMs,
  };
}
