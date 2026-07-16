import { Button } from "@rdm-hack/ui/components/button";
import { Card, CardContent, CardTitle } from "@rdm-hack/ui/components/card";
import { useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { toast } from "sonner";

import { usePrivyAuth } from "@/components/privy-provider";

import Loader from "./loader";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const navigate = useNavigate({
    from: "/",
  });
  const { configurationError, login, ready } = usePrivyAuth();

  async function handlePrivyLogin() {
    if (configurationError) {
      toast.error(configurationError);
      return;
    }

    await login({ loginMethods: ["email", "google"] });
    navigate({
      to: "/dashboard",
    });
    toast.success("Privy sign in successful");
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
            <AuthSegment active="sign-in" onSwitchToSignUp={onSwitchToSignUp} />
            <CardTitle className="text-base font-bold tracking-normal text-[#EEE8DE]">
              Privy Sign In
            </CardTitle>
            {configurationError ? (
              <p className="rounded-[9px] border border-[#904200] bg-[#241000] px-3 py-2 text-xs leading-5 text-[#FF8820]">
                {configurationError}
              </p>
            ) : null}

            <Button
              className="mt-1 h-[42px] w-full rounded-[9px] bg-[#1EEAB0] text-[13px] font-bold text-[#03120C] hover:bg-[#1EEAB0]/85"
              onClick={() => void handlePrivyLogin()}
              type="button"
            >
              <LogIn className="size-4" />
              Continue with Privy
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function AuthSegment({
  active,
  onSwitchToSignUp,
}: {
  active: "sign-in";
  onSwitchToSignUp: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-1">
      <Button
        className="h-8 rounded-[6px] border-[#0B8060] bg-[#061F18] text-[11px] font-bold text-[#1EEAB0] hover:bg-[#061F18]/90"
        type="button"
        variant="outline"
      >
        Sign In
      </Button>
      <Button
        className="h-8 rounded-[6px] border-transparent bg-transparent text-[11px] font-bold text-[#CCC6BA] hover:bg-[#160A2A]/60 hover:text-[#A060FF]"
        onClick={onSwitchToSignUp}
        type="button"
        variant="ghost"
      >
        Create
      </Button>
    </div>
  );
}
