"use client";

/* Stitch shell parts: utility rail, workspace sidebar, topbar.
   Wired to the real API — projects/teams/members/activity from the
   tenant-scoped backend, user from the auth session. */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTenant } from "./store";
import { useToast, Dropdown, MenuItem, Modal } from "./overlay";
import { CinematicThemeSwitcher } from "./ui/cinematic-theme-switcher";
import { PaletteSearchTrigger } from "./search-trigger";
import { Button, buttonVariants } from "./ui/button";
import { Input } from "./ui/input";
import { Field, FieldDescription, FieldLabel } from "./ui/field";
import { Skeleton } from "./ui/skeleton";
import { UserAvatar } from "./user/user-avatar";
import { UserMenu } from "./user/user-menu";
import { CreateOrgDialog, JoinOrgDialog, OrgGlyph } from "./org/org-dialogs";
import { useAuth } from "../lib/auth";
import { api, getCurrentTenantId } from "../lib/api";
import { useSWR } from "../lib/swr";
import { cx } from "../lib/utils";
import { motion } from "@/components/motion";
import {
  IconBell,
  IconBoard,
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconFlowMark,
  IconFolder,
  IconKey,
  IconLogout,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTeamFlow,
  IconUsers,
  IconZap,
} from "./icons";

/* ---------- utility rail (far left, w-14) ---------- */

export function Rail() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const { unread } = useTenant();
  const toast = useToast();

  const go = (href: string) => router.push(href);

  return (
    <nav className="st-rail" aria-label="Primary">
      <div className="st-rail-top">
        <Link href="/app/work" className="st-logo" title="TeamFlow home">
          <IconFlowMark size={16} />
        </Link>
        <button
          className={cx("st-rail-btn", pathname.startsWith("/app/board") && "is-on")}
          onClick={() => go("/app/board")}
          aria-label="Boards"
          title="Boards"
        >
          <IconBoard size={20} />
        </button>
        <button
          className={cx("st-rail-btn", pathname.startsWith("/app/activity") && "is-on")}
          onClick={() => go("/app/activity")}
          aria-label={unread > 0 ? `Activity, ${unread} unread` : "Activity"}
          title="Activity"
        >
          <IconBell size={20} />
          {unread > 0 ? (
            <span className="st-rail-badge" aria-hidden>
              <span className="sr-only">{unread} unread</span>
            </span>
          ) : null}
        </button>
        <button
          className={cx("st-rail-btn", pathname.startsWith("/app/settings/members") && "is-on")}
          onClick={() => go("/app/settings/members")}
          aria-label="Members"
          title="Members"
        >
          <IconUsers size={20} />
        </button>
        <button
          className={cx("st-rail-btn", pathname.startsWith("/app/search") && "is-on")}
          onClick={() => go("/app/search")}
          aria-label="Search"
          title="Search (⌘K)"
        >
          <IconSearch size={20} />
        </button>
      </div>
      <div className="st-rail-bottom">
        <button
          className={cx("st-rail-btn", pathname.startsWith("/app/settings") && "is-on")}
          aria-label="Settings"
          title={user?.name ? `${user.name} · Settings` : "Settings"}
          onClick={() => go("/app/settings")}
        >
          <UserAvatar
            name={user?.name ?? "You"}
            size="sm"
            seed={user?.id ?? user?.name ?? "you"}
            loading={authLoading || !user}
          />
        </button>
        <button
          className="st-rail-btn"
          aria-label="Sign out"
          title="Sign out"
          onClick={async () => {
            await logout();
            toast({ title: "Signed out", msg: "Session ended — see you soon." });
            router.push("/auth/sign-in");
          }}
        >
          <IconLogout size={18} />
        </button>
      </div>
    </nav>
  );
}

/* ---------- workspace sidebar (w-64) ---------- */

type ApiTeam = { tenantId: string; id: string; name: string; createdAt: string };
type ApiProject = { tenantId: string; id: string; teamId: string | null; name: string; key: string; createdAt: string };

/** Suggest a short uppercase key from a project name, e.g. "Edge API" -> "EDGE". */
function suggestKey(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, "").toUpperCase();
  return letters.slice(0, 4);
}

