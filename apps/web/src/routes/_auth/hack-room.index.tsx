import { createFileRoute } from "@tanstack/react-router";

import { HackRoomRoomsPwa } from "@/components/hack-room";

export const Route = createFileRoute("/_auth/hack-room/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const user = session.data?.user;

  if (!user) {
    return null;
  }

  return (
    <HackRoomRoomsPwa
      user={{
        email: user.email,
        id: user.id,
        name: user.name || user.email,
        walletAddress: "walletAddress" in user ? user.walletAddress : undefined,
      }}
    />
  );
}
