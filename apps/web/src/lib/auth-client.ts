import { env } from "@rdm-hack/env/web";
import { createAuthClient } from "better-auth/react";
import { useEffect, useState } from "react";

import {
  clearStoredPrivySession,
  getPrivyAccessToken,
  readStoredPrivySession,
  type AppPrivySession,
} from "./privy-session";

const betterAuthClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
});

type SessionResponse = {
  data: AppPrivySession | NonNullable<Awaited<ReturnType<typeof betterAuthClient.getSession>>["data"]> | null;
};

async function getSession(): Promise<SessionResponse> {
  const privySession = readStoredPrivySession();

  if (privySession) {
    return { data: privySession };
  }

  return betterAuthClient.getSession();
}

export const authClient = {
  ...betterAuthClient,
  getAccessToken: async () => getPrivyAccessToken(),
  getSession,
  signOut: async (options?: Parameters<typeof betterAuthClient.signOut>[0]) => {
    clearStoredPrivySession();
    return betterAuthClient.signOut(options);
  },
  useSession: () => {
    const [session, setSession] = useState<SessionResponse["data"]>(() => readStoredPrivySession());
    const betterAuthSession = betterAuthClient.useSession();

    useEffect(() => {
      function syncPrivySession() {
        setSession(readStoredPrivySession());
      }

      window.addEventListener("rdm-privy-session-change", syncPrivySession);
      window.addEventListener("storage", syncPrivySession);

      return () => {
        window.removeEventListener("rdm-privy-session-change", syncPrivySession);
        window.removeEventListener("storage", syncPrivySession);
      };
    }, []);

    return {
      data: session ?? betterAuthSession.data,
      isPending: betterAuthSession.isPending,
    };
  },
};
