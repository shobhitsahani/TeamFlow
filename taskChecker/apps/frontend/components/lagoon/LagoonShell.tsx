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
import { cx, hueFrom, initials } from "@/lib/utils";
import { AnimatePresence, DUR, motion } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  IconBell,
  IconBoard,
  IconChevronDown,
  IconClock,
  IconFlowMark,
  IconLayers,
  IconLogout,
  IconPlus,
  IconSettings,
  IconUsers,
  IconX,
} from "@/components/icons";
import { suggestLagoonKey } from "./lagoon-utils";

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
  { loading: () => <div className="cmdk-loading">Loading…</div>, ssr: false },
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
          <span style={{ color: "var(--lagoon-muted-fg)", fontSize: 13 }}>Loading session…</span>
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
  const { org } = useTenant();
  const { user, logout, isLoading: authLoading } = useAuth();
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

  const orgInitial = (org?.name || "L").slice(0, 1).toUpperCase();

  const nav = [
    { href: "/app/board", label: "Boards", icon: IconBoard, on: pathname.startsWith("/app/board") },
    { href: "/app/projects", label: "Projects", icon: IconLayers, on: pathname.startsWith("/app/projects") },
    { href: "/app/board?view=calendar", label: "Calendar", icon: IconClock, on: false },
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
                style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgb(15 23 42 / 0.3)" }}
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
              <span className="lagoon-side-mark">{orgInitial}</span>
              <span className="lagoon-display" style={{ fontSize: 15, fontWeight: 600 }}>
                {org?.name ?? "Lagoon"}
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      aria-label="Close menu"
                      onClick={() => setSidebarOpen(false)}
                      className="lagoon-icon-btn lagoon-only-mobile"
                      style={{ marginLeft: "auto", color: "rgb(255 255 255 / 0.7)" }}
                    />
                  }
                >
                  <IconX size={16} />
                </TooltipTrigger>
                <TooltipContent>Close menu</TooltipContent>
              </Tooltip>
            </div>
            {/* Account menu — shadcn Avatar + DropdownMenu over the ocean
                trigger. Same destinations as the /app shell menu (settings,
                notifications, sign out); no new behavior besides the menu. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                render={
                  <button
                    className="lagoon-side-ws"
                    title={user?.email ?? "Workspace"}
                    aria-label="Account menu"
                  />
                }
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    background: "var(--lagoon-coral)",
                    fontSize: 10,
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  {(user?.name || "T").slice(0, 1).toUpperCase()}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {org?.name ?? "Workspace"}
                  </span>
                  <span style={{ display: "block", fontSize: 10, color: "rgb(255 255 255 / 0.55)" }}>
                    {org?.plan ? `${org.plan} plan` : "Free plan"}
                  </span>
                </span>
                <IconChevronDown size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>
                  {authLoading || !user ? (
                    <span className="flex flex-col gap-1.5 py-0.5" aria-hidden>
                      <Skeleton className="h-3.5 w-28 rounded" />
                      <Skeleton className="h-3 w-36 rounded" />
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-2">
                        <Avatar className="size-6">
                          <AvatarFallback
                            style={{
                              background: `hsl(${hueFrom(user.id)} 45% 20%)`,
                              color: `hsl(${hueFrom(user.id)} 80% 78%)`,
                            }}
                          >
                            {initials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="block max-w-full truncate text-sm font-semibold text-foreground">
                          {user.name}
                        </span>
                      </span>
                      {user.email ? (
                        <span className="block max-w-full truncate text-xs font-normal text-muted-foreground">
                          {user.email}
                        </span>
                      ) : null}
                    </>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings")}>
                    <IconSettings size={16} />
                    Workspace settings
                  </DropdownMenuItem>
                  <DropdownMenuItem closeOnClick onClick={openNotifs}>
                    <IconBell size={16} />
                    Notifications
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  closeOnClick
                  variant="destructive"
                  onClick={async () => {
                    await logout();
                    toast({ title: "Signed out", msg: "Session ended — see you soon." });
                    router.replace("/auth/sign-in");
                  }}
                >
                  <IconLogout size={16} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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

            <nav style={{ padding: "16px 12px 0", overflowY: "auto" }} aria-label="Boards">
              <p className="lagoon-nav-label">Boards</p>
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
                      "lagoon-board-link w-full justify-start font-normal hover:bg-white/10 hover:text-white",
                      p.id === activeProjectId && "is-on"
                    )}
                    style={{ color: "rgb(255 255 255 / 0.6)" }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 9999,
                        background: "var(--lagoon-teal)",
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
                      <Button type="submit" size="sm" disabled={!newBoardName.trim() || !effectiveKey || creating}>
                        {creating ? "Creating…" : "Create"}
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
                      onClick={() => setNewBoardOpen(true)}
                      className="lagoon-new-board-btn w-[calc(100%-24px)] justify-center"
                      style={{ background: "var(--lagoon-coral)", color: "#fff" }}
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
      </LagoonChromeCtx.Provider>
    </LagoonAuthGate>
  );
}
