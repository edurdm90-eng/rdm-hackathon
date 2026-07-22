import { createFileRoute, redirect } from "@tanstack/react-router";

import { readProtectedPrivySession } from "@/lib/privy-session";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const session = readProtectedPrivySession();

    throw redirect({
      to: session ? "/dashboard" : "/login",
    });
  },
});
