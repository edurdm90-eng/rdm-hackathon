import { Toaster } from "@rdm-hack/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { clearBrowserAuthStorageForSignOut, isPrivySignedOut } from "@/lib/privy-session";
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
        <SignOutNavigationGuard />
        <div className={showHeader ? "grid h-svh grid-rows-[auto_1fr]" : "h-svh"}>
          {showHeader ? <Header /> : null}
          <Outlet />
        </div>
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </>
  );
}

function SignOutNavigationGuard() {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    function redirectIfSignedOut() {
      if (pathname === "/login" || !isPrivySignedOut()) {
        return;
      }

      clearBrowserAuthStorageForSignOut();
      void router.navigate({
        replace: true,
        to: "/login",
      });
    }

    redirectIfSignedOut();
    window.addEventListener("storage", redirectIfSignedOut);
    window.addEventListener("rdm-privy-session-change", redirectIfSignedOut);

    return () => {
      window.removeEventListener("storage", redirectIfSignedOut);
      window.removeEventListener("rdm-privy-session-change", redirectIfSignedOut);
    };
  }, [pathname, router]);

  return null;
}
