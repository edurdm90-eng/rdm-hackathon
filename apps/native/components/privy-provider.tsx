import {
  PrivyProvider,
  useEmbeddedEthereumWallet,
  usePrivy,
} from "@privy-io/expo";
import { SmartWalletsProvider } from "@privy-io/expo/smart-wallets";
import {
  LOGIN_RESTRICTION_BLOCK_CODE,
  LOGIN_RESTRICTION_BLOCK_MESSAGE,
} from "@rdm-hack/auth/client";
import { polygonAmoyChain } from "@rdm-hack/blockchain-client";
import { env } from "@rdm-hack/env/native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

type NativePrivyWallet = {
  address: string;
  id: string | null;
};

type NativePrivyBridgeContextValue = {
  clearLastError: () => void;
  clearWalletError: () => void;
  isCreatingWallet: boolean;
  isSyncing: boolean;
  lastError: string | null;
  primaryWalletAddress: string | null;
  retryCreateWallet: () => Promise<boolean>;
  retrySync: () => Promise<boolean>;
  walletAddress: string | null;
  walletError: string | null;
  wallets: NativePrivyWallet[];
};

const NativePrivyBridgeContext =
  createContext<NativePrivyBridgeContextValue | null>(null);

function getExchangeErrorMessage(
  error: {
    code?: string;
    message?: string;
    status?: number;
    statusText?: string;
  } | null,
) {
  if (!error) {
    return "Unable to create a Better Auth session from Privy.";
  }

  if (isLoginRestrictionExchangeError(error)) {
    return LOGIN_RESTRICTION_BLOCK_MESSAGE;
  }

  return (
    error.message ??
    error.statusText ??
    "Unable to create a Better Auth session from Privy."
  );
}

function isLoginRestrictionExchangeError(
  error: {
    code?: string;
    message?: string;
    status?: number;
    statusText?: string;
  } | null,
) {
  if (!error) {
    return false;
  }

  return (
    error.code === LOGIN_RESTRICTION_BLOCK_CODE ||
    error.message === LOGIN_RESTRICTION_BLOCK_MESSAGE ||
    error.status === 403
  );
}

function NativePrivySessionBridge({ children }: { children: React.ReactNode }) {
  const { getAccessToken, isReady, logout, user } = usePrivy();
  const { create, wallets } = useEmbeddedEthereumWallet();
  const { data: session } = authClient.useSession();
  const attemptedUserIdRef = useRef<string | null>(null);
  const attemptedWalletUserIdRef = useRef<string | null>(null);
  const preserveLastErrorRef = useRef(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const mappedWallets = useMemo<NativePrivyWallet[]>(
    () =>
      wallets.map((wallet) => ({
        address: wallet.address,
        id: "id" in wallet && typeof wallet.id === "string" ? wallet.id : null,
      })),
    [wallets],
  );
  const activeWallets = user ? mappedWallets : [];
  const primaryWalletAddress = user
    ? (mappedWallets[0]?.address ?? null)
    : null;
  const walletAddress = primaryWalletAddress;

  const syncSession = useCallback(async () => {
    if (!isReady || !user) {
      return false;
    }

    setIsSyncing(true);
    setLastError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setLastError("Privy did not return an access token for this login.");
        return false;
      }

      const result = await authClient.privy.exchange({
        accessToken,
      });

      if (result.error) {
        const message = getExchangeErrorMessage(result.error);

        if (isLoginRestrictionExchangeError(result.error)) {
          preserveLastErrorRef.current = true;
          await logout();
        }

        setLastError(message);
        return false;
      }

      await queryClient.invalidateQueries();
      setLastError(null);

      return true;
    } catch (error) {
      setLastError(
        error instanceof Error
          ? error.message
          : "Privy session exchange failed.",
      );
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [getAccessToken, isReady, logout, user]);

  const retrySync = useCallback(async () => {
    attemptedUserIdRef.current = null;
    return syncSession();
  }, [syncSession]);

  const ensureWallet = useCallback(async () => {
    if (!isReady || !user || walletAddress) {
      return false;
    }

    setIsCreatingWallet(true);
    setWalletError(null);

    try {
      await create();
      setWalletError(null);
      return true;
    } catch (error) {
      setWalletError(
        error instanceof Error
          ? error.message
          : "Unable to create a Privy wallet.",
      );
      return false;
    } finally {
      setIsCreatingWallet(false);
    }
  }, [create, isReady, user, walletAddress]);

  const retryCreateWallet = useCallback(async () => {
    attemptedWalletUserIdRef.current = null;
    return ensureWallet();
  }, [ensureWallet]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user) {
      attemptedUserIdRef.current = null;
      attemptedWalletUserIdRef.current = null;
      if (preserveLastErrorRef.current) {
        preserveLastErrorRef.current = false;
      } else {
        setLastError(null);
      }
      setWalletError(null);
      return;
    }

    if (session?.user) {
      attemptedUserIdRef.current = user.id;
      setLastError(null);
      return;
    }

    if (attemptedUserIdRef.current === user.id || isSyncing) {
      return;
    }

    attemptedUserIdRef.current = user.id;
    void syncSession();
  }, [isReady, isSyncing, session?.user, syncSession, user]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user) {
      attemptedWalletUserIdRef.current = null;
      setWalletError(null);
      return;
    }

    if (walletAddress) {
      attemptedWalletUserIdRef.current = user.id;
      setWalletError(null);
      return;
    }

    if (attemptedWalletUserIdRef.current === user.id || isCreatingWallet) {
      return;
    }

    attemptedWalletUserIdRef.current = user.id;
    void ensureWallet();
  }, [ensureWallet, isCreatingWallet, isReady, user, walletAddress]);

  const value = useMemo(
    () => ({
      clearLastError: () => {
        setLastError(null);
      },
      clearWalletError: () => {
        setWalletError(null);
      },
      isCreatingWallet,
      isSyncing,
      lastError,
      primaryWalletAddress,
      retryCreateWallet,
      retrySync,
      walletAddress,
      walletError,
      wallets: activeWallets,
    }),
    [
      activeWallets,
      isCreatingWallet,
      isSyncing,
      lastError,
      primaryWalletAddress,
      retryCreateWallet,
      retrySync,
      walletAddress,
      walletError,
    ],
  );

  return (
    <NativePrivyBridgeContext.Provider value={value}>
      {children}
    </NativePrivyBridgeContext.Provider>
  );
}

export function NativePrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={env.EXPO_PUBLIC_PRIVY_APP_ID}
      clientId={env.EXPO_PUBLIC_PRIVY_CLIENT_ID}
      supportedChains={[polygonAmoyChain]}
      config={{
        embedded: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      <SmartWalletsProvider>
        <NativePrivySessionBridge>{children}</NativePrivySessionBridge>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}

export function useNativePrivyBridge() {
  const context = useContext(NativePrivyBridgeContext);

  if (!context) {
    throw new Error(
      "useNativePrivyBridge must be used within NativePrivyProvider.",
    );
  }

  return context;
}
