import { createFileRoute } from "@tanstack/react-router";

import { MiniGameArena } from "@/features/hack-room/mini-games";
import { WebAppScreen } from "@/features/hack-room/room-shell";
import { ActionScreen, SectionCard } from "@/features/hack-room/shared-ui";

export const Route = createFileRoute("/_auth/games")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <WebAppScreen activeNav="home">
      <ActionScreen title="Games">
        <SectionCard badge="Practice" eyebrow="Standalone" title="Mini Games">
          <MiniGameArena onUseResult={() => undefined} />
        </SectionCard>
      </ActionScreen>
    </WebAppScreen>
  );
}
