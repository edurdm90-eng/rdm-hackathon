import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/hack-room")({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
