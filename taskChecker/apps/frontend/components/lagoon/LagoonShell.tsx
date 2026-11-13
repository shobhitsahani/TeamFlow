/* TeamFlow Unified Glassmorphic App Shell
   Floating Glass Layers (Elevation Level 2) for Sidebar and Top Bar
   Realtime status indicator with pulsing dot
   Tenant isolation & Scoped RBAC role badge visible at all times
   Keyboard shortcuts (⌘K search, c new board)
   Responsive mobile drawer with 44px min touch targets
*/

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/store";
import { useToast } from "@/components/overlay";
import { api, getCurrentTenantId, type Project } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { useRealtime } from "@/lib/realtime";
import { cx } from "@/lib/utils";
import { AnimatePresence, DUR, motion } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GlassSurface } from "@/components/ui/glass-surface";
import { RealtimeStatusBadge } from "@/components/ui/realtime-status-badge";
import { RoleBadge } from "@/components/ui/role-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";
import {
  IconBoard,
  IconCheck,
  IconChevronDown,
  IconFolder,
  IconLayers,
  IconListTodo,
  IconLogout,
  IconMessageSquare,
  IconPlus,
  IconPulse,
  IconSettings,
  IconUser,
  IconUsers,
  IconX,
  IconSearch,
  IconBell,
  IconMenu,
} from "@/components/icons";
import { suggestLagoonKey } from "./lagoon-utils";
import { LagoonWorkspaceNav } from "./LagoonWorkspaceNav";
import { CreateOrgDialog, OrgGlyph } from "@/components/org/org-dialogs";
import { UserAvatar } from "@/components/user/user-avatar";
import { PhotoComponent } from "@/components/user/photo-component";
import { useUserPhoto } from "@/lib/avatar-store";

/* ---------- chrome context (menu / palette / notifications) ---------- */

interface LagoonChrome {
  openMenu: () => void;
  openPalette: () => void;
  openNotifs: () => void;
  openNewBoard: () => void;
}

const LagoonChromeCtx = createContext<LagoonChrome>({
  openMenu: () => {},
  openPalette: () => {},
  openNotifs: () => {},
  openNewBoard: () => {},
});

export function useLagoonChrome(): LagoonChrome {
  return useContext(LagoonChromeCtx);
}

const DynamicCommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => mod.CommandPalette),
  {
    loading: () => (
      <div className="cmdk-loading" role="status" aria-label="Loading command palette">
        <Skeleton className="mx-auto h-10 w-full max-w-md rounded-md" />
      </div>
    ),
    ssr: false,
  },
);

const DynamicNotifSheet = dynamic(
  () => import("@/components/notif-sheet").then((mod) => mod.NotifSheet),
  { loading: () => null, ssr: false },
);

/** Route guard — requires a live session for all /app routes */
function LagoonAuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth/sign-in");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="tf-app-scope" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        {isLoading ? (
          <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading session">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ) : (
          <a href="/auth/sign-in" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors">
            Sign in to continue
          </a>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export interface LagoonShellProps {
  children: ReactNode;
  projects?: Project[];
  activeProjectId?: string;
  onSelectProject?: (id: string) => void;
  onProjectsChanged?: () => Promise<unknown>;
}