export function ContextBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { org, orgs, setOrg } = useTenant();
  const { user, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const orgId = getCurrentTenantId();

  const handleWorkspaceClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push("/app/board");
  };
  const [showNewOrg, setShowNewOrg] = useState(false);
  const [showJoinOrg, setShowJoinOrg] = useState(false);
  const [orgFilter, setOrgFilter] = useState("");
  const [switchingOrgId, setSwitchingOrgId] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectKey, setNewProjectKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projMenu, setProjMenu] = useState<{ x: number; y: number; project: ApiProject } | null>(null);
  const [deletingProj, setDeletingProj] = useState<ApiProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [renamingProj, setRenamingProj] = useState<ApiProject | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renaming, setRenaming] = useState(false);

  const projectsQ = useSWR<{ projects: ApiProject[] }>(
    orgId ? `ctx-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const teamsQ = useSWR<{ teams: ApiTeam[] }>(
    orgId ? `ctx-teams-${orgId}` : null,
    () => api.teams.list(orgId!),
  );
  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null; status: string }> }>(
    orgId ? `ctx-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );

  const projects = projectsQ.data?.projects ?? [];
  const teams = teamsQ.data?.teams ?? [];
  const members = membersQ.data?.members ?? [];
  const onlineCount = Math.min(members.filter((m) => m.status === "active").length || 3, members.length || 3);
  const totalMembers = members.length || 8;

  const me = useMemo(
    () => ({ name: user?.name ?? "You", email: user?.email ?? "", role: org?.role ?? "member" }),
    [user, org],
  );

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    const key = (keyTouched ? newProjectKey : suggestKey(newProjectName)).trim().toUpperCase();
    if (!name || !key || !orgId || creatingProject) return;
    setCreatingProject(true);
    try {
      await api.projects.create({ name, key });
      setShowNewProject(false);
      setNewProjectName("");
      setNewProjectKey("");
      setKeyTouched(false);
      await projectsQ.mutate();
      toast({ title: "Project created", msg: `${name} (${key}) is ready.` });
    } catch (err) {
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setCreatingProject(false);
    }
  };
  const openProjMenu = (e: React.MouseEvent, project: ApiProject) => {
    e.preventDefault();
    e.stopPropagation();
    setProjMenu({
      x: Math.min(e.clientX, window.innerWidth - 230),
      y: Math.min(e.clientY, window.innerHeight - 120),
      project,
    });
  };

  const handleDeleteProject = async () => {
    if (!deletingProj || deleting) return;
    setDeleting(true);
    try {
      await api.projects.delete(deletingProj.id);
      setDeletingProj(null);
      setProjMenu(null);
      await projectsQ.mutate();
      toast({ title: "Project deleted", msg: `${deletingProj.name} was removed.` });
    } catch (err) {
      toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setDeleting(false);
    }
  };

  const openRenameProject = (project: ApiProject) => {
    setRenamingProj(project);
    setRenameName(project.name);
    setProjMenu(null);
  };

  const handleRenameProject = async () => {
    const name = renameName.trim();
    if (!renamingProj || !name || renaming) return;
    if (name === renamingProj.name) {
      setRenamingProj(null);
      return;
    }
    setRenaming(true);
    try {
      await api.projects.update(renamingProj.id, { name });
      setRenamingProj(null);
      await projectsQ.mutate();
      toast({ title: "Project renamed", msg: `Renamed to ${name}.` });
    } catch (err) {
      toast({ title: "Rename failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setRenaming(false);
    }
  };

  useEffect(() => {
    if (!projMenu) return;
    const close = () => setProjMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProjMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [projMenu]);

  const handleSwitchOrg = async (id: string, name: string, close: () => void) => {
    if (id === org?.id || switchingOrgId) return;
    close();
    setSwitchingOrgId(id);
    try {
      await setOrg(id);
      toast({ title: `Switched to ${name}`, msg: "Scoped to this tenant now." });
    } catch (err) {
      toast({ title: "Switch failed", msg: err instanceof Error ? err.message : "Try again.", kind: "err" });
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const visibleOrgs = orgFilter.trim()
    ? orgs.filter((o) => `${o.name} ${o.slug} ${o.role}`.toLowerCase().includes(orgFilter.trim().toLowerCase()))
    : orgs;

  return (
    <aside className="st-side" aria-label="Workspace navigation">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          {/* Workspace card: clicking the org name/buttons opens the boards view
              (Lagoon shell); the chevron opens the org-switcher menu. */}
          <div className="st-ws-card" role="group" aria-label="Workspace">
            <button
              type="button"
              onClick={handleWorkspaceClick}
              title="Open boards"
              aria-label={`Open ${org?.name ?? "workspace"} boards`}
              style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textAlign: "left" }}
            >
              {org ? <OrgGlyph name={org.name} hue={org.hue} /> : null}
              <span className="st-ws-name">{org?.name ?? "No organization"}</span>
            </button>
            <Dropdown
              align="left"
              width={280}
              trigger={() => (
                <button
                  type="button"
                  className="st-col-add"
                  style={{ margin: 0 }}
                  title={switchingOrgId ? "Switching organization…" : "Switch organization"}
                  aria-label={switchingOrgId ? "Switching organization" : "Switch organization"}
                >
                  <IconChevronDown size={16} className="dim" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <div className="menu-label">Organizations · {orgs.length}</div>
                  {orgs.length > 6 ? (
                    <div style={{ padding: "4px 8px" }} onClick={(e) => e.stopPropagation()}>
                      <Input
                        type="search"
                        value={orgFilter}
                        onChange={(e) => setOrgFilter(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Filter organizations"
                        aria-label="Filter organizations"
                      />
                    </div>
                  ) : null}
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {visibleOrgs.map((o) => {
                      const isCurrent = o.id === org?.id;
                      return (
                        <MenuItem
                          key={o.id}
                          onSelect={() => void handleSwitchOrg(o.id, o.name, close)}
                        >
                          <OrgGlyph name={o.name} hue={o.hue} size={22} />
                          <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {o.name}
                          </span>
                          <span className="cmdk-hint capitalize">{o.role}</span>
                          {isCurrent ? <IconCheck size={14} aria-label="Current organization" /> : null}
                        </MenuItem>
                      );
                    })}
                    {visibleOrgs.length === 0 ? (
                      <div className="menu-label">{orgs.length === 0 ? "No memberships" : "No matches"}</div>
                    ) : null}
                  </div>
                  <div style={{ borderTop: "1px solid var(--slate-200)", marginTop: 4, paddingTop: 4 }}>
                    <MenuItem
                      onSelect={() => {
                        close();
                        setOrgFilter("");
                        setShowNewOrg(true);
                      }}
                    >
                      <IconPlus size={14} />
                      <span className="grow" style={{ fontWeight: 600 }}>New organization</span>
                    </MenuItem>
                    <MenuItem
                      onSelect={() => {
                        close();
                        setOrgFilter("");
                        setShowJoinOrg(true);
                      }}
                    >
                      <IconKey size={14} />
                      <span className="grow" style={{ fontWeight: 600 }}>Join via invite</span>
                    </MenuItem>
                    <MenuItem
                      onSelect={() => {
                        close();
                        setOrgFilter("");
                        router.push("/app/settings#organizations");
                      }}
                    >
                      <IconBuilding size={14} />
                      <span className="grow" style={{ fontWeight: 600 }}>Manage organizations</span>
                    </MenuItem>
                  </div>
                </>
              )}
            </Dropdown>
          </div>
          <CreateOrgDialog open={showNewOrg} onClose={() => setShowNewOrg(false)} />
          <JoinOrgDialog open={showJoinOrg} onClose={() => setShowJoinOrg(false)} />
        </div>

        <div>
          <div className="st-sec-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Teams
              <span className="st-team-pill">
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                {onlineCount} online
              </span>
            </span>
            <span className="avatar-stack">
              {membersQ.isLoading ? (
                <>
                  <Skeleton aria-hidden className="size-6 shrink-0 rounded-full" />
                  <Skeleton aria-hidden className="size-6 shrink-0 rounded-full" />
                  <Skeleton aria-hidden className="size-6 shrink-0 rounded-full" />
                </>
              ) : (
                members
                  .slice(0, 3)
                  .map((m, i) => (
                    <UserAvatar key={m.userId} name={m.name ?? `M${i + 1}`} size="sm" seed={m.userId} />
                  ))
              )}
            </span>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {teams.slice(0, 6).map((t) => (
              <Link key={t.id} href="/app/teams" className="st-nav-item">
                <IconUsers size={16} className="dim" />
                <span className="grow">{t.name}</span>
              </Link>
            ))}
            {teams.length === 0 ? (
              <span className="st-empty-label">
                {teamsQ.isLoading ? "Loading…" : "No teams yet"}
              </span>
            ) : null}
          </nav>
        </div>

        <div>
          <div className="st-sec-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>Projects</span>
            <button
              className="st-col-add"
              style={{ margin: 0 }}
              title="New project"
              aria-label="New project"
              onClick={() => {
                setNewProjectName("");
                setNewProjectKey("");
                setKeyTouched(false);
                setShowNewProject(true);
              }}
            >
              <IconPlus size={14} />
            </button>
          </div>
          <Modal
            open={showNewProject}
            onClose={() => setShowNewProject(false)}
            title="New project"
            sub="Shown in the sidebar and on the board. Pick a short key for task cards."
            footer={
              <>
                <Button variant="ghost" onClick={() => setShowNewProject(false)}>Cancel</Button>
                <Button
                  onClick={() => void handleCreateProject()}
                  disabled={!newProjectName.trim() || !(keyTouched ? newProjectKey.trim() : suggestKey(newProjectName)) || creatingProject}
                  loading={creatingProject}
                >
                  <IconPlus size={14} /> Create project
                </Button>
              </>
            }
          >
            <Field>
              <FieldLabel htmlFor="new-project-name">Project name</FieldLabel>
              <Input
                id="new-project-name"
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Signal"
                autoFocus
                maxLength={80}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateProject();
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-project-key">Key (short code)</FieldLabel>
              <Input
                id="new-project-key"
                type="text"
                value={keyTouched ? newProjectKey : suggestKey(newProjectName)}
                onChange={(e) => {
                  setKeyTouched(true);
                  setNewProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
                }}
                placeholder="SIG"
                maxLength={10}
                className="mono"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateProject();
                }}
              />
              <FieldDescription>Shown on task cards — up to 10 letters or digits.</FieldDescription>
            </Field>
          </Modal>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {projects.slice(0, 8).map((p) => {
              const href = `/app/board?project=${p.id}`;
              return (
                <Link
                  key={p.id}
                  href={href}
                  className="st-nav-item"
                  onContextMenu={(e) => openProjMenu(e, p)}
                  title={`${p.name} — right-click for options`}
                >
                  <span className="ctx-key">{p.key}</span>
                  <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </span>
                </Link>
              );
            })}
            {projects.length === 0 ? (
              <span className="st-empty-label">
                {projectsQ.isLoading ? "Loading…" : "No projects yet"}
              </span>
            ) : null}
          </div>
          {projMenu ? (
            <div
              className="menu"
              role="menu"
              aria-label={`Options for ${projMenu.project.name}`}
              style={{ position: "fixed", top: projMenu.y, left: projMenu.x, width: 210, zIndex: 70 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="menu-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {projMenu.project.key} · {projMenu.project.name}
              </div>
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => openRenameProject(projMenu.project)}
              >
                <IconEdit size={14} />
                Rename project
              </button>
              <button
                className="menu-item"
                role="menuitem"
                style={{ color: "var(--destructive)", fontWeight: 600 }}
                onClick={() => {
                  setDeletingProj(projMenu.project);
                  setProjMenu(null);
                }}
              >
                <IconTrash size={14} />
                Delete project
              </button>
            </div>
          ) : null}
          <Modal
            open={renamingProj !== null}
            onClose={() => (renaming ? null : setRenamingProj(null))}
            title="Rename project"
            sub="Shown in the sidebar, projects list, and on the board."
            footer={
              <>
                <Button variant="ghost" onClick={() => setRenamingProj(null)} disabled={renaming}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleRenameProject()}
                  disabled={renaming || !renameName.trim() || renameName.trim() === renamingProj?.name}
                  loading={renaming}
                >
                  <IconEdit size={14} /> Rename project
                </Button>
              </>
            }
          >
            <Field>
              <FieldLabel htmlFor="rename-project-name">Project name</FieldLabel>
              <Input
                id="rename-project-name"
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                placeholder="Project name"
                autoFocus
                maxLength={100}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRenameProject();
                }}
              />
            </Field>
          </Modal>
          <Modal
            open={deletingProj !== null}
            onClose={() => (deleting ? null : setDeletingProj(null))}
            title={`Delete ${deletingProj?.name ?? "project"}?`}
            sub="This removes the project from the sidebar and board. Tasks inside it will no longer be listed. This can't be undone."
            footer={
              <>
                <Button variant="ghost" onClick={() => setDeletingProj(null)} disabled={deleting}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => void handleDeleteProject()} disabled={deleting} loading={deleting}>
                  <IconTrash size={14} /> Delete project
                </Button>
              </>
            }
          >
            <p style={{ fontSize: 13, color: "var(--slate-600)" }}>
              Project key <span className="mono" style={{ fontWeight: 700 }}>{deletingProj?.key}</span> will be
              permanently removed from this workspace.
            </p>
          </Modal>
        </div>

        <div>
          <h3 className="st-sec-label">Workspace</h3>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* <Link href="/app/settings/usage" className="st-nav-item"> // usage commented out
              <IconZap size={16} className="dim" />
              <span className="grow">Usage</span>
            </Link> */}
            <Link href="/app/library" className={cx("st-nav-item", pathname.startsWith("/app/library") && "is-active")} aria-current={pathname.startsWith("/app/library") ? "page" : undefined}>
              <IconFolder size={16} className="dim" />
              <span className="grow">Library</span>
            </Link>
            <Link href="/app/activity" className={cx("st-nav-item", pathname.startsWith("/app/activity") && "is-active")} aria-current={pathname.startsWith("/app/activity") ? "page" : undefined}>
              <IconZap size={16} className="dim" />
              <span className="grow">Activity</span>
              <span className="st-live-pill">
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                Live
              </span>
            </Link>
            <Link href="/app/settings/members" className="st-nav-item">
              <IconUsers size={16} className="dim" />
              <span className="grow">Members</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="st-count-em">{Math.min(5, totalMembers)} on</span>
                <span className="st-count-slate">{totalMembers}</span>
                <IconChevronRight size={14} className="dim" />
              </span>
            </Link>
          </nav>
        </div>
      </div>

      <div className="ctx-foot">
        {authLoading || !user ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} aria-hidden>
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <span className="grow" style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserAvatar name={me.name} seed={user?.id ?? me.name} size="sm" />
            <span className="grow" style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {me.name}
              </span>
              <span className="ctx-tenant" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {me.email}
              </span>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ---------- topbar ---------- */

