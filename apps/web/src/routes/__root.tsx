import { Toaster } from "@rdm-hack/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import type { trpc } from "@/utils/trpc";

import "../index.css";

export interface RouterAppContext {
  trpc: typeof trpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "RDM Hack Room",
      },
      {
        name: "description",
        content: "RDM Hack Room is a PWA for hackathon rooms, proof, winners, and XRDM rewards.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showHeader = pathname !== "/login";

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className={showHeader ? "grid h-svh grid-rows-[auto_1fr]" : "h-svh"}>
          {showHeader ? <Header /> : null}
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
    </>
  );
}
