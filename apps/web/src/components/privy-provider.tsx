import { createContext, useContext, type ReactNode } from "react";

import { getWebPrivyConfigurationError } from "@/lib/privy-config";

import { ClientWebPrivyProvider } from "./privy-provider.client";

export type PrivyLoginOptions = {
  loginMethods?: string[];
  prefill?: {
    type: "email" | "phone";
    value: string;
  };
};

type PrivyAuthContextValue = {
  authenticated: boolean;
  configurationError: string | null;
  emailLoginStatus: string;
  loginWithEmailCode: (code: string) => Promise<void>;
  login: (options?: PrivyLoginOptions) => Promise<void>;
  logout: () => Promise<void>;
  ready: boolean;
  sendEmailCode: (email: string) => Promise<void>;
};

type PrivyWalletContextValue = {
  isCreatingWallet: boolean;
  walletAddress: string | null;
  walletError: string | null;
};

const defaultPrivyAuthValue: PrivyAuthContextValue = {
  authenticated: false,
  configurationError: null,
  emailLoginStatus: "initial",
  loginWithEmailCode: async () => {},
  login: async () => {},
  logout: async () => {},
  ready: false,
  sendEmailCode: async () => {},
};

const defaultPrivyWalletValue: PrivyWalletContextValue = {
  isCreatingWallet: false,
  walletAddress: null,
  walletError: null,
};

export const PrivyAuthContext = createContext<PrivyAuthContextValue>(defaultPrivyAuthValue);
export const PrivyWalletContext = createContext<PrivyWalletContextValue>(defaultPrivyWalletValue);

function MissingPrivyProvider({ children }: { children: ReactNode }) {
  const configurationError = getWebPrivyConfigurationError();

  return (
    <PrivyAuthContext.Provider
      value={{
        ...defaultPrivyAuthValue,
        configurationError,
        ready: true,
      }}
    >
      <PrivyWalletContext.Provider value={defaultPrivyWalletValue}>
        {children}
      </PrivyWalletContext.Provider>
    </PrivyAuthContext.Provider>
  );
}

export function WebPrivyProvider({ children }: { children: ReactNode }) {
  if (getWebPrivyConfigurationError()) {
    return <MissingPrivyProvider>{children}</MissingPrivyProvider>;
  }

  return <ClientWebPrivyProvider>{children}</ClientWebPrivyProvider>;
}

export function usePrivyAuth() {
  return useContext(PrivyAuthContext);
}

export function usePrivyWallet() {
  return useContext(PrivyWalletContext);
}

export { ClientWebPrivyProvider } from "./privy-provider.client";
