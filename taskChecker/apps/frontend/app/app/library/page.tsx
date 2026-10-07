/* TeamFlow Library — first-class workspace resources on the real
   tenant-scoped APIs (projects, tasks, members, full-text search).
   No new backend: collections derive client-side from projects, tasks
   with descriptions read as documents, people from the member directory.
   Favorites + recent persist per browser; search stays tenant-scoped. */

"use client";

import { Suspense, memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LagoonShell } from "@/components/lagoon/LagoonShell";
import { useTenant } from "@/components/store";
import { useToast } from "@/components/overlay";
import { api, getCurrentTenantId, type Member, type Project, type Task } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { cx } from "@/lib/utils";
import { lagoonAvatarTone, lagoonDueBadge, lagoonInitials, todayYmd, toYmd } from "@/components/lagoon/lagoon-utils";
import { PageEnter } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconFolder,
  IconPlus,
  IconSearch,
  IconStar,
  IconUsers,
} from "@/components/icons";

type LibraryKind = "project" | "task" | "person";

type LibraryItem = {
  kind: LibraryKind;
  id: string;
  title: string;
  sub: string;
  href: string;
  key?: string;
  status?: Task["status"];
  dueAt?: string | null;
  updatedAt?: string;
  team?: string | null;
  personEmail?: string;
  personId?: string;
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_DOT: Record<string, string> = {
  backlog: "var(--lagoon-gold)",
  todo: "var(--lagoon-purple)",
  in_progress: "var(--lagoon-green)",
  done: "var(--lagoon-success)",
};

const FAV_KEY = "tf.library.favs.v1";
const RECENT_KEY = "tf.library.recent.v1";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // private mode — session-only
  }
}