export function LagoonShell({
  children,
  projects: propProjects,
  activeProjectId: propActiveProjectId,
  onSelectProject: propOnSelectProject,
  onProjectsChanged: propOnProjectsChanged,
}: LagoonShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { org, orgs, setOrg, unread } = useTenant();
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const { photoUrl, setPhotoUrl } = useUserPhoto();
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [newBoardOpen, setNewBoardOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardKey, setNewBoardKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(true);

  // Realtime connection hook
  useRealtime({
    onConnect: () => setRealtimeConnected(true),
    onDisconnect: () => setRealtimeConnected(false),
  });

  // Fallback project loading when props are not provided
  const orgId = getCurrentTenantId();
  const internalProjectsQ = useSWR<{ projects: Project[] }>(
    !propProjects && orgId ? `shell-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );

  const projects = propProjects ?? (internalProjectsQ.data?.projects ?? []);
  const onProjectsChanged = propOnProjectsChanged ?? (() => internalProjectsQ.mutate());
  const [internalActiveId, setInternalActiveId] = useState<string>("");
  const activeProjectId = propActiveProjectId ?? internalActiveId;
  const onSelectProject = propOnSelectProject ?? setInternalActiveId;

  const openMenu = useCallback(() => setSidebarOpen(true), []);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openNotifs = useCallback(() => setNotifOpen(true), []);
  const openNewBoard = useCallback(() => {
    setNewBoardName("");
    setNewBoardKey("");
    setKeyTouched(false);
    setNewBoardOpen(true);
    setSidebarOpen(true);
  }, []);

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const effectiveKey = (keyTouched ? newBoardKey : suggestLagoonKey(newBoardName))
    .trim()
    .toUpperCase();

  const handleCreateBoard = useCallback(async () => {
    const name = newBoardName.trim();
    if (!name || !effectiveKey || creating) return;
    setCreating(true);
    try {
      const result = await api.projects.create({ name, key: effectiveKey });
      setNewBoardOpen(false);
      setNewBoardName("");
      setNewBoardKey("");
      setKeyTouched(false);
      await onProjectsChanged();
      onSelectProject(result.project.id);
      router.push(`/app/board?project=${result.project.id}`);
      toast({ title: "Board created", msg: `${name} is ready.` });
    } catch (err) {
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setCreating(false);
    }
  }, [newBoardName, effectiveKey, creating, onProjectsChanged, onSelectProject, router, toast]);

  const submitCreate = (e: FormEvent) => {
    e.preventDefault();
    void handleCreateBoard();
  };

  const handleSwitchOrg = useCallback(
    async (id: string, name: string) => {
      if (id === org?.id || switchingOrgId) return;
      setSwitchingOrgId(id);
      try {
        await setOrg(id);
        toast({ title: `Switched to ${name}`, msg: "Scoped to this tenant now." });
        setSidebarOpen(false);
        router.push("/app/board");
        await onProjectsChanged();
      } catch (err) {
        toast({ title: "Switch failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
      } finally {
        setSwitchingOrgId(null);
      }
    },
    [org?.id, switchingOrgId, setOrg, toast, router, onProjectsChanged],
  );

  const nav = [
    { href: "/app/board", label: "Boards", icon: IconBoard, on: pathname.startsWith("/app/board") },
    { href: "/app/projects", label: "Projects", icon: IconLayers, on: pathname.startsWith("/app/projects") },
    { href: "/app/teams", label: "Teams", icon: IconUsers, on: pathname.startsWith("/app/teams") },
    { href: "/app/work", label: "Work", icon: IconListTodo, on: pathname.startsWith("/app/work") },
    { href: "/app/library", label: "Library", icon: IconFolder, on: pathname.startsWith("/app/library") },
    { href: "/app/activity", label: "Activity", icon: IconPulse, on: pathname.startsWith("/app/activity"), badge: unread },
    { href: "/app/chat", label: "Chat", icon: IconMessageSquare, on: pathname.startsWith("/app/chat") },
    { href: "/app/settings", label: "Settings", icon: IconSettings, on: pathname.startsWith("/app/settings") },
  ];

  const currentNav = nav.find((n) => n.on) ?? { label: "App" };

  return (
    <LagoonAuthGate>
      <LagoonChromeCtx.Provider value={{ openMenu, openPalette, openNotifs, openNewBoard }}>
        <div className="tf-app-scope tf-ambient-canvas flex h-screen w-full overflow-hidden text-[var(--tf-fg)]">
          {/* Mobile backdrop scrim */}
          <AnimatePresence>
            {sidebarOpen ? (
              <motion.button
                key="sidebar-scrim"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>

          {/* Left Floating Glass Sidebar (Elevation 2) */}
          <GlassSurface
            as="aside"
            elevation={2}
            className={cx(
              "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--tf-border)] lg:static lg:translate-x-0 transition-transform duration-200 ease-out",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            )}
            aria-label="Workspace navigation"
          >
            {/* Brand top */}
            <div className="flex items-center justify-between border-b border-[var(--tf-border)] px-4 py-3.5">
              <Link
                href="/app/work"
                className="group flex min-w-0 items-center gap-2.5 outline-none"
                title="TeamFlow Home"
                aria-label="TeamFlow Home"
              >
                <div className="relative flex size-8 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30 shadow-xs">
                  <img
                    src="/logo_mark.png"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                    className="drop-shadow-xs"
                  />
                </div>
                <div className="min-w-0">
                  <span className="block font-bold text-base tracking-tight text-[var(--tf-fg)] group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                    TeamFlow
                  </span>
                  <span className="block text-[10px] text-[var(--tf-fg-muted)] truncate">
                    Quiet Harbor
                  </span>
                </div>
              </Link>

              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] lg:hidden"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Scoped Tenant & Org Switcher Dropdown */}
            <div className="p-3">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Switch organization. Current: ${org?.name ?? "Workspace"}`}
                      className="group flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--tf-border)] bg-[var(--tf-hover-bg)] p-2 text-left hover:bg-[var(--tf-active-bg)] transition-all outline-none"
                    />
                  }
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <OrgGlyph name={org?.name ?? "Workspace"} hue={org?.hue ?? 0} size={22} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-[var(--tf-fg)]">
                        {org?.name ?? "Workspace"}
                      </span>
                      <div className="mt-0.5">
                        <RoleBadge role={org?.role ?? "member"} />
                      </div>
                    </div>
                  </div>
                  <IconChevronDown size={14} className="shrink-0 text-[var(--tf-fg-muted)] group-hover:text-[var(--tf-fg)] transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 glass-surface-2 p-1.5 shadow-xl">
                  <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--tf-fg-muted)]">
                    Organizations
                  </DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {orgs.map((o) => {
                      const isCurrent = o.id === org?.id;
                      return (
                        <DropdownMenuItem
                          key={o.id}
                          closeOnClick
                          disabled={isCurrent || switchingOrgId === o.id}
                          onClick={() => void handleSwitchOrg(o.id, o.name)}
                          className={cx(
                            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer",
                            isCurrent && "bg-purple-500/15 text-purple-700 dark:text-purple-300 font-medium"
                          )}
                        >
                          <OrgGlyph name={o.name} hue={o.hue} size={16} />
                          <span className="truncate flex-1">{o.name}</span>
                          <span className="text-[10px] capitalize text-[var(--tf-fg-muted)]">{o.role}</span>
                          {isCurrent && <IconCheck size={13} className="text-purple-600 dark:text-purple-400 shrink-0" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="my-1 border-t border-[var(--tf-border)]" />
                  <DropdownMenuItem
                    closeOnClick
                    onClick={() => setShowNewOrg(true)}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
                  >
                    <IconPlus size={14} className="text-[var(--tf-fg-muted)]" />
                    <span>Create organization</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    closeOnClick
                    onClick={() => router.push("/app/settings")}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]"
                  >
                    <IconSettings size={14} />
                    <span>Organization settings</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Navigation items */}
            <LagoonWorkspaceNav items={nav} onNavigate={() => setSidebarOpen(false)} />

            {/* Boards section */}
            <nav className="px-3 pt-3 flex-1 overflow-y-auto" aria-label="Boards">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-[var(--tf-fg-muted)] select-none">
                  Boards
                </p>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Create new board"
                        onClick={openNewBoard}
                        className="rounded-md p-1 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] transition-colors"
                      />
                    }
                  >
                    <IconPlus size={13} />
                  </TooltipTrigger>
                  <TooltipContent>Create new board</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex flex-col gap-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectProject(p.id);
                      setSidebarOpen(false);
                      router.push(`/app/board?project=${p.id}`);
                    }}
                    className={cx(
                      "flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors",
                      p.id === activeProjectId
                        ? "bg-[var(--tf-active-bg)] text-[var(--tf-fg)] font-semibold border border-[var(--tf-border)] shadow-xs"
                        : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}

                {newBoardOpen ? (
                  <form onSubmit={submitCreate} className="p-2 mt-1 rounded-xl bg-[var(--tf-hover-bg)] border border-[var(--tf-border)] flex flex-col gap-2">
                    <Input
                      autoFocus
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      placeholder="Board name"
                      className="text-xs h-8"
                    />
                    <Input
                      value={keyTouched ? newBoardKey : suggestLagoonKey(newBoardName)}
                      onChange={(e) => {
                        setKeyTouched(true);
                        setNewBoardKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                      }}
                      placeholder="KEY"
                      maxLength={10}
                      className="text-xs h-8 font-mono"
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="h-7 text-xs flex-1 bg-purple-600 hover:bg-purple-500 text-white" disabled={!newBoardName.trim() || creating} loading={creating}>
                        Create
                      </Button>
                      <button
                        type="button"
                        onClick={() => setNewBoardOpen(false)}
                        className="p-1 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] rounded-md hover:bg-[var(--tf-hover-bg)]"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </nav>

            {/* Single User Menu in Sidebar Footer with Theme Switcher */}
            <div className="p-3 border-t border-[var(--tf-border)] bg-[var(--tf-hover-bg)]">
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`User menu for ${user?.name ?? "User"}`}
                      className="group flex w-full items-center justify-between gap-2.5 rounded-xl p-1 text-left hover:bg-[var(--tf-hover-bg)] transition-colors outline-none"
                    />
                  }
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <UserAvatar
                      name={user?.name ?? "User"}
                      src={photoUrl}
                      seed={user?.id}
                      size="default"
                      status="online"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-[var(--tf-fg)] truncate group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                        {user?.name ?? "User"}
                      </span>
                      <span className="block text-[10px] text-[var(--tf-fg-muted)] truncate">
                        {user?.email ?? "online"}
                      </span>
                    </div>
                  </div>
                  <IconChevronDown size={14} className="shrink-0 text-[var(--tf-fg-muted)] group-hover:text-[var(--tf-fg)] transition-colors" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 glass-surface-2 p-1.5 shadow-xl">
                  <DropdownMenuLabel className="px-2 py-1.5">
                    <div className="text-xs font-semibold text-[var(--tf-fg)] truncate">{user?.name ?? "User"}</div>
                    <div className="text-[10px] text-[var(--tf-fg-muted)] truncate">{user?.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-1 border-t border-[var(--tf-border)]" />
                  <DropdownMenuItem
                    closeOnClick
                    onClick={() => router.push("/app/settings/profile")}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer"
                  >
                    <IconUser size={14} />
                    <span>Profile settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    closeOnClick
                    onClick={() => setPhotoModalOpen(true)}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer"
                  >
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--tf-fg-muted)]">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                    <span>Change avatar photo</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    closeOnClick={false}
                    onClick={() => toggleTheme()}
                    className="flex items-center justify-between px-2 py-1.5 text-xs rounded-lg cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      {theme === "dark" ? <Moon size={14} className="text-purple-400" /> : <Sun size={14} className="text-amber-500" />}
                      <span>Theme: {theme === "dark" ? "Dark" : "Light"}</span>
                    </span>
                    <span className="text-[10px] text-[var(--tf-fg-muted)] font-mono">Toggle</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-1 border-t border-[var(--tf-border)]" />
                  <DropdownMenuItem
                    closeOnClick
                    variant="destructive"
                    onClick={async () => {
                      await logout();
                      toast({ title: "Signed out", msg: "Session ended — see you soon." });
                      router.replace("/auth/sign-in");
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg cursor-pointer text-red-500 focus:text-red-500"
                  >
                    <IconLogout size={14} />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </GlassSurface>

          {/* Main Content Area: Floating Glass Top Bar + Content */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            {/* Floating Glass Top Bar Header (Elevation 2) */}
            <GlassSurface
              as="header"
              elevation={2}
              className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--tf-border)] z-30"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] rounded-lg hover:bg-[var(--tf-hover-bg)] lg:hidden tf-touch-target"
                  aria-label="Open sidebar navigation"
                >
                  <IconMenu size={18} />
                </button>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="text-[var(--tf-fg-muted)] hidden sm:inline">{org?.name ?? "Workspace"}</span>
                  <span className="text-[var(--tf-fg-muted)] opacity-60 hidden sm:inline">/</span>
                  <span className="text-[var(--tf-fg)] font-semibold">{currentNav.label}</span>
                </div>
              </div>

              {/* Header Right Tools */}
              <div className="flex items-center gap-2.5">
                {/* Realtime Status Badge */}
                <RealtimeStatusBadge
                  status={realtimeConnected ? "connected" : "syncing"}
                />

                {/* ⌘K Command Palette search trigger */}
                <button
                  type="button"
                  onClick={openPalette}
                  className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-[var(--tf-fg-muted)] bg-[var(--tf-hover-bg)] hover:bg-[var(--tf-active-bg)] hover:text-[var(--tf-fg)] border border-[var(--tf-border)] rounded-xl transition-all shadow-xs"
                >
                  <IconSearch size={14} className="text-[var(--tf-fg-muted)]" />
                  <span className="hidden sm:inline">Search…</span>
                  <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[var(--tf-fg-muted)]">
                    ⌘K
                  </kbd>
                </button>

                {/* Notifications Button */}
                <button
                  type="button"
                  onClick={openNotifs}
                  className="relative p-2 text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)] rounded-xl transition-colors tf-touch-target flex items-center justify-center"
                  aria-label="Notifications"
                >
                  <IconBell size={16} />
                  {unread > 0 && (
                    <span className="absolute top-2 right-2 size-2 rounded-full bg-purple-500 ring-2 ring-black dark:ring-white" />
                  )}
                </button>

                {/* User Avatar */}
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="relative rounded-full ring-1 ring-[var(--tf-border)] hover:ring-purple-400/60 transition-all p-0.5"
                  title="Update profile photo"
                >
                  <UserAvatar
                    name={user?.name ?? "User"}
                    src={photoUrl}
                    seed={user?.id}
                    size="sm"
                    status="online"
                  />
                </button>
              </div>
            </GlassSurface>

            {/* Route Content with Smooth Transition */}
            <motion.main
              key={pathname}
              className="flex-1 flex flex-col min-h-0 overflow-y-auto"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DUR.fast, ease: "easeOut" }}
            >
              {children}
            </motion.main>
          </div>
        </div>

        {/* Dynamic Modals & Overlays */}
        {paletteOpen ? <DynamicCommandPalette onClose={() => setPaletteOpen(false)} /> : null}
        <DynamicNotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
        <CreateOrgDialog open={showNewOrg} onClose={() => { setShowNewOrg(false); void onProjectsChanged(); }} />

        {photoModalOpen ? (
          <PhotoComponent
            name={user?.name ?? "User"}
            currentPhotoUrl={photoUrl}
            onSavePhoto={(url) => {
              setPhotoUrl(url);
              toast({ title: "Photo saved", msg: "Profile photo updated successfully." });
              setPhotoModalOpen(false);
            }}
            trigger={() => null}
            onClose={() => setPhotoModalOpen(false)}
          />
        ) : null}
      </LagoonChromeCtx.Provider>
    </LagoonAuthGate>
  );
}
