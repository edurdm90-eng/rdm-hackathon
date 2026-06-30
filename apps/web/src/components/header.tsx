import { Button } from "@rdm-hack/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { NativeIcon } from "@/lib/native-icons";

export default function Header() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

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
          <HeaderButton label="Notifications" to="/dashboard">
            <NativeIcon className="size-[18px]" name="notifications-outline" />
          </HeaderButton>
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
    </header>
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
          className="absolute right-0 top-full z-50 mt-2 w-[292px] rounded-[16px] border border-[rgba(238,232,222,0.12)] bg-[#0A0C0F] p-3 text-[#EEE8DE] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
          role="menu"
        >
          <div className="rounded-[14px] border border-[rgba(238,232,222,0.12)] bg-[#141618] p-4">
            <img alt="RDM" className="h-[34px] w-auto object-contain" src="/icons/rdm-logo.png" />
            <div className="mt-3 font-mono text-[10px] font-black uppercase tracking-[0.2em] text-[#1EEAB0]">
              Hack Room
            </div>
            <div className="mt-1 text-xl font-black tracking-normal text-[#EEE8DE]">RDM Command</div>
          </div>

          <nav className="mt-3 grid gap-2">
            <DrawerMenuItem
              icon={<NativeIcon className="size-[19px]" name="home-outline" />}
              label="Home"
              onSelect={() => setOpen(false)}
              to="/dashboard"
              tone="cyan"
            />
            <DrawerMenuItem
              icon={<NativeIcon className="size-[19px]" name="flash-outline" />}
              label="Hack Rooms"
              onSelect={() => setOpen(false)}
              to="/hack-room"
              tone="violet"
            />
            <DrawerMenuItem
              icon={<NativeIcon className="size-[19px]" name="person-circle-outline" />}
              label="Profile"
              onSelect={() => setOpen(false)}
              to="/profile"
              tone="gold"
            />
          </nav>

          <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-[rgba(238,232,222,0.12)] bg-[#1A1D20] p-3">
            <NativeIcon className="size-[18px] shrink-0 text-[#1EEAB0]" name="shield-checkmark-outline" />
            <p className="text-xs leading-[18px] text-[#CCC6BA]">
              Organizer and participant flows stay in sync.
            </p>
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
      className={`flex min-h-[52px] cursor-pointer items-center gap-2 rounded-[14px] border px-3 text-sm font-black outline-none transition ${toneClass}`}
      onClick={onSelect}
      role="menuitem"
      to={to}
    >
      {icon}
      <span className="flex-1">{label}</span>
      <NativeIcon className="size-4" name="chevron-forward-outline" />
    </Link>
  );
}

function HeaderButton({
  children,
  label,
  to,
}: {
  children: React.ReactNode;
  label: string;
  to: "/dashboard" | "/hack-room" | "/";
}) {
  return (
    <Link to={to}>
      <Button
        aria-label={label}
        className="grid size-10 rounded-[10px] border-[rgba(238,232,222,0.12)] bg-[#141618] p-0 text-[#EEE8DE] hover:bg-[#1A1D20]"
        title={label}
        variant="outline"
      >
        {children}
      </Button>
    </Link>
  );
}
