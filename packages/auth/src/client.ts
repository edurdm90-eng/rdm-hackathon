import type {
  PrivyExchangeInput,
  PrivyExchangeResponse,
} from "./privy-bridge.js";

type BetterFetchResult<T> = {
  data: T | null;
  error: {
    code?: string;
    message?: string;
    status: number;
    statusText?: string;
  } | null;
};

type BetterFetch = <T = unknown>(
  path: string,
  options?: Record<string, unknown>,
) => Promise<BetterFetchResult<T>>;

type BetterAuthStore = {
  notify: (signal: string) => void;
};

export function privyClient() {
  return {
    id: "privy-bridge-client",
    getActions($fetch: BetterFetch, $store: BetterAuthStore) {
      return {
        privy: {
          exchange: async (input: PrivyExchangeInput) => {
            const result = await $fetch<PrivyExchangeResponse>(
              "/privy/exchange",
              {
                body: input,
                method: "POST",
              },
            );

            if (!result.error) {
              $store.notify("$sessionSignal");
            }

            return result;
          },
        },
      };
    },
  } as const;
}

export type PrivyClientPlugin = ReturnType<typeof privyClient>;
export type {
  PrivyExchangeInput,
  PrivyExchangeResponse,
} from "./privy-bridge.js";
export {
  LOGIN_RESTRICTION_BLOCK_CODE,
  LOGIN_RESTRICTION_BLOCK_MESSAGE,
} from "./login-restriction-constants";
