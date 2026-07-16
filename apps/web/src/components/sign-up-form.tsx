import { Button } from "@rdm-hack/ui/components/button";
import { Card, CardContent, CardTitle } from "@rdm-hack/ui/components/card";
import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { usePrivyAuth } from "@/components/privy-provider";

import Loader from "./loader";

export default function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
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
    toast.success("Privy account ready");
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
            <AuthSegment active="create" onSwitchToSignIn={onSwitchToSignIn} />
            <CardTitle className="text-base font-bold tracking-normal text-[#EEE8DE]">
              Create Privy Account
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
              <UserPlus className="size-4" />
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
  onSwitchToSignIn,
}: {
  active: "create";
  onSwitchToSignIn: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-[8px] border border-[rgba(238,232,222,0.12)] bg-[#0D0F12] p-1">
      <Button
        className="h-8 rounded-[6px] border-transparent bg-transparent text-[11px] font-bold text-[#CCC6BA] hover:bg-[#061F18]/60 hover:text-[#1EEAB0]"
        onClick={onSwitchToSignIn}
        type="button"
        variant="ghost"
      >
        Sign In
      </Button>
      <Button
        className="h-8 rounded-[6px] border-[#4A1A90] bg-[#160A2A] text-[11px] font-bold text-[#A060FF] hover:bg-[#160A2A]/90"
        type="button"
        variant="outline"
      >
        Create
      </Button>
    </div>
  );
}
