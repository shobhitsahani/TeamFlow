"use client";

/* TeamFlow command palette — the signature ⌘K / Ctrl+K interaction.
   shadcn Dialog foundation, TeamFlow grouping on top:
   Quick actions · Navigation · Workspace + live Projects / Tasks /
   People / Library results. Fast: deferred query, capped lists,
   skeleton rows while searching, purposeful empty states. */

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "./store";
import { useToast } from "./overlay";
import { useAuth } from "../lib/auth";
import { useTheme } from "./theme-provider";
import { api, getCurrentTenantId, type Project } from "../lib/api";
import { useSWR } from "../lib/swr";
import {
  IconBell,
  IconBoard,
  IconBuilding,
  IconCommand,
  IconFile,
  IconFolder,
  IconKey,
  IconLogout,
  IconMail,
  IconPlus,
  IconPulse,
  IconSearch,
  IconSettings,
  IconUser,
  IconUsers,
  IconX,
} from "./icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cx } from "../lib/utils";

type CmdItem = {
  id: string;
  group: string;
  label: string;
  sub?: string;
  hint?: string;
  icon: (p: { size?: number; className?: string }) => React.ReactNode;
  run: () => void;
};

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { org, setOrg } = useTenant();
  const { memberships, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState("");
  // Crisp typing while deferring expensive renders.
  const deferred = useDeferredValue(query);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Live server results (Postgres FTS, tenant-scoped server-side).
  const [taskItems, setTaskItems] = useState<CmdItem[]>([]);
  const [searching, setSearching] = useState(false);

  const orgId = getCurrentTenantId();

  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `palette-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null; email?: string | null }> }>(
    orgId ? `palette-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );
  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  const members = useMemo(() => membersQ.data?.members ?? [], [membersQ.data]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Server-backed search once the query is long enough.
  useEffect(() => {
    const q = deferred.trim();
    let cancelled = false;
    if (q.length < 2) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setTaskItems([]);
          setSearching(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    // Searching flag is raised in the input change handler (event callback),
    // cleared in the subscription callbacks below — never set synchronously
    // in this effect body.
    api.search
      .query(q, "all", 8)
      .then((res) => {
        if (cancelled) return;
        setTaskItems(
          res.results.map((r): CmdItem => ({
            id: `sr-${r.type}-${r.id}`,
            group: "Tasks",
            label: r.title ? `${r.title}` : r.snippet.slice(0, 80),
            sub: r.type === "task" ? "Task" : "Comment",
            hint: r.type,
            icon: IconFile,
            run: () => router.push(r.type === "task" ? `/app/tasks/${r.id}` : `/app/tasks/${r.taskId ?? ""}`),
          })),
        );
        setSearching(false);
      })
      .catch(() => {
        if (!cancelled) {
          setTaskItems([]);
          setSearching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deferred, router]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const items = useMemo<CmdItem[]>(() => {
    const quick: CmdItem[] = [
      {
        id: "act-task",
        group: "Quick actions",
        label: "Create task",
        sub: "New card on the board",
        hint: "new",
        icon: IconPlus,
        run: () => {
          toast({ title: "Create task", msg: 'Open a board and use "Create".' });
          router.push("/app/board");
        },
      },
      {
        id: "act-project",
        group: "Quick actions",
        label: "Create project",
        sub: "New workspace project",
        hint: "new",
        icon: IconFolder,
        run: () => router.push("/app/projects"),
      },
      {
        id: "act-board",
        group: "Quick actions",
        label: "Create board",
        sub: "New kanban board",
        hint: "new",
        icon: IconBoard,
        run: () => router.push("/app/board"),
      },
      {
        id: "act-invite",
        group: "Quick actions",
        label: "Invite a teammate",
        sub: "Members settings",
        hint: "admin",
        icon: IconMail,
        run: () => router.push("/app/settings/members"),
      },
    ];

    const nav: CmdItem[] = (
      [
        ["Your work", "Tasks assigned to you", "/app/work", IconUser],
        ["Boards", "Kanban boards", "/app/board", IconBoard],
        ["Projects", "Workspace projects", "/app/projects", IconFolder],
        ["Library", "Docs, resources and references", "/app/library", IconFile],
        ["Teams", "Teams and members", "/app/teams", IconUsers],
        ["Activity", "Workspace activity", "/app/activity", IconPulse],
        ["Search", "Full-text search", "/app/search", IconSearch],
        ["Settings", "Workspace settings", "/app/settings", IconSettings],
      ] as const
    ).map(([label, sub, href, icon]): CmdItem => ({
      id: `nav-${href}`,
      group: "Navigation",
      label,
      sub,
      hint: "go",
      icon: icon as CmdItem["icon"],
      run: () => router.push(href),
    }));

    const projectHits: CmdItem[] = projects.slice(0, 20).map((p) => ({
      id: `proj-${p.id}`,
      group: "Projects",
      label: p.name,
      sub: p.key,
      hint: "project",
      icon: IconFolder,
      run: () => router.push(`/app/board?project=${p.id}`),
    }));

    const peopleHits: CmdItem[] = members.slice(0, 30).map((m) => ({
      id: `person-${m.userId}`,
      group: "People",
      label: m.name ?? m.email ?? m.userId.slice(0, 8),
      sub: m.email ?? undefined,
      hint: "person",
      icon: IconUser,
      run: () => router.push("/app/settings/members"),
    }));

    const libraryHits: CmdItem[] = projects.slice(0, 10).map((p) => ({
      id: `lib-${p.id}`,
      group: "Library",
      label: `${p.name} resources`,
      sub: `${p.key} · project collection`,
      hint: "library",
      icon: IconFile,
      run: () => router.push(`/app/library?q=${encodeURIComponent(p.name)}`),
    }));

    const workspace: CmdItem[] = [
      ...memberships.map((m): CmdItem => ({
        id: `org-${m.tenant_id}`,
        group: "Workspace",
        label: m.tenant_name ?? "Workspace",
        sub: `Switch to ${m.tenant_slug} · ${m.role}`,
        hint: "switch",
        icon: IconBuilding,
        run: () => {
          void setOrg(m.tenant_id);
          toast({ title: `Switched to ${m.tenant_name ?? ""}`, msg: "Scoped to this tenant now." });
        },
      })),
      {
        id: "ws-org-manage",
        group: "Workspace",
        label: "Manage organizations",
        sub: "Switch, create, or join a workspace",
        hint: "orgs",
        icon: IconBuilding,
        run: () => router.push("/app/settings#organizations"),
      },
      {
        id: "ws-org-create",
        group: "Workspace",
        label: "Create new organization",
        sub: "New workspace, switch to it immediately",
        hint: "new",
        icon: IconPlus,
        run: () => router.push("/app/settings#organizations"),
      },
      {
        id: "ws-org-join",
        group: "Workspace",
        label: "Join via invite",
        sub: "Paste an invite link or code",
        hint: "join",
        icon: IconKey,
        run: () => router.push("/app/settings#organizations"),
      },
      {
        id: "ws-theme",
        group: "Workspace",
        label: `Change theme — now ${theme === "dark" ? "dark" : "light"}`,
        sub: "Toggle light / dark",
        hint: "theme",
        icon: IconSettings,
        run: () => {
          toggle();
          toast({ title: "Theme changed", msg: `Now ${theme === "dark" ? "light" : "dark"} mode.` });
        },
      },
      {
        id: "ws-shortcuts",
        group: "Workspace",
        label: "View keyboard shortcuts",
        sub: "⌘K search · M move card · Enter open",
        hint: "keys",
        icon: IconCommand,
        run: () => {
          toast({
            title: "Keyboard shortcuts",
            msg: "⌘K / Ctrl K search · M move card · Enter open · Esc close.",
          });
        },
      },
      {
        id: "ws-notifs",
        group: "Workspace",
        label: "Open notifications",
        hint: "inbox",
        icon: IconBell,
        run: () => router.push("/app/activity"),
      },
      {
        id: "ws-signout",
        group: "Workspace",
        label: "Sign out",
        hint: "bye",
        icon: IconLogout,
        run: () => {
          void logout().then(() => router.replace("/auth/sign-in"));
        },
      },
    ];

    return [...quick, ...nav, ...projectHits, ...peopleHits, ...libraryHits, ...workspace, ...taskItems];
  }, [router, setOrg, toast, memberships, projects, members, taskItems, theme, toggle, logout]);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group === "Quick actions" || i.group === "Navigation").slice(0, 12);
    const out: CmdItem[] = [];
    for (const i of items) {
      if (out.length >= 14) break;
      const hay = `${i.label ?? ""} ${i.sub ?? ""} ${i.hint ?? ""}`.toLowerCase();
      if (hay.includes(q)) out.push(i);
    }
    return out;
  }, [deferred, items]);

  // Keep selection inside bounds when the list shrinks.
  const [prevFilteredLen, setPrevFilteredLen] = useState(filtered.length);
  if (filtered.length !== prevFilteredLen) {
    setPrevFilteredLen(filtered.length);
    setSel((s) => Math.min(s, Math.max(0, filtered.length - 1)));
  }

  const runAt = useCallback(
    (idx: number) => {
      const item = filtered[idx];
      if (!item) return;
      onClose();
      item.run();
    },
    [filtered, onClose],
  );

  const clearQuery = useCallback(() => {
    setQuery("");
    setSel(0);
    inputRef.current?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      startTransition(() => setSel((s) => (s + 1) % Math.max(1, filtered.length)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      startTransition(() => setSel((s) => (s - 1 + filtered.length) % Math.max(1, filtered.length)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(sel);
    }
  };
  let lastGroup = "";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        aria-label="Command palette"
        showCloseButton={false}
        className="top-[10vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search projects, tasks, people and library. Create tasks and projects, navigate, or switch workspace.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <IconSearch size={16} className="dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              // Event callback (not an effect body): safe to flag pending search.
              if (v.trim().length >= 2) setSearching(true);
              else setSearching(false);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, tasks, people, library…"
            aria-label="Command palette input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-autocomplete="list"
            aria-activedescendant={filtered[sel] ? `cmdk-opt-${sel}` : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searching ? (
            <span className="text-xs text-muted-foreground" role="status" aria-label="Searching">
              Searching…
            </span>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </Button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-1.5" role="listbox" id="cmdk-list" aria-label="Commands">
          {searching && filtered.length === 0 ? (
            <div className="flex flex-col gap-1 p-1" role="status" aria-label="Loading results">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 rounded-md px-2.5 py-2" aria-hidden>
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-3.5 flex-1 rounded" />
                  <Skeleton className="h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty" style={{ padding: "24px 16px", textAlign: "center" }}>
              <div className="empty-title">Nothing matches &ldquo;{query}&rdquo;</div>
              <p className="empty-msg" style={{ margin: "8px auto 16px", maxWidth: "36ch" }}>
                Search covers projects, task titles, people and library resources in this workspace.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={clearQuery}>
                  Clear search
                </Button>
                <Button variant="default" size="sm" onClick={() => go("/app/board")}>
                  <IconPlus size={14} /> Create task
                </Button>
              </div>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <div className="px-2.5 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
                      {item.group}
                    </div>
                  ) : null}
                  <div
                    role="option"
                    id={`cmdk-opt-${idx}`}
                    aria-selected={idx === sel}
                    className={cx(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm",
                      idx === sel && "bg-accent text-accent-foreground",
                    )}
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => runAt(idx)}
                  >
                    <Icon size={14} className="dim shrink-0" />
                    <span
                      className="grow min-w-0"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {item.label}
                      {item.sub ? (
                        <span className="dim ml-2 text-xs" style={{ fontWeight: 400 }}>
                          {item.sub}
                        </span>
                      ) : null}
                    </span>
                    {item.hint ? <span className="cmdk-hint shrink-0">{item.hint}</span> : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span>Scoped to {org?.name ?? "your organization"}</span>
          <span className="kbd-group">
            <span>↑↓ move</span>
            <span>⏎ open</span>
            <span>esc close</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