const LibraryCard = memo(function LibraryCard({
  item,
  fav,
  onToggleFav,
  onOpen,
}: {
  item: LibraryItem;
  fav: boolean;
  onToggleFav: (item: LibraryItem) => void;
  onOpen: (item: LibraryItem) => void;
}) {
  const dueYmd = toYmd(item.dueAt ?? null);
  return (
    <div
      data-slot="lagoon-card"
      role="listitem"
      tabIndex={0}
      aria-label={`Open ${item.title}`}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="lagoon-board-card cursor-pointer"
      style={{ minHeight: "auto", padding: 16 }}
    >
      <div className="flex items-start gap-2">
        {item.kind === "project" ? (
          <span className="ctx-key shrink-0">{item.key}</span>
        ) : item.kind === "person" ? (
          <Avatar
            size="sm"
            title={item.title}
            className="lagoon-avatar shrink-0"
            style={{ width: 28, height: 28, background: lagoonAvatarTone(item.personId ?? item.id) }}
          >
            <AvatarFallback style={{ background: "transparent", color: "#fff", fontSize: 9 }}>
              {lagoonInitials(item.title)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span
            aria-hidden
            className="shrink-0"
            style={{ width: 8, height: 8, borderRadius: 9999, background: STATUS_DOT[item.status ?? ""] ?? "var(--lagoon-muted-fg)", marginTop: 5 }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="lagoon-card-title">{item.title}</h3>
          <p className="lagoon-card-desc">{item.sub}</p>
        </div>
        <button
          type="button"
          className={cx("lagoon-star", fav && "is-on")}
          aria-label={fav ? `Remove ${item.title} from favorites` : `Save ${item.title} to favorites`}
          aria-pressed={fav}
          title={fav ? "Remove from favorites" : "Save to favorites"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav(item);
          }}
        >
          <IconStar size={16} />
        </button>
      </div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
        <Badge variant="secondary" className={cx("border-0 capitalize", item.kind === "project" && "lg-pill-purple", item.kind === "task" && "lg-pill-green", item.kind === "person" && "lg-pill-gold")}>
          {item.kind === "project" ? "Collection" : item.kind === "task" ? (STATUS_LABEL[item.status ?? ""] ?? item.status ?? "Task") : "Person"}
        </Badge>
        {dueYmd ? (
          <span className="lagoon-due tabular-nums">{lagoonDueBadge(dueYmd, todayYmd()).text}</span>
        ) : null}
        {item.team ? <span className="text-[11px] text-muted-foreground">{item.team}</span> : null}
        {item.updatedAt ? (
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
            {new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        ) : null}
      </div>
    </div>
  );
});

function LibraryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { org } = useTenant();
  const toast = useToast();
  const orgId = getCurrentTenantId();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const deferredSearch = useDeferredValue(search);
  const [tab, setTab] = useState<"all" | LibraryKind>("all");
  const [sort, setSort] = useState<"recent" | "name" | "due">("recent");
  const [starredOnly, setStarredOnly] = useState(false);
  const [favs, setFavs] = useState<LibraryItem[]>(() => readJson<LibraryItem[]>(FAV_KEY, []));
  const [recent, setRecent] = useState<LibraryItem[]>(() => readJson<LibraryItem[]>(RECENT_KEY, []));
  const [serverHits, setServerHits] = useState<LibraryItem[]>([]);

  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `lib-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const teamsQ = useSWR<{ teams: Array<{ id: string; name: string }> }>(
    orgId ? `lib-teams-${orgId}` : null,
    () => api.teams.list(orgId!),
  );
  const membersQ = useSWR<{ members: Member[] }>(
    orgId ? `lib-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );

  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  const members = useMemo(() => membersQ.data?.members ?? [], [membersQ.data]);
  const teamName = useMemo(() => {
    const map = new Map((teamsQ.data?.teams ?? []).map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [teamsQ.data]);

  const projectIdsKey = projects.map((p) => p.id).join(",");
  const tasksQ = useSWR<LibraryItem[]>(
    orgId && projects.length > 0 ? `lib-tasks-${orgId}-${projectIdsKey}` : null,
    async () => {
      const pages = await Promise.all(projects.map((p) => api.tasks.list(orgId!, p.id, { limit: 50 })));
      return pages.flatMap((page, i) =>
        page.data.map((t) => ({
          kind: "task" as const,
          id: t.id,
          title: t.title?.trim() ? t.title : "Untitled card",
          sub: `${projects[i]?.key ?? "Task"} · ${projects[i]?.name ?? ""}`,
          href: `/app/tasks/${t.id}`,
          status: t.status,
          dueAt: t.dueAt,
          updatedAt: t.updatedAt,
          team: teamName(projects[i]?.teamId ?? null),
        })),
      );
    },
  );

  // Server full-text search augments local filtering once the query is long.
  useEffect(() => {
    const q = deferredSearch.trim();
    let cancelled = false;
    if (q.length < 2 || !orgId) {
      void Promise.resolve().then(() => {
        if (!cancelled) setServerHits([]);
      });
      return () => {
        cancelled = true;
      };
    }
    api.search
      .query(q, "all", 12)
      .then((res) => {
        if (cancelled) return;
        setServerHits(
          res.results
            .filter((r) => r.type === "task")
            .map((r) => ({
              kind: "task" as const,
              id: r.id,
              title: r.title?.trim() ? (r.title as string) : r.snippet.slice(0, 80),
              sub: r.snippet.slice(0, 120),
              href: `/app/tasks/${r.id}`,
              status: (r.status as Task["status"]) ?? "todo",
              updatedAt: undefined,
            })),
        );
      })
      .catch(() => {
        if (!cancelled) setServerHits([]);
      });
    return () => {
      cancelled = true;
    };
  }, [deferredSearch, orgId]);

  const allItems = useMemo<LibraryItem[]>(() => {
    const projectItems: LibraryItem[] = projects.map((p) => ({
      kind: "project",
      id: p.id,
      title: p.name,
      sub: `${p.key} · ${teamName(p.teamId) ?? "Workspace collection"}`,
      href: `/app/board?project=${p.id}`,
      key: p.key,
      updatedAt: p.createdAt,
      team: teamName(p.teamId),
    }));
    const personItems: LibraryItem[] = members.map((m) => ({
      kind: "person",
      id: m.userId,
      title: m.name ?? m.email ?? m.userId.slice(0, 8),
      sub: m.email ?? "Workspace member",
      href: "/app/settings/members",
      personEmail: m.email ?? undefined,
      personId: m.userId,
    }));
    const taskItems = tasksQ.data ?? [];
    const seen = new Set(taskItems.map((t) => t.id));
    const merged = [...taskItems];
    for (const h of serverHits) {
      if (!seen.has(h.id)) {
        seen.add(h.id);
        merged.push(h);
      }
    }
    return [...projectItems, ...merged, ...personItems];
  }, [projects, members, tasksQ.data, serverHits, teamName]);

  const favIds = useMemo(() => new Set(favs.map((f) => `${f.kind}:${f.id}`)), [favs]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    let out = allItems;
    if (tab !== "all") out = out.filter((i) => i.kind === tab);
    if (starredOnly) out = out.filter((i) => favIds.has(`${i.kind}:${i.id}`));
    if (q) {
      out = out.filter((i) => `${i.title} ${i.sub} ${i.key ?? ""}`.toLowerCase().includes(q));
    }
    const sorted = [...out];
    if (sort === "name") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "due") {
      sorted.sort((a, b) => {
        const da = toYmd(a.dueAt ?? null);
        const db = toYmd(b.dueAt ?? null);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? -1 : 1;
      });
    } else {
      sorted.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
    }
    return sorted;
  }, [allItems, tab, starredOnly, deferredSearch, sort, favIds]);

  const toggleFav = useCallback(
    (item: LibraryItem) => {
      setFavs((prev) => {
        const key = `${item.kind}:${item.id}`;
        const has = prev.some((f) => `${f.kind}:${f.id}` === key);
        const next = has ? prev.filter((f) => `${f.kind}:${f.id}` !== key) : [...prev, item].slice(-50);
        writeJson(FAV_KEY, next);
        return next;
      });
    },
    [],
  );

  const openItem = useCallback(
    (item: LibraryItem) => {
      setRecent((prev) => {
        const next = [item, ...prev.filter((r) => `${r.kind}:${r.id}` !== `${item.kind}:${item.id}`)].slice(0, 8);
        writeJson(RECENT_KEY, next);
        return next;
      });
      router.push(item.href);
    },
    [router],
  );

  const isLoading = projectsQ.isLoading || tasksQ.isLoading || membersQ.isLoading;

  return (
    <div className="lagoon-dash" style={{ overflowY: "auto" }}>
      <div className="lagoon-dash-inner">
        <PageEnter>
          <header className="page-header">
            <div>
              <h1 className="page-title">Library</h1>
              <p className="page-subtitle">
                Projects, tasks and people across {org?.name ?? "your workspace"} — starred items stay on this device.
              </p>
            </div>
            <div className="page-actions">
              <Button onClick={() => router.push("/app/board")}>
                <IconPlus size={14} /> New task
              </Button>
            </div>
          </header>

          <div className="lagoon-filterbar" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <InputGroup variant="search" className="lagoon-search" style={{ width: 320, maxWidth: "100%" }}>
              <InputGroupAddon align="inline-start">
                <IconSearch size={14} />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Search library"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collections, tasks, people…"
              />
            </InputGroup>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | LibraryKind)}>
              <TabsList aria-label="Resource type">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="project">Collections</TabsTrigger>
                <TabsTrigger value="task">Tasks</TabsTrigger>
                <TabsTrigger value="person">People</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={sort} onValueChange={(v) => setSort(v as "recent" | "name" | "due")}>
              <SelectTrigger aria-label="Sort library" style={{ width: 150 }}>
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent first</SelectItem>
                <SelectItem value="name">Name A–Z</SelectItem>
                <SelectItem value="due">Due date</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              className={cx("lagoon-toggle-btn", starredOnly && "is-on")}
              aria-pressed={starredOnly}
              onClick={() => setStarredOnly((v) => !v)}
            >
              <IconStar size={14} /> Starred
            </button>
          </div>

          {!deferredSearch.trim() && !starredOnly && tab === "all" && recent.length > 0 ? (
            <section aria-label="Recent" style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {recent.slice(0, 3).map((item) => (
                  <LibraryCard key={`recent-${item.kind}-${item.id}`} item={item} fav={favIds.has(`${item.kind}:${item.id}`)} onToggleFav={toggleFav} onOpen={openItem} />
                ))}
              </div>
            </section>
          ) : null}

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading library">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="lagoon-board-card" style={{ minHeight: "auto", padding: 16 }} aria-hidden>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 rounded-full" />
                    <Skeleton className="h-4 flex-1 rounded" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-3/4 rounded" />
                  <div className="mt-3 flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {starredOnly ? <IconStar size={16} /> : tab === "person" ? <IconUsers size={16} /> : <IconFolder size={16} />}
                </EmptyMedia>
                <EmptyTitle>
                  {starredOnly ? "No starred items yet" : deferredSearch.trim() ? `No resources match "${deferredSearch.trim()}"` : tab === "person" ? "No people found" : "Library is empty"}
                </EmptyTitle>
                <EmptyDescription>
                  {starredOnly
                    ? "Star collections, tasks and people to pin them here. Stars stay on this device."
                    : deferredSearch.trim()
                      ? "Try a different term, or browse collections and tasks below."
                      : "Create a project or task and it appears here automatically."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex items-center gap-2">
                  {deferredSearch.trim() || starredOnly ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setStarredOnly(false);
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onClick={() => {
                      toast({ title: "Create", msg: "Open a board to add your first task." });
                      router.push("/app/board");
                    }}
                  >
                    <IconPlus size={14} /> New task
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          ) : (
            <>
              <p className="tnum" style={{ fontSize: 12, color: "var(--lagoon-muted-fg)", marginBottom: 12 }} role="status">
                {filtered.length} resource{filtered.length === 1 ? "" : "s"}
                {deferredSearch.trim() ? (
                  <>
                    {" "}for &ldquo;{deferredSearch.trim()}&rdquo;
                  </>
                ) : null}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {filtered.slice(0, 60).map((item) => (
                  <LibraryCard key={`${item.kind}-${item.id}`} item={item} fav={favIds.has(`${item.kind}:${item.id}`)} onToggleFav={toggleFav} onOpen={openItem} />
                ))}
              </div>
            </>
          )}

          <p style={{ marginTop: 20, fontSize: 12, color: "var(--lagoon-muted-fg)" }}>
            Also in <Link href="/app/search" style={{ textDecoration: "underline" }}>full-text search</Link> and
            {" "}<Link href="/app/projects" style={{ textDecoration: "underline" }}>projects</Link>.
            {favs.length > 0 ? ` · ${favs.length} starred on this device.` : ""}
          </p>
        </PageEnter>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const orgId = getCurrentTenantId();
  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `lib-shell-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  return (
    <LagoonShell
      projects={projects}
      activeProjectId=""
      onSelectProject={(id) => router.push(`/app/board?project=${id}`)}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      <Suspense fallback={null}>
        <LibraryContent />
      </Suspense>
    </LagoonShell>
  );
}
