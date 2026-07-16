import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import HackRoomPwa from "@/components/hack-room";

export const Route = createFileRoute("/_auth/hack-room/$roomId")({
  component: RouteComponent,
});

function RouteComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { session } = Route.useRouteContext();
  const { roomId } = Route.useParams();
  const user = session.data?.user;

  if (pathname !== `/hack-room/${roomId}` && pathname !== `/hack-room/${roomId}/`) {
    return <Outlet />;
  }

  if (!user) {
    return null;
  }

  return (
    <HackRoomPwa
      roomId={roomId}
      roomTab="overview"
      user={{
        email: user.email,
        id: user.id,
        name: user.name || user.email,
        walletAddress: "walletAddress" in user ? user.walletAddress : undefined,
      }}
    />
  );
}
