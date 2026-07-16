import { createFileRoute } from "@tanstack/react-router";

import { HackRoomHomePwa } from "@/components/hack-room";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const user = session.data?.user;

  if (!user) {
    return null;
  }

  return (
    <HackRoomHomePwa
      user={{
        email: user.email,
        id: user.id,
        name: user.name || user.email,
        walletAddress: "walletAddress" in user ? user.walletAddress : undefined,
      }}
    />
  );
}
