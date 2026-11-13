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
  IconBoard,
  IconCheck,
  IconFolder,
  IconLayers,
  IconListTodo,
  IconMessageSquare,
  IconPlus,
  IconPulse,
  IconSettings,
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
import { UserMenu } from "@/components/user/user-menu";
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
  const { user } = useAuth();
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
        <div className="tf-app-scope tf-ambient-canvas flex h-screen w-full overflow-hidden text-slate-100">
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
              "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r lg:static lg:translate-x-0 transition-transform duration-200 ease-out",
              sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            )}
            aria-label="Workspace navigation"
          >
            {/* Brand top */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
              <Link
                href="/app/work"
                className="group flex min-w-0 items-center gap-2.5 outline-none"
                title="TeamFlow Home"
                aria-label="TeamFlow Home"
              >
                <div className="relative flex size-8 items-center justify-center rounded-xl bg-purple-600/30 border border-purple-500/40 shadow-xs">
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
                  <span className="block font-bold text-base tracking-tight text-white group-hover:text-purple-300 transition-colors">
                    TeamFlow
                  </span>
                  <span className="block text-[10px] text-zinc-400 truncate">
                    Quiet Harbor
                  </span>
                </div>
              </Link>

              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 lg:hidden"
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Tenant isolation & Role header */}
            <div className="p-3">
              <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <OrgGlyph name={org?.name ?? "Workspace"} hue={org?.hue ?? 0} size={24} />
                    <span className="truncate text-xs font-semibold text-white">
                      {org?.name ?? "Workspace"}
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Create organization"
                          onClick={() => setShowNewOrg(true)}
                          className="rounded-md p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        />
                      }
                    >
                      <IconPlus size={14} />
                    </TooltipTrigger>
                    <TooltipContent>New organization</TooltipContent>
                  </Tooltip>
                </div>

                {/* Scoped RBAC Role Badge */}
                <div className="flex items-center justify-between border-t border-white/[0.06] pt-1.5">
                  <span className="text-[10px] font-medium text-zinc-400">Permissions:</span>
                  <RoleBadge role={org?.role ?? "member"} />
                </div>
              </div>
            </div>

            {/* Organizations Switcher */}
            {orgs.length > 1 && (
              <nav className="px-3 pb-2" aria-label="Organizations">
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-zinc-400 select-none">
                  Switch Org
                </p>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto pr-1">
                  {orgs.map((o) => {
                    const isCurrent = o.id === org?.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        className={cx(
                          "flex items-center gap-2 w-full px-2 py-1 text-xs rounded-lg text-left transition-colors",
                          isCurrent
                            ? "bg-purple-600/20 text-white font-medium border border-purple-500/30"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5",
                        )}
                        onClick={() => {
                          if (!isCurrent) void handleSwitchOrg(o.id, o.name);
                        }}
                        aria-current={isCurrent ? "true" : undefined}
                        disabled={switchingOrgId === o.id}
                      >
                        <OrgGlyph name={o.name} hue={o.hue} size={14} />
                        <span className="truncate flex-1">{o.name}</span>
                        {isCurrent ? <IconCheck size={12} className="text-purple-400 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              </nav>
            )}

            {/* Navigation items */}
            <LagoonWorkspaceNav items={nav} onNavigate={() => setSidebarOpen(false)} />

            {/* Boards section */}
            <nav className="px-3 pt-3 flex-1 overflow-y-auto" aria-label="Boards">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-zinc-400 select-none">
                  Boards
                </p>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Create new board"
                        onClick={openNewBoard}
                        className="rounded-md p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
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
                        ? "bg-white/10 text-white font-semibold border border-white/10 shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5",
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}

                {newBoardOpen ? (
                  <form onSubmit={submitCreate} className="p-2 mt-1 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col gap-2">
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
                        className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-white/10"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </nav>

            {/* Sidebar User Profile Footer */}
            <div className="p-3 border-t border-white/[0.08] bg-black/20">
              <div className="flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="flex items-center gap-2.5 min-w-0 text-left rounded-xl p-1 -m-1 hover:bg-white/5 transition-colors group flex-1"
                  title="Click to change photo"
                >
                  <UserAvatar
                    name={user?.name ?? "User"}
                    src={photoUrl}
                    seed={user?.id}
                    size="default"
                    status="online"
                    editable
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                      {user?.name ?? "User"}
                    </span>
                    <span className="block text-[10px] text-zinc-400 truncate">
                      {user?.email ?? "online"}
                    </span>
                  </div>
                </button>
                <UserMenu onOpenPalette={openPalette} onOpenNotifs={openNotifs} />
              </div>
            </div>
          </GlassSurface>

          {/* Main Content Area: Floating Glass Top Bar + Content */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            {/* Floating Glass Top Bar Header (Elevation 2) */}
            <GlassSurface
              as="header"
              elevation={2}
              className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.08] z-30"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 lg:hidden tf-touch-target"
                  aria-label="Open sidebar navigation"
                >
                  <IconMenu size={18} />
                </button>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="text-zinc-400 hidden sm:inline">{org?.name ?? "Workspace"}</span>
                  <span className="text-zinc-600 hidden sm:inline">/</span>
                  <span className="text-white font-semibold">{currentNav.label}</span>
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
                  className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-zinc-400 bg-white/[0.04] hover:bg-white/[0.08] hover:text-zinc-200 border border-white/[0.08] rounded-xl transition-all shadow-xs"
                >
                  <IconSearch size={14} className="text-zinc-400" />
                  <span className="hidden sm:inline">Search…</span>
                  <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono text-zinc-300">
                    ⌘K
                  </kbd>
                </button>

                {/* Notifications Button */}
                <button
                  type="button"
                  onClick={openNotifs}
                  className="relative p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors tf-touch-target flex items-center justify-center"
                  aria-label="Notifications"
                >
                  <IconBell size={16} />
                  {unread > 0 && (
                    <span className="absolute top-2 right-2 size-2 rounded-full bg-purple-500 ring-2 ring-black" />
                  )}
                </button>

                {/* User Avatar */}
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="relative rounded-full ring-1 ring-white/10 hover:ring-purple-400/60 transition-all p-0.5"
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
              className="flex-1 overflow-y-auto"
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
