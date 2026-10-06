"use client";

import { useCallback, useEffect, useMemo, useRef, memo, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { LagoonShell } from "@/components/lagoon/LagoonShell";
import { useTenant } from "@/components/store";
import { Dropdown, MenuItem } from "@/components/overlay";
import { IconSearch, IconFilter, IconPulse, IconFile, IconMessageSquare, IconUsers, IconLayers, IconChevronRight, IconPlus, IconTrash, IconEdit, IconColumns, IconCheck } from "@/components/icons";
import { api, getCurrentTenantId, type ActivityEvent, type Project } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageEnter } from "@/components/motion";
import { timeAgo, hueFrom } from "@/lib/utils";

// Hoist static JSX outside component (rendering-hoist-jsx)
const ACTIVITY_TYPES = [
  { value: "all", label: "All activity", icon: IconPulse },
  { value: "task", label: "Tasks", icon: IconFile },
  { value: "comment", label: "Comments", icon: IconMessageSquare },
  { value: "project", label: "Projects", icon: IconLayers },
  { value: "team", label: "Teams", icon: IconUsers },
] as const;

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  status_changed: "changed status of",
  commented: "commented on",
  deleted: "deleted",
};

/** Action -> row icon. Single local icon set; entity type refines it. */
function iconFor(event: ActivityEvent) {
  switch (event.action) {
    case "created":
      return IconPlus;
    case "deleted":
      return IconTrash;
    case "commented":
      return IconMessageSquare;
    case "status_changed":
      return event.entityType === "task" ? IconColumns : IconCheck;
    case "updated":
      return IconEdit;
    default:
      if (event.entityType === "team") return IconUsers;
      if (event.entityType === "project") return IconLayers;
      if (event.entityType === "comment") return IconMessageSquare;
      return IconPulse;
  }
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => {
    const c = new Date(x);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * rerender-memo: Memoize TimelineRow to prevent unnecessary re-renders
 */
const TimelineRow = memo(function TimelineRow({
  event,
  actorName,
  actorLoading,
}: {
  event: ActivityEvent;
  actorName: string | null;
  actorLoading?: boolean;
}) {
  const action = ACTION_LABELS[event.action] ?? event.action;
  const tint = event.actorId ? hueFrom(event.actorId) : 0;
  const Icon = iconFor(event);
  const display = actorName ?? "Someone";
  const initials = actorName
    ? actorName
        .split(/\s+/)
        .map((w) => w.slice(0, 1))
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  return (
    <li className="relative flex items-center gap-3">
      <span className="relative shrink-0">
        {actorLoading ? (
          <Skeleton aria-hidden className="size-9 shrink-0 rounded-full" />
        ) : (
          <Avatar className="size-9 border border-border">
            <AvatarFallback style={{ background: `hsl(${tint} 60% 45%)`, color: "#fff" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
        <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
          <Icon size={10} aria-hidden />
        </span>
      </span>

      <p className="flex-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{display}</span> {action}{" "}
        <span className="font-medium text-foreground">
          {event.entityType} {event.entityId.slice(0, 8)}
        </span>
      </p>

      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {timeAgo(event.createdAt)}
      </span>
    </li>
  );
});

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

type Page = { data: ActivityEvent[]; nextCursor: string | null; hasMore: boolean };

export default function ActivityPage() {
  const { org } = useTenant();
  const router = useRouter();
  const orgId = getCurrentTenantId();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [hasMore, setHasMore] = useState(true);
  // Cursor ref so fetches always use the latest page token without
  // re-creating the callback (avoids stale closures + effect loops).
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  // Actor names for the current tenant (single fetch, shared by all rows).
  // Shared cache key with the shell (`ctx-members-*`): same endpoint, one request.
  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null }> }>(
    orgId ? `ctx-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );
  // Boards list for the purple Lagoon sidebar (same chrome as board/projects).
  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `activity-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const sidebarProjects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  const actorNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of membersQ.data?.members ?? []) {
      if (m.name) map.set(m.userId, m.name);
    }
    return map;
  }, [membersQ.data]);

  // Live feed: GET /v1/activity (tenant-scoped by the backend, cursor-paginated).
  const fetchActivities = useCallback(
    async (reset = false) => {
      if (!orgId || loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      if (reset) setLoadError(null);
      try {
        const params: { entityType?: string; cursor?: string; limit?: number } = { limit: 20 };
        if (filter !== "all") params.entityType = filter;
        const token = reset ? undefined : cursorRef.current ?? undefined;
        if (token) params.cursor = token;
        const page: Page = await api.activity.list(params);
        // normalizePage() in lib/api already coerces legacy `{ activity }`
        // envelopes to `{ data }`, but never trust the wire blindly — an
        // undefined list here used to poison state and blank the feed.
        const rows = page.data ?? [];
        setActivities((prev) => {
          if (reset) return rows;
          const seen = new Set(prev.map((a) => a.id));
          return [...prev, ...rows.filter((a) => !seen.has(a.id))];
        });
        cursorRef.current = page.nextCursor;
        setHasMore(page.hasMore);
      } catch (err) {
        if (reset) setLoadError(err instanceof Error ? err.message : "Failed to load activity.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [filter, orgId],
  );

  // Initial load + reload when the org arrives late (auth hydration) or the
  // filter changes. Switching filters resets the list and page token.
  // Resets are applied in the subscription callback below (not synchronously
  // in the effect body) so the first paint isn't a cascading render.
  useEffect(() => {
    let cancelled = false;
    const resetAndLoad = () =>
      Promise.resolve().then(() => {
        if (cancelled) return;
        cursorRef.current = null;
        setHasMore(true);
        setActivities([]);
        void fetchActivities(true);
      });
    void resetAndLoad();
    return () => {
      cancelled = true;
    };
  }, [filter, orgId, fetchActivities]);

  const handleLoadMore = () => {
    void fetchActivities(false);
  };

  // Memoize filtered activities to avoid re-filtering on every render
  const filteredActivities = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return activities;
    return activities.filter((a) => {
      const actor = a.actorId ? actorNames.get(a.actorId) ?? "" : "";
      const haystack = `${actor} ${a.action} ${a.entityType} ${a.entityId}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activities, search, actorNames]);

  // Group rows under Today / Yesterday / date separators (stable order).
  const groups = useMemo(() => {
    const out: { label: string; events: ActivityEvent[] }[] = [];
    for (const a of filteredActivities) {
      const label = dayLabel(a.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.events.push(a);
      else out.push({ label, events: [a] });
    }
    return out;
  }, [filteredActivities]);

  // Use startTransition for non-urgent search updates (rerender-transitions)
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => {
      setSearch(e.target.value);
    });
  };

  const handleFilterChange = (value: string) => {
    startTransition(() => {
      setFilter(value);
    });
  };

  const updateCount = filteredActivities.length;

  return (
    <LagoonShell
      projects={sidebarProjects}
      activeProjectId=""
      onSelectProject={(id) => router.push(`/app/board?project=${id}`)}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      <div className="lagoon-dash" style={{ overflowY: "auto" }}>
        <div className="lagoon-dash-inner">
          <div className="mx-auto w-full max-w-xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h1 className="page-title text-xl font-bold tracking-tight">Activity</h1>
              <p className="page-subtitle mt-1">
                What {org?.name ?? "your team"} has been working on lately.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {updateCount} Update{updateCount === 1 ? "" : "s"}
            </Badge>
          </div>

          <div className="activity-toolbar">
            <div className="search-box">
              <IconSearch size={16} />
              <input
                type="text"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search activity…"
              />
            </div>
            <div className="filter-dropdown">
              <Dropdown
                align="right"
                trigger={() => (
                  <Button variant="ghost" size="sm" aria-haspopup="listbox" type="button">
                    <IconFilter size={14} />
                    <span>{ACTIVITY_TYPES.find((t) => t.value === filter)?.label ?? "All"}</span>
                    <IconChevronRight size={12} />
                  </Button>
                )}
              >
                {(close) => (
                  <>
                    {ACTIVITY_TYPES.map((t) => (
                      <MenuItem
                        key={t.value}
                        checked={filter === t.value}
                        onSelect={() => {
                          handleFilterChange(t.value);
                          close();
                        }}
                      >
                        <t.icon size={14} /> {t.label}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Dropdown>
            </div>
          </div>

          {loading && activities.length === 0 ? (
            <div className="flex flex-col gap-5" role="status" aria-label="Loading activity">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3" aria-hidden>
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-2/3 rounded" />
                    <Skeleton className="h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError && activities.length === 0 ? (
            <PageEnter className="empty-state">
              <IconPulse size={48} className="dim" />
              <h3>Couldn&apos;t load activity</h3>
              <p>{loadError}</p>
              <Button size="sm" onClick={() => void fetchActivities(true)}>
                Retry
              </Button>
            </PageEnter>
          ) : filteredActivities.length === 0 ? (
            <PageEnter className="empty-state">
              <IconPulse size={48} className="dim" />
              <h3>No activity</h3>
              <p>{search ? "No matching activity found" : "Activity will appear here as your team works"}</p>
            </PageEnter>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-4">
                  <DaySeparator label={group.label} />
                  <ol className="relative flex flex-col gap-5">
                    <span className="absolute top-3 bottom-3 left-4 w-px bg-border" aria-hidden />
                    {group.events.map((event) => (
                      <TimelineRow
                        key={event.id}
                        event={event}
                        actorName={event.actorId ? actorNames.get(event.actorId) ?? null : null}
                        actorLoading={
                          membersQ.isLoading && !!event.actorId && !actorNames.get(event.actorId)
                        }
                      />
                    ))}
                  </ol>
                </div>
              ))}
              {hasMore && !loading ? (
                <button className="load-more" onClick={handleLoadMore}>
                  Load more
                </button>
              ) : null}
              {loading ? (
                <div className="flex flex-col gap-3" role="status" aria-label="Loading more activity">
                  <Skeleton className="h-14 w-full rounded-lg" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </div>
              ) : null}
            </div>
          )}
          </div>
        </div>
      </div>
    </LagoonShell>
  );
}
