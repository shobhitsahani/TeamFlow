/* Lagoon shell — joyful sidebar chrome ported from treloo-joyful-design.
   Ocean sidebar + workspace nav + boards list + new-board creation, backed
   by the real projects API. Also owns the ⌘K palette + notification sheet
   so Lagoon pages keep full app functionality. */

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
import { api, type Project } from "@/lib/api";
import { cx } from "@/lib/utils";
import { AnimatePresence, DUR, motion } from "@/components/motion";
import { LiquidNavbar } from "@/components/ui/liquid-glass-navbar";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  IconBoard,
  IconCheck,
  IconFlowMark,
  IconFolder,
  IconLayers,
  IconListTodo,
  IconMessageSquare,
  IconPlus,
  IconPulse,
  IconUser,
  IconUsers,
  IconX,
  IconSearch,
  IconBell,
  IconMenu,
} from "@/components/icons";
import { suggestLagoonKey } from "./lagoon-utils";
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
  { loading: () => <div className="cmdk-loading" role="status" aria-label="Loading command palette"><Skeleton className="mx-auto h-10 w-full max-w-md rounded-md" /></div>, ssr: false },
);

const DynamicNotifSheet = dynamic(
  () => import("@/components/notif-sheet").then((mod) => mod.NotifSheet),
  { loading: () => null, ssr: false },
);

