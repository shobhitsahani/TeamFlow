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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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

/** Action -> row icon. Single local icon set; entity type refines it.
 * Returns ready-to-render JSX (not a component) so TimelineRow never
 * creates a component during render. */
function iconFor(event: ActivityEvent) {
  switch (event.action) {
    case "created":
      return <IconPlus size={10} aria-hidden />;
    case "deleted":
      return <IconTrash size={10} aria-hidden />;
    case "commented":
      return <IconMessageSquare size={10} aria-hidden />;
    case "status_changed":
      return event.entityType === "task"
        ? <IconColumns size={10} aria-hidden />
        : <IconCheck size={10} aria-hidden />;
    case "updated":
      return <IconEdit size={10} aria-hidden />;
    default:
      if (event.entityType === "team") return <IconUsers size={10} aria-hidden />;
      if (event.entityType === "project") return <IconLayers size={10} aria-hidden />;
      if (event.entityType === "comment") return <IconMessageSquare size={10} aria-hidden />;
      return <IconPulse size={10} aria-hidden />;
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
  const actionIcon = iconFor(event);
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
    <li
      className="lagoon-tl-row"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 12,
        border: "1px solid var(--lagoon-border)",
        background: "var(--lagoon-card)",
      }}
    >
      <span className="relative shrink-0" style={{ position: "relative", flex: "none" }}>
        {actorLoading ? (
          <Skeleton aria-hidden className="size-9 shrink-0 rounded-full" />
        ) : (
          <Avatar className="size-9" style={{ border: "1px solid var(--lagoon-border)" }}>
            <AvatarFallback style={{ background: `hsl(${tint} 60% 45%)`, color: "#fff" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
        <span
          className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full"
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 9999,
            border: "1px solid var(--lagoon-border)",
            background: "var(--lagoon-muted)",
            color: "var(--lagoon-muted-fg)",
          }}
        >
          {actionIcon}
        </span>
      </span>

      <p className="flex-1 text-sm" style={{ flex: 1, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>
        <span style={{ fontWeight: 600, color: "var(--lagoon-ink)" }}>{display}</span> {action}{" "}
        <span style={{ fontWeight: 600, color: "var(--lagoon-ink)" }}>
          {event.entityType} {event.entityId.slice(0, 8)}
        </span>
      </p>

      <span className="shrink-0 text-xs tabular-nums" style={{ flex: "none", fontSize: 11, color: "var(--lagoon-muted-fg)" }}>
        {timeAgo(event.createdAt)}
      </span>
    </li>
  );
});

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span aria-hidden style={{ height: 1, flex: 1, background: "var(--lagoon-border)" }} />
      <span
        className="shrink-0 tabular-nums"
        style={{
          flex: "none",
          borderRadius: 9999,
          border: "1px solid var(--lagoon-border)",
          background: "var(--lagoon-card)",
          padding: "2px 10px",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--lagoon-muted-fg)",
        }}
      >
        {label}
      </span>
      <span aria-hidden style={{ height: 1, flex: 1, background: "var(--lagoon-border)" }} />
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              borderBottom: "1px solid var(--lagoon-border)",
              paddingBottom: 32,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--lagoon-gold)" }}>
                  <IconPulse size={14} /> {org?.name ?? "Workspace"}
                </div>
                <h1 className="lagoon-display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  Activity
                </h1>
                <p style={{ marginTop: 8, maxWidth: 560, fontSize: 14, color: "var(--lagoon-muted-fg)" }}>
                  What {org?.name ?? "your team"} has been working on lately.
                </p>
              </div>
              <Badge
                variant="secondary"
                className="shrink-0 tabular-nums"
                style={{ border: "1px solid var(--lagoon-border)", background: "var(--lagoon-card)", color: "var(--lagoon-muted-fg)" }}
              >
                {updateCount} Update{updateCount === 1 ? "" : "s"}
              </Badge>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <InputGroup variant="search" className="lagoon-search" style={{ width: 280 }}>
                <InputGroupAddon align="inline-start">
                  <IconSearch size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  aria-label="Search activity"
                  value={search}
                  onChange={handleSearchChange}
                  placeholder="Search activity…"
                />
              </InputGroup>
              <div style={{ marginLeft: "auto" }}>
                <Dropdown
                  align="right"
                  trigger={() => (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-haspopup="listbox"
                      type="button"
                      className="lagoon-toggle-btn"
                      style={{ borderColor: "var(--lagoon-border)" }}
                    >
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
          </div>

          <div style={{ paddingTop: 32 }}>
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
            <PageEnter className="lagoon-empty" style={{ marginTop: 0 }}>
              <h3 className="lagoon-display" style={{ fontSize: 16, fontWeight: 600 }}>Couldn&apos;t load activity</h3>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>{loadError}</p>
              <Button size="sm" className="lagoon-create-btn border-0" style={{ marginTop: 16 }} onClick={() => void fetchActivities(true)}>
                Retry
              </Button>
            </PageEnter>
          ) : filteredActivities.length === 0 ? (
            <PageEnter className="lagoon-empty" style={{ marginTop: 0 }}>
              <IconPulse size={32} style={{ color: "var(--lagoon-muted-fg)" }} />
              <h3 className="lagoon-display" style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>No activity</h3>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>{search ? "No matching activity found" : "Activity will appear here as your team works"}</p>
            </PageEnter>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((group) => (
                <div key={group.label} className="flex flex-col gap-4">
                  <DaySeparator label={group.label} />
                  <ol className="relative flex flex-col gap-3" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                <Button variant="outline" size="sm" onClick={handleLoadMore} style={{ alignSelf: "center", borderColor: "var(--lagoon-border)" }}>
                  Load more
                </Button>
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
      </div>
    </LagoonShell>
  );
}
