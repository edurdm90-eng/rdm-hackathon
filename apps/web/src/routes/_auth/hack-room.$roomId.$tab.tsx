import { createFileRoute } from "@tanstack/react-router";

import HackRoomPwa from "@/components/hack-room";

export const Route = createFileRoute("/_auth/hack-room/$roomId/$tab")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const { roomId, tab } = Route.useParams();
  const user = session.data?.user;

  if (!user) {
    return null;
  }

  return (
    <HackRoomPwa
      roomId={roomId}
      roomTab={tab}
      user={{
        email: user.email,
        id: user.id,
        name: user.name || user.email,
        walletAddress:
          "walletAddress" in user && typeof user.walletAddress === "string"
            ? user.walletAddress
            : undefined,
      }}
    />
  );
}
