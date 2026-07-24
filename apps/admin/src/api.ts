import type { AppRouter } from "@rdm-hack/api/routers/index";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const serverUrl = (import.meta.env.VITE_SERVER_URL ?? "").replace(/\/+$/, "");

let adminSessionToken: string | null = null;

export function setAdminSessionToken(token: string | null) {
  adminSessionToken = token?.trim() || null;
}

export const adminApi = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${serverUrl}/trpc`,
      fetch(url, options) {
        const headers = new Headers(options?.headers);

        if (adminSessionToken) {
          headers.set("Authorization", `Bearer ${adminSessionToken}`);
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

export type AdminDashboardData = Awaited<
  ReturnType<typeof adminApi.admin.dashboard.query>
>;
export type AdminAccessData = Awaited<
  ReturnType<typeof adminApi.admin.access.query>
>;

export async function exchangePrivySession(accessToken: string) {
  const response = await fetch(`${serverUrl}/api/auth/privy/exchange`, {
    body: JSON.stringify({ accessToken, audience: "admin" }),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { code?: string; error?: string; message?: string }
      | null;
    const error = new Error(
      body?.message || body?.error || response.statusText || "Could not create an admin session.",
    );
    Object.assign(error, {
      code: response.status === 403 ? "FORBIDDEN" : body?.code,
    });
    throw error;
  }

  return response.json() as Promise<{
    token: string;
    user: {
      email: string;
      id: string;
      name: string;
    };
  }>;
}

export async function signOutServerSession() {
  await fetch(`${serverUrl}/api/auth/sign-out`, {
    credentials: "include",
    headers: adminSessionToken
      ? { Authorization: `Bearer ${adminSessionToken}` }
      : undefined,
    method: "POST",
  }).catch(() => undefined);
}
