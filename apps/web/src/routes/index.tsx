import { Button } from "@rdm-hack/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Crown, DoorOpen, KeyRound, Shield, Trophy } from "lucide-react";

import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

  return (
    <main className="min-h-full overflow-auto bg-[#0a0c0f] text-[#eee8de]">
      <section className="mx-auto grid min-h-[calc(100svh-49px)] max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8">
        <div className="flex flex-col justify-center gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#1eeab0]">
              XRDM Corporate · Hack Room
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-normal text-[#f4efe7] sm:text-5xl">
              Hackathon proof, tasks, and winners in one room.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9c9690]">
              Hosts create invite-only hack rooms, publish tasks, review submissions, and choose
              winners. Participants join with a code, submit proof, and keep a participation record.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/dashboard">
              <Button className="h-11 w-full bg-[#1eeab0] text-[#03120c] hover:bg-[#1eeab0]/85">
                <DoorOpen />
                Open Hack Room
              </Button>
            </Link>
            <Link to="/login">
              <Button
                className="h-11 w-full border-[#4a1a90] bg-[#160a2a] text-[#a060ff] hover:bg-[#160a2a]/80"
                variant="outline"
              >
                <KeyRound />
                Sign In / Sign Up
              </Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusPill active={healthCheck.data === "OK"} />
            <Pill icon={<Shield />} label="Host flow" tone="violet" />
            <Pill icon={<CheckCircle2 />} label="Participant proof" tone="cyan" />
            <Pill icon={<Trophy />} label="Winner selection" tone="gold" />
          </div>
        </div>

        <div className="grid content-center gap-4">
          <div className="border border-white/10 bg-[#101318] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#626058]">
                  Navigation map
                </div>
                <div className="mt-1 text-lg font-semibold text-[#f4efe7]">Two roles, one room</div>
              </div>
              <Crown className="size-5 text-[#f0c040]" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowCard
                color="cyan"
                items={["Join by invite", "See assignments", "Submit proof", "Track status"]}
                title="Participant"
              />
              <FlowCard
                color="violet"
                items={["Create room", "Share code", "Publish task", "Pick winners"]}
                title="Host"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value="HR-" label="Invite codes" />
            <Stat value="3" label="Core collections" />
            <Stat value="XRDM" label="Awards ready" />
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${
        active
          ? "border-[#0b8060] bg-[#061f18] text-[#1eeab0]"
          : "border-[#901e14] bg-[#280a08] text-[#ff5a4a]"
      }`}
    >
      <span className={`size-2 ${active ? "bg-[#1eeab0]" : "bg-[#ff5a4a]"}`} />
      API {active ? "Connected" : "Offline"}
    </span>
  );
}

function Pill({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "cyan" | "violet" | "gold";
}) {
  const className = {
    cyan: "border-[#0b8060] bg-[#061f18] text-[#1eeab0]",
    violet: "border-[#4a1a90] bg-[#160a2a] text-[#a060ff]",
    gold: "border-[#8a6a00] bg-[#241a00] text-[#f0c040]",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] ${className} [&_svg]:size-3.5`}
    >
      {icon}
      {label}
    </span>
  );
}

function FlowCard({
  color,
  items,
  title,
}: {
  color: "cyan" | "violet";
  items: string[];
  title: string;
}) {
  const className =
    color === "cyan"
      ? "border-[#0b8060] bg-[#061f18] text-[#1eeab0]"
      : "border-[#4a1a90] bg-[#160a2a] text-[#a060ff]";

  return (
    <div className={`border p-4 ${className}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div className="flex items-center gap-2 text-xs text-[#ccc6ba]" key={item}>
            <span className="size-1.5 bg-current opacity-60" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-[#141618] p-4">
      <div className="text-2xl font-semibold text-[#f4efe7]">{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#626058]">
        {label}
      </div>
    </div>
  );
}
