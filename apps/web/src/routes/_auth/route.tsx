import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { readProtectedPrivySession } from "@/lib/privy-session";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  beforeLoad: () => {
    const session = readProtectedPrivySession();
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
    return { session: { data: session } };
  },
});

function AuthLayout() {
  return <Outlet />;
}
