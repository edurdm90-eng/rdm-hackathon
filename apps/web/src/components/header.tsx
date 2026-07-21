import { Button } from "@rdm-hack/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { NativeIcon } from "@/lib/native-icons";
import { trpc } from "@/utils/trpc";

export default function Header() {
  const [notificationMessage, setNotificationMessage] = useState<{
    text: string;
    tone: "cyan" | "violet";
  } | null>(null);
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const dashboard = useQuery({
    ...trpc.hackRoom.dashboard.queryOptions(),
    enabled: Boolean(user),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const notifications = dashboard.data?.notifications ?? [];

  function showNotifications() {
    setNotificationMessage({
      text: notificationBannerMessage(notifications),
      tone: notifications.length ? "violet" : "cyan",
    });
  }

  return (
    <header className="sticky top-0 z-50 bg-[#0A0C0F]">
      <div className="mx-auto flex h-[64px] w-full max-w-[560px] items-center justify-between px-4 sm:px-0">
        <Link className="flex h-full items-center gap-2" to="/dashboard">
          <img
            alt="RDM"
            className="h-11 w-auto object-contain"
            src="/icons/rdm-logo.png"
          />
        </Link>

        <div className="flex h-full items-center gap-2">
          <Button
            aria-label="Notifications"
            className="relative grid size-10 rounded-[10px] border-[rgba(238,232,222,0.12)] bg-[#141618] p-0 text-[#EEE8DE] hover:bg-[#1A1D20]"
            disabled={!user}
            onClick={showNotifications}
            title="Notifications"
            type="button"
            variant="outline"
          >
            <NativeIcon className="size-[18px]" name="notifications-outline" />
            {notifications.length ? (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full border border-[#0A0C0F] bg-[#A060FF] px-1 font-mono text-[10px] font-black leading-4 text-[#EEE8DE]">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            ) : null}
          </Button>
          <AppMenu />
          {user ? (
            <Link to="/profile">
              <Button
                aria-label="Profile"
                className="grid size-10 rounded-[10px] border-[rgba(238,232,222,0.12)] bg-[#141618] p-0 text-[#EEE8DE] hover:bg-[#1A1D20]"
                title={user.email}
                type="button"
                variant="outline"
              >
                <NativeIcon className="size-[18px]" name="person-circle-outline" />
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button
                aria-label="Sign in"
                className="grid size-10 rounded-[10px] border-[rgba(238,232,222,0.12)] bg-[#141618] p-0 text-[#EEE8DE] hover:bg-[#1A1D20]"
                variant="outline"
              >
                <NativeIcon className="size-[18px]" name="person-circle-outline" />
              </Button>
            </Link>
          )}
        </div>
      </div>
      {notificationMessage ? (
        <HeaderStatusBanner
          message={notificationMessage.text}
          tone={notificationMessage.tone}
        />
      ) : null}
    </header>
  );
}

function HeaderStatusBanner({
  message,
  tone,
}: {
  message: string;
  tone: "cyan" | "violet";
}) {
  const toneClass =
    tone === "violet"
      ? "border-[#4A1A90] bg-[#160A2A] text-[#A060FF]"
      : "border-[#0B8060] bg-[#061F18] text-[#1EEAB0]";

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-3 sm:px-0">
      <div className={`flex items-start gap-2 rounded-[10px] border px-3 py-2 text-xs leading-[18px] ${toneClass}`}>
        <NativeIcon
          className="mt-0.5 size-4 shrink-0"
          name={tone === "violet" ? "notifications-outline" : "checkmark-circle-outline"}
        />
        <span>{message}</span>
      </div>
    </div>
  );
}

function AppMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        aria-expanded={open}
        aria-label="Open menu"
        className="grid size-10 rounded-[10px] border-[rgba(238,232,222,0.12)] bg-[#141618] p-0 text-[#EEE8DE] hover:bg-[#1A1D20]"
        onClick={() => setOpen((current) => !current)}
        title="Menu"
        type="button"
        variant="outline"
      >
        <NativeIcon className="size-[18px]" name="menu-outline" />
      </Button>

      {open ? (
        <div
          className="fixed inset-x-0 bottom-0 top-[64px] z-50 bg-[#0A0C0F]/70 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div className="mx-auto h-full w-full max-w-[560px] px-4 sm:px-0">
            <div
              className="ml-auto flex h-full w-[min(320px,calc(100vw-32px))] flex-col gap-3 border-l border-[rgba(238,232,222,0.12)] bg-[#0A0C0F] p-4 text-[#EEE8DE] shadow-[-18px_0_38px_rgba(0,0,0,0.38)]"
              onClick={(event) => event.stopPropagation()}
              role="menu"
            >
              <div className="rounded-[12px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-3.5">
                <img alt="RDM" className="h-8 w-auto object-contain" src="/icons/rdm-logo.png" />
                <div className="mt-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#1EEAB0]">
                  Hack Room
                </div>
                <div className="mt-1 text-[17px] font-black leading-6 tracking-normal text-[#EEE8DE]">
                  RDM Command
                </div>
              </div>

              <nav className="grid gap-2">
                <DrawerMenuItem
                  icon={<NativeIcon className="size-[18px]" name="home-outline" />}
                  label="Home"
                  onSelect={() => setOpen(false)}
                  to="/dashboard"
                  tone="cyan"
                />
                <DrawerMenuItem
                  icon={<NativeIcon className="size-[18px]" name="flash-outline" />}
                  label="Hack Rooms"
                  onSelect={() => setOpen(false)}
                  to="/hack-room"
                  tone="violet"
                />
                <DrawerMenuItem
                  icon={<NativeIcon className="size-[18px]" name="person-circle-outline" />}
                  label="Profile"
                  onSelect={() => setOpen(false)}
                  to="/profile"
                  tone="gold"
                />
              </nav>

              <div className="mt-auto flex items-center gap-2.5 rounded-[12px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-3">
                <NativeIcon className="size-[18px] shrink-0 text-[#1EEAB0]" name="shield-checkmark-outline" />
                <p className="text-xs leading-[18px] text-[#CCC6BA]">
                  Organizer and participant flows stay in sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DrawerMenuItem({
  icon,
  label,
  onSelect,
  to,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  to: "/dashboard" | "/hack-room" | "/profile";
  tone: "cyan" | "gold" | "violet";
}) {
  const toneClass =
    tone === "violet"
      ? "border-[#4A1A90] bg-[#160A2A] text-[#A060FF] hover:bg-[#160A2A]/80"
      : tone === "gold"
        ? "border-[#8A6A00] bg-[#241A00] text-[#F0C040] hover:bg-[#241A00]/80"
        : "border-[#0B8060] bg-[#061F18] text-[#1EEAB0] hover:bg-[#061F18]/80";

  return (
    <Link
      className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[12px] border px-3 text-[13px] font-extrabold outline-none transition ${toneClass}`}
      onClick={onSelect}
      role="menuitem"
      to={to}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <NativeIcon className="size-3.5" name="chevron-forward-outline" />
    </Link>
  );
}

function notificationBannerMessage(
  notifications: Array<{ message: string; roomName: string; title: string }>,
) {
  if (!notifications.length) {
    return "No new notifications right now";
  }

  const latest = notifications[0];
  return `${latest.title} - ${latest.roomName}: ${latest.message}`;
}
