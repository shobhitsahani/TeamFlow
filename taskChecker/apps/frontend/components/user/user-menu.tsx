"use client";

/* TeamFlow User menu — compact reusable account menu on shadcn primitives.
   Avatar trigger + DropdownMenu + Separator + Badge role. Used in the
   Lagoon header, the /app topbar, and the mobile menu alike. */

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/store";
import { useToast } from "@/components/overlay";
import { useTheme } from "@/components/theme-provider";
import { UserAvatar } from "./user-avatar";
import {
  IconBell,
  IconBuilding,
  IconCommand,
  IconKey,
  IconLogout,
  IconPlus,
  IconSettings,
  IconUser,
} from "@/components/icons";

export function UserMenu({
  align = "end",
  onOpenPalette,
  onOpenNotifs,
}: {
  align?: "start" | "end";
  onOpenPalette?: () => void;
  onOpenNotifs?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { org, orgs, setOrg } = useTenant();
  const { theme, toggle } = useTheme();

  const name = user?.name ?? "You";
  const email = user?.email ?? "";
  const role = org?.role ?? "member";

  const signOut = async () => {
    await logout();
    toast({ title: "Signed out", msg: "Session ended — see you soon." });
    router.replace("/auth/sign-in");
  };

  const showShortcuts = () => {
    toast({
      title: "Keyboard shortcuts",
      msg: "⌘K / Ctrl K search · M move card · Enter open · Esc close.",
    });
    onOpenPalette?.();
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label={user ? `Account menu, signed in as ${name}` : "Account menu"}
      title={email || name}
    >
      <UserAvatar
        name={name}
        seed={user?.id ?? name}
        size="sm"
        loading={authLoading || !user}
      />
    </Button>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align={align} className="w-64">
        <DropdownMenuLabel>
          {authLoading || !user ? (
            <span className="flex items-center gap-2 py-0.5" aria-hidden>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <span className="flex min-w-0 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
              </span>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-2">
              <UserAvatar name={name} seed={user.id} size="default" />
              <span className="min-w-0">
                <span className="block max-w-full truncate text-sm font-semibold text-foreground">
                  {name}
                </span>
                {email ? (
                  <span className="block max-w-full truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </span>
                ) : null}
                <span className="mt-1 flex items-center gap-1.5">
                  <Badge variant="secondary" className="capitalize">
                    {role}
                  </Badge>
                  {org ? (
                    <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                      {org.name}
                    </span>
                  ) : null}
                </span>
              </span>
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings")}>
            <IconUser size={16} />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings")}>
            <IconSettings size={16} />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick onClick={showShortcuts}>
            <IconCommand size={16} />
            Keyboard shortcuts
            <span className="kbd ml-auto">⌘K</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            closeOnClick={false}
            onClick={() => toggle()}
          >
            <IconSettings size={16} />
            Theme: {theme === "dark" ? "Dark" : "Light"}
            <span className="ml-auto text-xs text-muted-foreground">Toggle</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <div className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-muted-foreground">
            Workspace
          </div>
          {orgs.slice(0, 5).map((o) => (
            <DropdownMenuItem
              key={o.id}
              closeOnClick
              disabled={o.id === org?.id}
              onClick={() => {
                if (o.id !== org?.id) {
                  void setOrg(o.id);
                  toast({ title: `Switched to ${o.name}`, msg: "Scoped to this tenant now." });
                }
              }}
            >
              <IconBuilding size={16} />
              <span className="max-w-[10rem] truncate">{o.name}</span>
              <span className="ml-auto text-xs text-muted-foreground capitalize">{o.role}</span>
              {o.id === org?.id ? <span className="cmdk-hint">current</span> : null}
            </DropdownMenuItem>
          ))}
          {orgs.length > 5 ? (
            <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings#organizations")}>
              <IconBuilding size={16} />
              View all {orgs.length} workspaces
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings#organizations")}>
            <IconSettings size={16} />
            Manage organizations
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings#organizations")}>
            <IconPlus size={16} />
            New organization
          </DropdownMenuItem>
          <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings#organizations")}>
            <IconKey size={16} />
            Join via invite
          </DropdownMenuItem>
          {onOpenNotifs ? (
            <DropdownMenuItem closeOnClick onClick={onOpenNotifs}>
              <IconBell size={16} />
              Notifications
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <Separator className="my-1" />
        <DropdownMenuItem closeOnClick variant="destructive" onClick={() => void signOut()}>
          <IconLogout size={16} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
