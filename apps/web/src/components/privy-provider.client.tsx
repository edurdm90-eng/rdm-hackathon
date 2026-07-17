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

function PrivySessionBridge({ children }: { children: ReactNode }) {
  const { authenticated, getAccessToken, login, logout, ready, user } = usePrivy();
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
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const embeddedWallet = getEmbeddedConnectedWallet(wallets);
  const walletAddress = embeddedWallet?.address ?? null;

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!authenticated || !user) {
      clearStoredPrivySession();
      void queryClient.invalidateQueries();
      return;
    }

    const currentUser = user;
    let active = true;

    async function syncPrivySession() {
      const token = await getAccessToken();

      if (!active) {
        return;
      }

      setPrivyAccessToken(token ?? null);
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
      await queryClient.invalidateQueries();
    }

    void syncPrivySession().catch((error) => {
      const message = error instanceof Error ? error.message : "Unable to sync Privy session.";
      toast.error(message);
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
      authenticated,
      configurationError: null,
      emailLoginStatus: emailLoginState.status,
      loginWithEmailCode: async (code: string) => {
        await loginWithCode({ code });
      },
      login: async (options?: PrivyLoginOptions) => {
        await login(options as Parameters<typeof login>[0]);
      },
      logout: async () => {
        clearStoredPrivySession();
        await logout();
        await queryClient.invalidateQueries();
      },
      ready,
      sendEmailCode: async (email: string) => {
        await sendCode({ email });
      },
    }),
    [authenticated, emailLoginState.status, login, loginWithCode, logout, ready, sendCode],
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
