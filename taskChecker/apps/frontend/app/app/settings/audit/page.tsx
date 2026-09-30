"use client";

import { useCallback, useEffect, useMemo, useState, memo } from "react";
import { AppShell } from "@/components/app-shell";
import { IconFileText, IconSearch, IconUser } from "@/components/icons";
import { api, getCurrentTenantId, type AuditLog } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import { reportError } from "@/lib/report";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageEnter } from "@/components/motion";

const AuditRow = memo(function AuditRow({ log }: { log: AuditLog }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{timeAgo(log.createdAt)}</TableCell>
      <TableCell className="font-medium">{log.action}</TableCell>
      <TableCell>
        <span className="entity-type">{log.entityType}</span>
        {log.entityId && <span className="entity-id font-mono text-xs text-muted-foreground"> {log.entityId.slice(0, 8)}</span>}
      </TableCell>
      <TableCell>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} className="text-muted-foreground">
          <IconUser size={12} />
          <span className="font-mono text-xs">{log.actorId.slice(0, 8)}</span>
        </span>
      </TableCell>
      <TableCell>
        {log.before && (
          <details className="audit-diff">
            <summary>Changes</summary>
            <pre>{JSON.stringify({ before: log.before, after: log.after }, null, 2)}</pre>
          </details>
        )}
      </TableCell>
    </TableRow>
  );
});

export default function AuditPage() {
  const orgId = getCurrentTenantId();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState("");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async (reset = false) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params: { limit?: number; cursor?: string } = { limit: 50 };
      if (!reset && cursor) params.cursor = cursor;
      const page = await api.audit.list(params.limit, params.cursor);
      // Backend may return an unexpected shape on error — never let logs
      // become undefined (that crashes the render below on `.length`).
      const rows = Array.isArray(page?.data) ? page.data : [];
      setLogs((prev) => (reset ? rows : [...(prev ?? []), ...rows]));
      setCursor(page?.nextCursor ?? null);
      setHasMore(page?.hasMore ?? false);
    } catch (err) {
      reportError(err, "audit:fetch");
    } finally {
      setLoading(false);
    }
  }, [orgId, cursor]);

  // Initial load (effect, not render — render-time fetch double-fires under
  // StrictMode and can setState during another component's render).
  // The fetch itself runs in a subscription callback so the effect body never
  // calls setState synchronously.
  useEffect(() => {
    if ((logs?.length ?? 0) === 0 && !loading && orgId) {
      let cancelled = false;
      void Promise.resolve().then(() => {
        if (!cancelled) void fetchLogs(true);
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (filterAction) {
      result = result.filter((l) => l.action === filterAction);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        (l.entityId?.toLowerCase().includes(q) ?? false) ||
        l.actorId.toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, filterAction, search]);

  const actions = useMemo(
    () => [...new Set(logs.map((l) => l.action))].sort(),
    [logs]
  );

  return (
    <AppShell>
      <div className="page settings-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Audit log</h1>
            <p className="page-subtitle">Security and admin activity trail</p>
          </div>
        </header>

        <div className="settings-content">
          <div className="audit-toolbar">
            <div className="search-box">
              <IconSearch size={16} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search audit log…"
              />
            </div>
            <Select
              value={filterAction || "all"}
              onValueChange={(v) => setFilterAction(!v || v === "all" ? "" : v)}
            >
              <SelectTrigger aria-label="Filter by action" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="audit-table">
            {loading && (logs?.length ?? 0) === 0 ? (
              <div className="flex flex-col gap-2" role="status" aria-label="Loading audit log" style={{ padding: "12px 0" }}>
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <PageEnter className="empty-state inline">
                <IconFileText size={32} className="dim" />
                <p>{search || filterAction ? "No matching entries" : "No audit entries yet"}</p>
              </PageEnter>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <AuditRow key={log.id} log={log} />
                    ))}
                  </TableBody>
                </Table>
                {hasMore && !loading ? (
                  <button className="load-more" onClick={() => void fetchLogs(false)}>
                    Load more
                  </button>
                ) : null}
                {loading && (
                  <div className="flex flex-col gap-2" role="status" aria-label="Loading more entries" style={{ padding: "12px 0" }}>
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}