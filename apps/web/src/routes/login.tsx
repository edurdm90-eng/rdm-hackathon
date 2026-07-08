import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/login")({
  beforeLoad: async () => {
    let session: Awaited<ReturnType<typeof authClient.getSession>>;
    try {
      session = await authClient.getSession();
    } catch {
      return;
    }

    if (session.data) {
      throw redirect({
        to: "/dashboard",
      });
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const [showSignIn, setShowSignIn] = useState(true);

  return showSignIn ? (
    <SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
  );
}
