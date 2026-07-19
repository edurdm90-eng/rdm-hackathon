import {
  getEmbeddedConnectedWallet,
  PrivyProvider,
  useCreateWallet,
  useLoginWithEmail,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  PrivyAuthContext,
  PrivyWalletContext,
  type PrivyLoginOptions,
} from "@/components/privy-provider";
import { getWebPrivyAppId } from "@/lib/privy-config";
import {
  clearStoredPrivySession,
  setPrivyAccessToken,
  writeStoredPrivySession,
} from "@/lib/privy-session";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

function getUserEmail(user: NonNullable<ReturnType<typeof usePrivy>["user"]>) {
  return (
    user.email?.address ??
    user.google?.email ??
    user.discord?.email ??
    `${user.id}@privy.rdm`
  ).toLowerCase();
}

function getUserName(user: NonNullable<ReturnType<typeof usePrivy>["user"]>) {
  return (
    user.google?.name ??
    user.discord?.username ??
    user.email?.address?.split("@")[0] ??
    "Privy User"
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function PrivySessionBridge({ children }: { children: ReactNode }) {
  const { authenticated, getAccessToken, login, logout: privyLogout, ready, user } = usePrivy();
  const {
    loginWithCode,
    sendCode,
    state: emailLoginState,
  } = useLoginWithEmail({
    onError: (error) => {
      const unknownError: unknown = error;
      const message =
        typeof unknownError === "object" && unknownError !== null && "message" in unknownError
          ? String(unknownError.message)
          : "Unable to complete email login.";
      toast.error(message);
    },
  });
  const { createWallet } = useCreateWallet();
  const { ready: walletsReady, wallets } = useWallets();
  const [hasSyncedSession, setHasSyncedSession] = useState(false);
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [sessionSyncError, setSessionSyncError] = useState<string | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const walletAddress = embeddedWallet?.address ?? null;

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!authenticated || !user) {
      setHasSyncedSession(false);
      setIsSyncingSession(false);
      setSessionSyncError(null);
      clearStoredPrivySession();
      void queryClient.invalidateQueries();
      return;
    }

    const currentUser = user;
    let active = true;

    async function syncPrivySession() {
      setHasSyncedSession(false);
      setIsSyncingSession(true);
      setSessionSyncError(null);
      const token = await getAccessToken();

      if (!active) {
        return;
      }

      setPrivyAccessToken(token ?? null);

      if (!token) {
        throw new Error("Privy did not return an access token for this login.");
      }

      const exchangeResult = await withTimeout(
        authClient.privy.exchange({
          accessToken: token,
        }),
        15_000,
        "Server did not finish Privy session exchange. Check deployed server auth env and logs.",
      );

      if (exchangeResult.error) {
        throw new Error(
          exchangeResult.error.message ??
            exchangeResult.error.statusText ??
            "Unable to create a Better Auth session from Privy.",
        );
      }

      writeStoredPrivySession({
        session: {
          id: `privy_session_${currentUser.id}`,
        },
        user: {
          email: getUserEmail(currentUser),
          id: currentUser.id,
          name: getUserName(currentUser),
          privyUserId: currentUser.id,
          walletAddress: walletAddress ?? undefined,
        },
      });
      setHasSyncedSession(true);
      setSessionSyncError(null);
      await queryClient.invalidateQueries();
    }

    void syncPrivySession().catch((error) => {
      const message = error instanceof Error ? error.message : "Unable to sync Privy session.";
      setHasSyncedSession(false);
      setSessionSyncError(message);
      toast.error(message);
    }).finally(() => {
      if (active) {
        setIsSyncingSession(false);
      }
    });

    return () => {
      active = false;
    };
  }, [authenticated, getAccessToken, ready, user, walletAddress]);

  useEffect(() => {
    if (!ready || !walletsReady || !authenticated || !user || walletAddress || isCreatingWallet) {
      return;
    }

    let active = true;
    setIsCreatingWallet(true);
    setWalletError(null);

    void createWallet()
      .catch((error) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Unable to create a Privy wallet.";
        setWalletError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) {
          setIsCreatingWallet(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authenticated, createWallet, isCreatingWallet, ready, user, walletAddress, walletsReady]);

  const authValue = useMemo(
    () => ({
      authenticated: authenticated && hasSyncedSession,
      configurationError: null,
      emailLoginStatus: emailLoginState.status,
      isSyncingSession: authenticated && isSyncingSession,
      loginWithEmailCode: async (code: string) => {
        await loginWithCode({ code });
      },
      login: async (options?: PrivyLoginOptions) => {
        await login(options as Parameters<typeof login>[0]);
      },
      logout: async () => {
        setHasSyncedSession(false);
        setIsSyncingSession(false);
        setSessionSyncError(null);
        clearStoredPrivySession();
        await queryClient.cancelQueries();
        queryClient.clear();
        await Promise.allSettled([privyLogout(), authClient.signOut()]);
      },
      ready,
      sendEmailCode: async (email: string) => {
        await sendCode({ email });
      },
      sessionSyncError,
    }),
    [
      authenticated,
      emailLoginState.status,
      hasSyncedSession,
      isSyncingSession,
      login,
      loginWithCode,
      privyLogout,
      ready,
      sendCode,
      sessionSyncError,
    ],
  );

  const walletValue = useMemo(
    () => ({
      isCreatingWallet,
      walletAddress,
      walletError,
    }),
    [isCreatingWallet, walletAddress, walletError],
  );

  return (
    <PrivyAuthContext.Provider value={authValue}>
      <PrivyWalletContext.Provider value={walletValue}>{children}</PrivyWalletContext.Provider>
    </PrivyAuthContext.Provider>
  );
}

export function ClientWebPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={getWebPrivyAppId()}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        loginMethods: ["email", "google"],
      }}
    >
      <PrivySessionBridge>{children}</PrivySessionBridge>
    </PrivyProvider>
  );
}
