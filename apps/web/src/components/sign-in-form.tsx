import { Button } from "@rdm-hack/ui/components/button";
import { Card, CardContent, CardTitle } from "@rdm-hack/ui/components/card";
import { Input } from "@rdm-hack/ui/components/input";
import { Label } from "@rdm-hack/ui/components/label";
import { useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { usePrivyAuth } from "@/components/privy-provider";

import Loader from "./loader";

export default function SignInForm() {
  const navigate = useNavigate({
    from: "/",
  });
  const { authenticated, configurationError, login, ready } = usePrivyAuth();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    navigate({
      to: "/dashboard",
    });
    toast.success("Privy sign in successful");
  }, [authenticated, navigate]);

  async function handlePrivyLogin() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (configurationError) {
      toast.error(configurationError);
      return;
    }

    await login({
      loginMethods: ["email"],
      prefill: {
        type: "email",
        value: trimmedEmail,
      },
    });
  }

  if (!ready) {
    return <Loader />;
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-[#0A0C0F] px-4 py-6 text-[#EEE8DE]">
      <div className="flex w-full max-w-[420px] flex-col items-center">
        <img
          alt="RDM"
          className="mb-3 h-[92px] w-[240px] object-contain"
          src="/icons/rdm-logo.png"
        />

        <Card className="w-full gap-3 rounded-[11px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-4 py-4 text-[#EEE8DE] ring-0">
          <CardContent className="grid gap-3 p-0">
            <CardTitle className="text-base font-bold tracking-normal text-[#EEE8DE]">
              Continue to RDM
            </CardTitle>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePrivyLogin();
              }}
            >
              <div className="grid gap-1.5">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#626058]"
                  htmlFor="privy-email"
                >
                  Email
                </Label>
                <Input
                  autoComplete="email"
                  className="h-[42px] rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-[9px] text-[13px] text-[#EEE8DE] outline-none placeholder:text-[#626058] focus-visible:border-[#1EEAB0] focus-visible:ring-1 focus-visible:ring-[#1EEAB0]/40"
                  id="privy-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  value={email}
                />
              </div>
              {configurationError ? (
                <p className="rounded-[9px] border border-[#904200] bg-[#241000] px-3 py-2 text-xs leading-5 text-[#FF8820]">
                  {configurationError}
                </p>
              ) : null}

              <Button
                className="mt-1 h-[42px] w-full rounded-[9px] bg-[#1EEAB0] text-[13px] font-bold text-[#03120C] hover:bg-[#1EEAB0]/85"
                type="submit"
              >
                <LogIn className="size-4" />
                Send OTP
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
