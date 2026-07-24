import { privyClient, type PrivyExchangeInput, type PrivyExchangeResponse } from "@rdm-hack/auth/client";
import { createAuthClient } from "better-auth/react";
import { useEffect, useState } from "react";

import {
  clearStoredPrivySession,
  getPrivyAccessToken,
  readStoredPrivySession,
  type AppPrivySession,
} from "./privy-session";
import { serverUrl } from "./server-url";

const authBaseUrl = `${serverUrl}/api/auth`;

const betterAuthClient = createAuthClient({
  baseURL: authBaseUrl,
  plugins: [privyClient()],
});

type AuthClientResult<T> = {
  data: T | null;
  error: {
    code?: string;
    message?: string;
    status: number;
    statusText?: string;
  } | null;
};

type SessionResponse = {
  data: AppPrivySession | null;
};

async function exchangePrivySession(
  input: PrivyExchangeInput,
): Promise<AuthClientResult<PrivyExchangeResponse>> {
  try {
    const response = await fetch(`${authBaseUrl}/privy/exchange`, {
      body: JSON.stringify(input),
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      let message = response.statusText || "Unable to create a server session from Privy.";
      let code: string | undefined;
      try {
        const body = await response.json();
        if (typeof body?.code === "string") {
          code = body.code;
        }
        if (typeof body?.message === "string") {
          message = body.message;
        } else if (typeof body?.error === "string") {
          message = body.error;
        }
      } catch {
        // Keep the HTTP status text when the server does not send JSON.
      }

      return {
        data: null,
        error: {
          code,
          message,
          status: response.status,
          statusText: response.statusText,
        },
      };
    }

    return {
      data: (await response.json()) as PrivyExchangeResponse,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: {
        message:
          error instanceof TypeError
            ? "Could not reach the deployed auth server. Check server URL, CORS, and deployment env."
            : error instanceof Error
              ? error.message
              : "Could not reach the deployed auth server.",
        status: 0,
        statusText: "FETCH_FAILED",
      },
    };
  }
}

async function getSession(): Promise<SessionResponse> {
  const privySession = readStoredPrivySession();

  if (privySession) {
    return { data: privySession };
  }

  return { data: null };
}

export const authClient = Object.assign(betterAuthClient, {
  getAccessToken: async () => getPrivyAccessToken(),
  getSession,
  privy: {
    ...betterAuthClient.privy,
    exchange: exchangePrivySession,
  },
  signOut: async (options?: Parameters<typeof betterAuthClient.signOut>[0]) => {
    clearStoredPrivySession();
    return betterAuthClient.signOut(options);
  },
  useSession: () => {
    const [session, setSession] = useState<SessionResponse["data"]>(() => readStoredPrivySession());

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
      data: session,
      isPending: false,
    };
  },
});
