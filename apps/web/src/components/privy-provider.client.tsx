import {
  getEmbeddedConnectedWallet,
  PrivyProvider,
  useCreateWallet,
  useLoginWithEmail,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { SmartWalletsProvider, useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import {
  PrivyAuthContext,
  PrivyWalletContext,
  type PrivyLoginOptions,
} from "@/components/privy-provider";
import { getWebPrivyAppId } from "@/lib/privy-config";
import {
  beginPrivySignOut,
  clearBrowserAuthStorageForSignOut,
  clearPrivySignOut,
  clearStoredPrivySession,
  isPrivySignOutPending,
  setPrivyAccessToken,
  writeStoredPrivySession,
} from "@/lib/privy-session";
import { polygonAmoyChain } from "@/features/hack-room/blockchain";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

const syncedWalletKeys = new Set<string>();
const walletSyncRetryDelaysMs = [0, 800, 1_600, 3_200, 6_400, 10_000] as const;
const signOutRedirectUrl = "/login?signout=1";

function waitForWalletSyncRetry(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

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
  const { client: readySmartWalletClient, getClientForChain } = useSmartWallets();
  const syncWallets = useMutation(trpc.hackRoom.syncWallets.mutationOptions());
  const [hasSyncedSession, setHasSyncedSession] = useState(false);
  const [isSyncingSession, setIsSyncingSession] = useState(false);
  const [sessionSyncError, setSessionSyncError] = useState<string | null>(null);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const isSigningOutRef = useRef(false);
  const signOutRunIdRef = useRef(0);
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const walletAddress = embeddedWallet?.address ?? null;

  function beginFreshLoginAttempt() {
    signOutRunIdRef.current += 1;
    isSigningOutRef.current = false;
    clearPrivySignOut();
  }

  function finishSignOutCleanup(signOutRunId: number) {
    if (signOutRunIdRef.current === signOutRunId && isPrivySignOutPending()) {
      clearBrowserAuthStorageForSignOut();
    }
  }

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (isSigningOutRef.current || isPrivySignOutPending()) {
      isSigningOutRef.current = true;
      if (signOutRunIdRef.current === 0) {
        signOutRunIdRef.current = 1;
      }
      const signOutRunId = signOutRunIdRef.current;
      setHasSyncedSession(false);
      setIsSyncingSession(false);
      setSessionSyncError(null);
      clearBrowserAuthStorageForSignOut();
      if (authenticated) {
        void Promise.allSettled([
          withTimeout(Promise.resolve(privyLogout()), 5_000, "Privy logout timed out."),
          withTimeout(Promise.resolve(authClient.signOut()), 5_000, "Server logout timed out."),
        ]).finally(() => {
          finishSignOutCleanup(signOutRunId);
        });
      }
      return;
    }

    if (!authenticated || !user) {
      isSigningOutRef.current = false;
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

  useEffect(() => {
    if (!authenticated || !hasSyncedSession || !user || !walletAddress || syncWallets.isPending) {
      return;
    }

    let active = true;
    const sessionUser = user;
    const embeddedWalletAddress = walletAddress;

    async function syncWalletsForUser() {
      const embeddedSyncKey = `${sessionUser.id}:${embeddedWalletAddress}:embedded`;

      if (!syncedWalletKeys.has(embeddedSyncKey)) {
        syncedWalletKeys.add(embeddedSyncKey);
        await syncWallets.mutateAsync({
          embeddedWalletAddress,
        });
        await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
      }

      for (const delayMs of walletSyncRetryDelaysMs) {
        if (!active) {
          return;
        }

        if (delayMs > 0) {
          await waitForWalletSyncRetry(delayMs);
        }

        let smartWalletAddress = "";

        try {
          const smartWalletClient =
            readySmartWalletClient ??
            (await getClientForChain({
              id: polygonAmoyChain.id,
            }));

          if (!smartWalletClient) {
            continue;
          }

          smartWalletAddress = (smartWalletClient.account?.address ?? "").toString();
        } catch {
          continue;
        }

        if (!smartWalletAddress) {
          continue;
        }

        const smartSyncKey = `${sessionUser.id}:${embeddedWalletAddress}:${smartWalletAddress}`;
        if (syncedWalletKeys.has(smartSyncKey) || !active) {
          return;
        }

        syncedWalletKeys.add(smartSyncKey);
        await syncWallets.mutateAsync({
          embeddedWalletAddress,
          smartWalletAddress,
        });
        await queryClient.invalidateQueries({ queryKey: trpc.hackRoom.dashboard.queryKey() });
        return;
      }
    }

    void syncWalletsForUser().catch(() => {
      syncedWalletKeys.delete(`${sessionUser.id}:${embeddedWalletAddress}:embedded`);
    });

    return () => {
      active = false;
    };
  }, [
    authenticated,
    getClientForChain,
    hasSyncedSession,
    readySmartWalletClient,
    syncWallets,
    user,
    walletAddress,
  ]);

  const authValue = useMemo(
    () => ({
      authenticated: authenticated && hasSyncedSession,
      configurationError: null,
      emailLoginStatus: emailLoginState.status,
      isSyncingSession: authenticated && isSyncingSession,
      loginWithEmailCode: async (code: string) => {
        beginFreshLoginAttempt();
        await loginWithCode({ code });
      },
      login: async (options?: PrivyLoginOptions) => {
        beginFreshLoginAttempt();
        await login(options as Parameters<typeof login>[0]);
      },
      logout: async () => {
        const signOutRunId = signOutRunIdRef.current + 1;
        signOutRunIdRef.current = signOutRunId;
        isSigningOutRef.current = true;
        setHasSyncedSession(false);
        setIsSyncingSession(false);
        setSessionSyncError(null);
        syncedWalletKeys.clear();
        beginPrivySignOut();
        await queryClient.cancelQueries().catch(() => {});
        queryClient.clear();
        await Promise.allSettled([
          withTimeout(Promise.resolve(privyLogout()), 5_000, "Privy logout timed out."),
          withTimeout(Promise.resolve(authClient.signOut()), 5_000, "Server logout timed out."),
        ]);
        finishSignOutCleanup(signOutRunId);
      },
      logoutAndRedirect: async () => {
        const signOutRunId = signOutRunIdRef.current + 1;
        signOutRunIdRef.current = signOutRunId;
        isSigningOutRef.current = true;
        setHasSyncedSession(false);
        setIsSyncingSession(false);
        setSessionSyncError(null);
        syncedWalletKeys.clear();
        beginPrivySignOut();
        clearBrowserAuthStorageForSignOut();
        await queryClient.cancelQueries().catch(() => {});
        queryClient.clear();
        void Promise.allSettled([
          withTimeout(Promise.resolve(privyLogout()), 5_000, "Privy logout timed out."),
          withTimeout(Promise.resolve(authClient.signOut()), 5_000, "Server logout timed out."),
        ]).finally(() => {
          finishSignOutCleanup(signOutRunId);
        });
        window.location.replace(signOutRedirectUrl);
      },
      ready,
      sendEmailCode: async (email: string) => {
        beginFreshLoginAttempt();
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
        defaultChain: polygonAmoyChain,
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        loginMethods: ["email", "google"],
        supportedChains: [polygonAmoyChain],
      }}
    >
      <SmartWalletsProvider>
        <PrivySessionBridge>{children}</PrivySessionBridge>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