/** Route guard — Lagoon pages require a live session, like /app. */
function LagoonAuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/auth/sign-in");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="lagoon" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        {isLoading ? (
          <div className="flex flex-col items-center gap-3" role="status" aria-label="Loading session">
            <Skeleton className="size-10 rounded-xl" />
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        ) : (
          <a href="/auth/sign-in" className="lagoon-create-btn">
            <IconFlowMark size={14} /> Sign in to continue
          </a>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export interface LagoonShellProps {
  children: ReactNode;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onProjectsChanged: () => Promise<unknown>;
}

export function LagoonShell({
  children,
  projects,
  activeProjectId,
  onSelectProject,
  onProjectsChanged,
}: LagoonShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const { org, orgs, setOrg } = useTenant();
  const { user, logout, isLoading: authLoading } = useAuth();
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

  // ⌘K / Ctrl+K toggles the command palette, like the main AppShell.
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
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again." });
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
    { href: "/app/work", label: "Work", icon: IconListTodo, on: pathname.startsWith("/app/work") },
    { href: "/app/library", label: "Library", icon: IconFolder, on: pathname.startsWith("/app/library") },
    { href: "/app/activity", label: "Activity", icon: IconPulse, on: pathname.startsWith("/app/activity") },
    { href: "/app/chat", label: "Chat", icon: IconMessageSquare, on: pathname.startsWith("/app/chat") },
    { href: "/app/settings/members", label: "Members", icon: IconUsers, on: pathname.startsWith("/app/settings/members") },
  ];

  const currentNav = nav.find((n) => n.on) ?? { label: "Work" };

  const liquidNavItems = nav.map(({ href, label, icon: Icon }) => ({
    label,
    icon: <Icon size={16} />,
    fx: "glow" as const,
  }));
  const activeNavIndex = Math.max(0, nav.findIndex((n) => n.on));

  return (
    <LagoonAuthGate>
      <LagoonChromeCtx.Provider value={{ openMenu, openPalette, openNotifs, openNewBoard }}>
        <div className="lagoon lagoon-shell flex h-screen w-full overflow-hidden bg-[#0c1017] text-slate-100">
          {/* Mobile backdrop */}
          <AnimatePresence>
            {sidebarOpen ? (
              <motion.button
                key="lagoon-scrim"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
                className="lagoon-only-mobile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>

          {/* Left Sidebar */}
          <aside
            className={cx(
              "lagoon-side flex flex-col w-64 shrink-0 bg-[#0e131b] border-r border-white/8 transition-transform duration-200 z-50",
              !sidebarOpen && "is-closed",
            )}
            aria-label="Workspace navigation"
          >
            {/* Brand top */}
            <div className="lagoon-side-brand flex items-center justify-between px-4 py-3.5 border-b border-white/6">
              <Link
                href="/app/work"
                className="flex items-center gap-2.5 min-w-0 group"
                style={{ textDecoration: "none", color: "inherit" }}
                title="TeamFlow home"
                aria-label="TeamFlow home"
              >
                <div className="relative flex items-center justify-center size-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 shadow-md shadow-purple-500/20 ring-1 ring-white/20">
                  <img
                    src="/logo_mark.png"
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                    className="drop-shadow-sm"
                  />
                </div>
                <span className="font-bold text-base tracking-tight text-white group-hover:text-purple-300 transition-colors">
                  TeamFlow
                </span>
              </Link>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      aria-label="Close menu"
                      onClick={() => setSidebarOpen(false)}
                      className="lagoon-icon-btn lagoon-only-mobile rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-white/5"
                    />
                  }
                >
                  <IconX size={16} />
                </TooltipTrigger>
                <TooltipContent>Close menu</TooltipContent>
              </Tooltip>
            </div>

            {/* Active workspace display & new org trigger */}
            <div className="px-3 pt-3">
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/6 hover:bg-white/[0.06] transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <OrgGlyph name={org?.name ?? "Workspace"} hue={org?.hue ?? 0} size={26} />
                  <div className="min-w-0">
                    <span className="block text-xs font-semibold text-white truncate">
                      {org?.name ?? "Workspace"}
                    </span>
                    <span className="block text-[10px] text-slate-400 capitalize truncate">
                      {org?.role ?? "Member"}
                    </span>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Create new organization"
                        title="New organization"
                        onClick={() => setShowNewOrg(true)}
                        className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      />
                    }
                  >
                    <IconPlus size={14} />
                  </TooltipTrigger>
                  <TooltipContent>New organization</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Organizations Quick Switcher */}
            <nav className="px-3 pt-3" aria-label="Organizations">
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                Organizations
              </p>
              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                {orgs.map((o) => {
                  const isCurrent = o.id === org?.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={cx(
                        "flex items-center gap-2.5 w-full px-2.5 py-1.5 text-xs font-medium rounded-lg text-left transition-all",
                        isCurrent
                          ? "bg-primary/20 text-white font-semibold shadow-xs ring-1 ring-primary/40"
                          : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                      )}
                      onClick={() => {
                        if (!isCurrent) void handleSwitchOrg(o.id, o.name);
                      }}
                      aria-current={isCurrent ? "true" : undefined}
                      disabled={switchingOrgId === o.id}
                    >
                      <OrgGlyph name={o.name} hue={o.hue} size={16} />
                      <span className="truncate flex-1">{o.name}</span>
                      {isCurrent ? <IconCheck size={12} className="shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Workspace Sections Nav */}
            <nav className="px-3 pt-4" aria-label="Workspace sections">
              <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                Workspace
              </p>
              <div className="flex flex-col gap-1">
                {nav.map(({ href, label, icon: Icon, on }) => (
                  <Link
                    key={label}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "relative flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-all",
                      on
                        ? "bg-primary text-white shadow-sm font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                    )}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={16} className={on ? "text-white" : "text-slate-400"} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </nav>

            {/* Boards Section */}
            <nav className="px-3 pt-4 flex-1 overflow-y-auto" aria-label="Boards">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                  Boards
                </p>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Create new board"
                        onClick={openNewBoard}
                        className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
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
                      "flex items-center gap-2.5 px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors",
                      p.id === activeProjectId
                        ? "bg-white/10 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
                    )}
                  >
                    <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}

                {newBoardOpen ? (
                  <form onSubmit={submitCreate} className="p-2 mt-1 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2">
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
                      <Button type="submit" size="sm" className="h-7 text-xs flex-1" disabled={!newBoardName.trim() || creating} loading={creating}>
                        Create
                      </Button>
                      <button
                        type="button"
                        onClick={() => setNewBoardOpen(false)}
                        className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/10"
                      >
                        <IconX size={14} />
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </nav>

            {/* User Profile Card at Sidebar Bottom (Ready for Photo Component) */}
            <div className="p-3 border-t border-white/8 bg-black/20">
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
                    <span className="block text-[10px] text-slate-400 truncate">
                      {user?.email ?? "online"}
                    </span>
                  </div>
                </button>
                <UserMenu onOpenPalette={openPalette} onOpenNotifs={openNotifs} />
              </div>
            </div>
          </aside>

          {/* Main Area: Top Bar + Content */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            {/* Top Bar Header */}
            <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-white/8 bg-[#0c1017]/80 backdrop-blur-md z-30">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="lagoon-only-mobile p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                  aria-label="Open sidebar"
                >
                  <IconMenu size={18} />
                </button>
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span className="text-slate-400">{org?.name ?? "Workspace"}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-white font-semibold">{currentNav.label}</span>
                </div>
              </div>

              {/* Right tools */}
              <div className="flex items-center gap-2.5">
                {/* ⌘K Command Palette trigger */}
                <button
                  type="button"
                  onClick={openPalette}
                  className="flex items-center gap-3 px-3 py-1.5 text-xs text-slate-400 bg-white/[0.04] hover:bg-white/[0.08] hover:text-slate-200 border border-white/8 rounded-xl transition-all shadow-xs"
                >
                  <IconSearch size={14} className="text-slate-400" />
                  <span className="hidden sm:inline">Search anything...</span>
                  <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/10 font-mono text-slate-300">
                    ⌘K
                  </kbd>
                </button>

                {/* Notifications */}
                <button
                  type="button"
                  onClick={openNotifs}
                  className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                  aria-label="Notifications"
                >
                  <IconBell size={16} />
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-[#0c1017]" />
                </button>

                {/* Photo Component trigger / Avatar in Top Bar */}
                <button
                  type="button"
                  onClick={() => setPhotoModalOpen(true)}
                  className="relative rounded-full ring-1 ring-white/10 hover:ring-primary/60 transition-all p-0.5"
                  title="Update photo"
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
            </header>

            {/* Page content with smooth fade entrance */}
            <motion.div
              key={pathname}
              className="flex-1 overflow-y-auto lagoon-main"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </div>

        {/* Dynamic Dialogs & Modals */}
        {paletteOpen ? <DynamicCommandPalette onClose={() => setPaletteOpen(false)} /> : null}
        <DynamicNotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
        <CreateOrgDialog open={showNewOrg} onClose={() => { setShowNewOrg(false); void onProjectsChanged(); }} />

        {/* Global PhotoComponent Modal */}
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
