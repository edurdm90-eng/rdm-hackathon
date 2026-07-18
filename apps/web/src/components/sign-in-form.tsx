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
  const {
    authenticated,
    configurationError,
    emailLoginStatus,
    loginWithEmailCode,
    ready,
    sendEmailCode,
  } = usePrivyAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    navigate({
      to: "/dashboard",
    });
    toast.success("Privy sign in successful");
  }, [authenticated, navigate]);

  async function handleSendCode() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (configurationError) {
      toast.error(configurationError);
      return;
    }

    setEmail(trimmedEmail);
    setCode("");
    await sendEmailCode(trimmedEmail);
    toast.success("OTP sent to your email.");
  }

  async function handleVerifyCode() {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (!trimmedCode || trimmedCode.length < 6) {
      toast.error("Please enter the 6-digit OTP.");
      return;
    }

    await loginWithEmailCode(trimmedCode);
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
                if (emailLoginStatus === "awaiting-code-input" || emailLoginStatus === "error") {
                  void handleVerifyCode();
                  return;
                }

                void handleSendCode();
              }}
            >
              {emailLoginStatus === "awaiting-code-input" || emailLoginStatus === "error" ? (
                <div className="grid gap-1.5">
                  <Label
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#626058]"
                    htmlFor="privy-code"
                  >
                    OTP code
                  </Label>
                  <Input
                    autoComplete="one-time-code"
                    className="h-[42px] rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] px-3 py-[9px] text-center text-[16px] tracking-[0.18em] text-[#EEE8DE] outline-none placeholder:text-[#626058] focus-visible:border-[#1EEAB0] focus-visible:ring-1 focus-visible:ring-[#1EEAB0]/40"
                    id="privy-code"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="000000"
                    type="text"
                    value={code}
                  />
                  <p className="text-xs leading-5 text-[#8B8A84]">Code sent to {email.trim()}</p>
                </div>
              ) : (
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
              )}
              {configurationError ? (
                <p className="rounded-[9px] border border-[#904200] bg-[#241000] px-3 py-2 text-xs leading-5 text-[#FF8820]">
                  {configurationError}
                </p>
              ) : null}

              <Button
                className="mt-1 h-[42px] w-full rounded-[9px] bg-[#1EEAB0] text-[13px] font-bold text-[#03120C] hover:bg-[#1EEAB0]/85"
                disabled={
                  emailLoginStatus === "sending-code" || emailLoginStatus === "submitting-code"
                }
                type="submit"
              >
                <LogIn className="size-4" />
                {emailLoginStatus === "sending-code"
                  ? "Sending OTP..."
                  : emailLoginStatus === "submitting-code"
                    ? "Verifying..."
                    : emailLoginStatus === "awaiting-code-input" || emailLoginStatus === "error"
                      ? "Verify OTP"
                      : "Send OTP"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
