import type { AppRouter } from "@rdm-hack/api/routers/index";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { getPrivyAccessToken } from "@/lib/privy-session";
import { serverUrl } from "@/lib/server-url";

const queryErrorToastCooldownMs = 30_000;
const lastQueryErrorToastAt = new Map<string, number>();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 8_000),
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const now = Date.now();
      const lastToastAt = lastQueryErrorToastAt.get(query.queryHash) ?? 0;

      if (now - lastToastAt < queryErrorToastCooldownMs) {
        return;
      }

      lastQueryErrorToastAt.set(query.queryHash, now);

      const message =
        error.message === "Failed to fetch"
          ? "API server is not reachable. Check the deployed server URL and server env."
          : error.message;

      toast.error(message, {
        action: {
          label: "retry",
          onClick: () => {
            query.invalidate();
          },
        },
      });
    },
  }),
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${serverUrl}/trpc`,
      fetch(url, options) {
        const headers = new Headers(options?.headers);
        const accessToken = getPrivyAccessToken();

        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }

        return fetch(url, {
          ...options,
          credentials: "include",
          headers,
        });
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
