import { Button } from "@rdm-hack/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@rdm-hack/ui/components/dropdown-menu";
import { Skeleton } from "@rdm-hack/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";

import { usePrivyAuth } from "@/components/privy-provider";
import { authClient } from "@/lib/auth-client";

export default function UserMenu() {
  const navigate = useNavigate();
  const { logout } = usePrivyAuth();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  const user = session?.user;

  if (!user) {
    return (
      <Link to="/login">
        <Button variant="outline">Sign In</Button>
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        {user.name || user.email || "Account"}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuGroup>
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>{user.email || "Signed in"}</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await logout();
              await authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/login",
                    });
                  },
                },
              });
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
