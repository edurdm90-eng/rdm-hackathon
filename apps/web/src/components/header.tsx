import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Hack Room" },
  ] as const;

  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-12 max-w-7xl flex-row items-center justify-between px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-4 text-sm">
          <Link className="font-mono text-xs font-semibold uppercase tracking-[0.22em]" to="/">
            RDM Hack
          </Link>
          {links.map(({ to, label }) => {
            return (
              <Link
                activeProps={{ className: "text-foreground" }}
                className="text-muted-foreground transition hover:text-foreground"
                key={to}
                to={to}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
