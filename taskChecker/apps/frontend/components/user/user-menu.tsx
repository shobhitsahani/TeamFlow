"use client";

/* TeamFlow User menu — compact reusable account menu on shadcn primitives.
   Avatar trigger + DropdownMenu + Separator + Badge role + PhotoComponent ready.
   Used in the Lagoon header, the /app topbar, and the mobile menu alike. */

import { useState } from "react";
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
import { useUserPhoto } from "@/lib/avatar-store";
import { UserAvatar } from "./user-avatar";
import { PhotoComponent } from "./photo-component";
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
  const { photoUrl, setPhotoUrl } = useUserPhoto();
  const [photoOpen, setPhotoOpen] = useState(false);

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
      className="rounded-full relative p-0 overflow-hidden ring-1 ring-white/10 hover:ring-primary/50 transition-all"
      aria-label={user ? `Account menu, signed in as ${name}` : "Account menu"}
      title={email || name}
    >
      <UserAvatar
        name={name}
        src={photoUrl}
        seed={user?.id ?? name}
        size="sm"
        status="online"
        loading={authLoading || !user}
      />
    </Button>
  );

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent align={align} className="w-64 border-white/10 bg-[#0e131b]/95 backdrop-blur-xl shadow-2xl">
          <DropdownMenuLabel
            className="cursor-pointer rounded-lg p-2.5 transition-colors hover:bg-white/5 focus:bg-white/5"
            onClick={() => router.push("/app/settings/profile")}
            title="Open full profile & settings"
          >
            {authLoading || !user ? (
              <span className="flex items-center gap-2.5 py-0.5" aria-hidden>
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <span className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-3 w-36 rounded" />
                </span>
              </span>
            ) : (
              <span className="flex min-w-0 items-center gap-3">
                <UserAvatar name={name} src={photoUrl} seed={user.id} size="default" status="online" />
                <span className="min-w-0">
                  <span className="block max-w-full truncate text-sm font-semibold text-white">
                    {name}
                  </span>
                  {email ? (
                    <span className="block max-w-full truncate text-xs font-normal text-slate-400">
                      {email}
                    </span>
                  ) : null}
                  <span className="mt-1 flex items-center gap-1.5">
                    <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0.5">
                      {role}
                    </Badge>
                    {org ? (
                      <span className="max-w-[10rem] truncate text-[11px] text-slate-400">
                        {org.name}
                      </span>
                    ) : null}
                  </span>
                </span>
              </span>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuGroup>
            <DropdownMenuItem closeOnClick onClick={() => setPhotoOpen(true)}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <span>Update photo</span>
              <span className="ml-auto text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">New</span>
            </DropdownMenuItem>
            <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings/profile")}>
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
            <DropdownMenuItem closeOnClick={false} onClick={() => toggle()}>
              <IconSettings size={16} />
              Theme: {theme === "dark" ? "Dark" : "Light"}
              <span className="ml-auto text-xs text-muted-foreground">Toggle</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuGroup>
            <div className="px-2 pt-1 pb-0.5 text-[11px] font-semibold text-slate-400">
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
                <span className="ml-auto text-xs text-slate-400 capitalize">{o.role}</span>
                {o.id === org?.id ? <span className="cmdk-hint">current</span> : null}
              </DropdownMenuItem>
            ))}
            {orgs.length > 5 ? (
              <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings#organizations")}>
                <IconBuilding size={16} />
                View all {orgs.length} workspaces
              </DropdownMenuItem>
            ) : null}
            {onOpenNotifs ? (
              <DropdownMenuItem closeOnClick onClick={onOpenNotifs}>
                <IconBell size={16} />
                Notifications
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          <Separator className="my-1 bg-white/10" />
          <DropdownMenuItem closeOnClick variant="destructive" onClick={() => void signOut()}>
            <IconLogout size={16} />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {photoOpen ? (
        <PhotoComponent
          name={name}
          currentPhotoUrl={photoUrl}
          onSavePhoto={(url) => {
            setPhotoUrl(url);
            toast({ title: "Photo updated", msg: "Profile avatar changed successfully." });
            setPhotoOpen(false);
          }}
          trigger={() => null}
          onClose={() => setPhotoOpen(false)}
        />
      ) : null}
    </>
  );
}
