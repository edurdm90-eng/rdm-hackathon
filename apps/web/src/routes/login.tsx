import { createFileRoute } from "@tanstack/react-router";

import SignInForm from "@/components/sign-in-form";
import { clearBrowserAuthStorageForSignOut, isPrivySignOutPending } from "@/lib/privy-session";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    const isSignOutReturn =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("signout") === "1";

    if (isSignOutReturn || isPrivySignOutPending()) {
      clearBrowserAuthStorageForSignOut();
      if (isSignOutReturn) {
        window.history.replaceState(window.history.state, "", "/login");
      }
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  return <SignInForm />;
}
