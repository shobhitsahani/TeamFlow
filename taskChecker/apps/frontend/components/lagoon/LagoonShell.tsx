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
import { Button } from "@/components/ui/button";
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
  IconPlus,
  IconPulse,
  IconUser,
  IconUsers,
  IconX,
} from "@/components/icons";
import { suggestLagoonKey } from "./lagoon-utils";
import { QuickChat } from "./quick-chat";
import { CreateOrgDialog, OrgGlyph } from "@/components/org/org-dialogs";

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
    { href: "/app/settings/members", label: "Members", icon: IconUsers, on: pathname.startsWith("/app/settings/members") },
  ];

  return (
    <LagoonAuthGate>
      <LagoonChromeCtx.Provider value={{ openMenu, openPalette, openNotifs, openNewBoard }}>
        <div className="lagoon lagoon-shell">
          <AnimatePresence>
            {sidebarOpen ? (
              <motion.button
                key="lagoon-scrim"
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgb(15 23 42 / 0.4)" }}
                className="lagoon-only-mobile"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: DUR.fast, ease: "easeOut" }}
              />
            ) : null}
          </AnimatePresence>
          <aside className={cx("lagoon-side", !sidebarOpen && "is-closed")} aria-label="Workspace navigation">
            <div className="lagoon-side-brand">
              <Link
                href="/app/work"
                className="flex items-center gap-2.5 min-w-0"
                style={{ textDecoration: "none", color: "inherit" }}
                title="TeamFlow home"
                aria-label="TeamFlow home"
              >
                <img
                  src="/logo_mark.png"
                  alt=""
                  aria-hidden="true"
                  width={30}
                  height={30}
                  className="lagoon-side-mark"
                />
                <span className="lagoon-display" style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  TeamFlow
                </span>
              </Link>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      aria-label="Close menu"
                      onClick={() => setSidebarOpen(false)}
                      className="lagoon-icon-btn lagoon-only-mobile"
                      style={{ marginLeft: "auto" }}
                    />
                  }
                >
                  <IconX size={16} />
                </TooltipTrigger>
                <TooltipContent>Close menu</TooltipContent>
              </Tooltip>
            </div>
            {/* Active workspace display — static unclickable card with create organization plus button */}
            <div className="lagoon-side-ws-wrap">
              <div className="lagoon-side-ws" aria-label="Current workspace">
                <OrgGlyph name={org?.name ?? "Workspace"} hue={org?.hue ?? 0} size={28} />
                <div style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {org?.name ?? "Workspace"}
                  </span>
                  {org?.role ? (
                    <span style={{ display: "block", fontSize: 11, color: "var(--lagoon-muted-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {org.role.charAt(0).toUpperCase() + org.role.slice(1)}
                    </span>
                  ) : null}
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
                      className="lagoon-side-ws-new"
                    />
                  }
                >
                  <IconPlus size={14} />
                </TooltipTrigger>
                <TooltipContent>New organization</TooltipContent>
              </Tooltip>
            </div>

            {/* Organizations navigation — list of organizations for quick 1-click switching */}
            <nav style={{ padding: "14px 12px 0" }} aria-label="Organizations">
              <p className="lagoon-nav-label" style={{ padding: "0 8px 4px", margin: 0 }}>
                Organizations
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 180, overflowY: "auto" }}>
                {orgs.map((o) => {
                  const isCurrent = o.id === org?.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={cx("lagoon-nav-link", isCurrent && "is-on")}
                      style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}
                      onClick={() => {
                        if (!isCurrent) void handleSwitchOrg(o.id, o.name);
                      }}
                      aria-current={isCurrent ? "true" : undefined}
                      title={isCurrent ? `${o.name} (current)` : `Switch to ${o.name}`}
                      disabled={switchingOrgId === o.id}
                    >
                      <OrgGlyph name={o.name} hue={o.hue} size={18} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {o.name}
                      </span>
                      {isCurrent ? <IconCheck size={13} className="shrink-0 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </nav>

            <nav style={{ padding: "16px 12px 0" }} aria-label="Workspace sections">
              <p className="lagoon-nav-label">Workspace</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {nav.map(({ href, label, icon: Icon, on }) => (
                  <Link
                    key={label}
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={cx("lagoon-nav-link", on && "is-on")}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                ))}
              </div>
            </nav>

            {/* Quick chat — live org chat preview below the Members nav item. */}
            <QuickChat />

            <nav style={{ padding: "16px 12px 0", overflowY: "auto" }} aria-label="Boards">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 4px 4px 8px" }}>
                <p className="lagoon-nav-label" style={{ padding: 0, margin: 0 }}>
                  Boards
                </p>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label="Create new board"
                        onClick={openNewBoard}
                        className="lagoon-side-ws-new"
                        style={{
                          width: 28,
                          minHeight: 28,
                        }}
                      />
                    }
                  >
                    <IconPlus size={14} />
                  </TooltipTrigger>
                  <TooltipContent>Create new board</TooltipContent>
                </Tooltip>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {projects.map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-current={p.id === activeProjectId ? "true" : undefined}
                    onClick={() => {
                      onSelectProject(p.id);
                      setSidebarOpen(false);
                      router.push(`/app/board?project=${p.id}`);
                    }}
                    className={cx(
                      "lagoon-board-link w-full justify-start font-normal",
                      p.id === activeProjectId && "is-on"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 9999,
                        background: "var(--lagoon-gold)",
                        flex: "none",
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                  </Button>
                ))}
                {newBoardOpen ? (
                  <form onSubmit={submitCreate} className="lagoon-side-form" style={{ marginTop: 4 }}>
                    <Field>
                      <FieldLabel htmlFor="lagoon-board-name" className="sr-only">
                        Board name
                      </FieldLabel>
                      <Input
                        id="lagoon-board-name"
                        autoFocus
                        value={newBoardName}
                        onChange={(e) => setNewBoardName(e.target.value)}
                        placeholder="Board name"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="lagoon-board-key" className="sr-only">
                        Board key
                      </FieldLabel>
                      <Input
                        id="lagoon-board-key"
                        value={keyTouched ? newBoardKey : suggestLagoonKey(newBoardName)}
                        onChange={(e) => {
                          setKeyTouched(true);
                          setNewBoardKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                        }}
                        placeholder="KEY"
                        maxLength={10}
                        style={{ marginTop: 6, fontFamily: "var(--font-mono)" }}
                      />
                    </Field>
                    <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!newBoardName.trim() || !effectiveKey || creating}
                        loading={creating}
                      >
                        Create
                      </Button>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Cancel"
                              style={{ color: "#fff" }}
                              onClick={() => setNewBoardOpen(false)}
                            />
                          }
                        >
                          <IconX size={16} />
                        </TooltipTrigger>
                        <TooltipContent>Cancel</TooltipContent>
                      </Tooltip>
                    </div>
                  </form>
                ) : null}
              </div>
            </nav>

            <div style={{ marginTop: "auto", padding: "12px 0 0" }}>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      size="sm"
                      onClick={openNewBoard}
                      className="lagoon-new-board-btn w-[calc(100%-24px)] justify-center"
                    />
                  }
                >
                  <IconPlus size={16} /> New board
                </TooltipTrigger>
                <TooltipContent>Create new board</TooltipContent>
              </Tooltip>
            </div>
          </aside>

          {/* Subtle section fade on route change (120ms) — keyed by pathname
              only, so query-only switches (project/view) don't remount state. */}
          <motion.div
            key={pathname}
            className="lagoon-main"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DUR.instant, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </div>

        {paletteOpen ? <DynamicCommandPalette onClose={() => setPaletteOpen(false)} /> : null}
        <DynamicNotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
        <CreateOrgDialog open={showNewOrg} onClose={() => { setShowNewOrg(false); void onProjectsChanged(); }} />
      </LagoonChromeCtx.Provider>
    </LagoonAuthGate>
  );
}
