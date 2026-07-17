import type { AppRouter } from "@rdm-hack/api/routers/index";
import { env } from "@rdm-hack/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { toast } from "sonner";

import { getPrivyAccessToken } from "@/lib/privy-session";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
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
      url: `${env.VITE_SERVER_URL}/trpc`,
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
