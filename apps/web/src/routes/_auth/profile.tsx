import { createFileRoute } from "@tanstack/react-router";

import { HackRoomProfilePwa } from "@/components/hack-room";

export const Route = createFileRoute("/_auth/profile")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const user = session.data?.user;

  if (!user) {
    return null;
  }

  return (
    <HackRoomProfilePwa
      user={{
        embeddedWalletAddress:
          "embeddedWalletAddress" in user && typeof user.embeddedWalletAddress === "string"
            ? user.embeddedWalletAddress
            : undefined,
        email: user.email,
        id: user.id,
        name: user.name || user.email,
        onchainAddress:
          "onchainAddress" in user && typeof user.onchainAddress === "string"
            ? user.onchainAddress
            : undefined,
        smartWalletAddress:
          "smartWalletAddress" in user && typeof user.smartWalletAddress === "string"
            ? user.smartWalletAddress
            : undefined,
        walletAddress:
          "walletAddress" in user && typeof user.walletAddress === "string"
            ? user.walletAddress
            : undefined,
      }}
    />
  );
}