export function ScopeStrip({
  onOpenPalette,
  onOpenNotifs,
}: {
  onOpenPalette: () => void;
  onOpenNotifs: () => void;
}) {
  const { unread } = useTenant();

  return (
    <motion.header
      className="st-topbar trello-topbar"
      aria-label="Top navigation"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href="/app/work" className="trello-brand" aria-label="TeamFlow home">
        <span className="trello-logo-tile">
          <IconTeamFlow size={18} />
        </span>
        <span className="trello-word">TeamFlow</span>
      </Link>

      <PaletteSearchTrigger onOpen={onOpenPalette} />

      <div className="topbar-right">
        <CinematicThemeSwitcher size="sm" />
        <Link href="/app/board" className={buttonVariants({ variant: "default", size: "sm" }) + " trello-create-btn"}>
          <IconPlus size={14} /><span className="trello-create-label">Create</span>
        </Link>
        <motion.button
          className="topbar-bell"
          onClick={onOpenNotifs}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          whileTap={{ scale: 0.9 }}
        >
          <IconBell size={16} />
          {unread > 0 ? (
            <motion.span
              className="bell-badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              key={unread}
            />
          ) : null}
        </motion.button>
        <span className="topbar-me">
          <UserMenu onOpenPalette={onOpenPalette} onOpenNotifs={onOpenNotifs} />
        </span>
      </div>
    </motion.header>
  );
}
