import { createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getSession();

    throw redirect({
      to: session.data ? "/dashboard" : "/login",
    });
  },
});

async function getSession() {
  try {
    return await authClient.getSession();
  } catch {
    return { data: null };
  }
}
