"use client";

/* Command palette - heavy component, loaded dynamically (bundle-dynamic-imports) */

import { useCallback, useEffect, useMemo, useRef, useState, useDeferredValue, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "./store";
import { useToast } from "./overlay";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { IconFile, IconSearch, IconX } from "./icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cx } from "../lib/utils";

type CmdItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
};

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const { org, setOrg } = useTenant();
  const { memberships } = useAuth();
  const [query, setQuery] = useState("");
  // Use React's useDeferredValue for crisp typing while deferring expensive renders (rerender-use-deferred-value)
  const deferred = useDeferredValue(query);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Real full-text search results (Postgres FTS, tenant-scoped server-side).
  const [taskItems, setTaskItems] = useState<CmdItem[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Server-backed search once the query is long enough.
  // State updates run in subscription callbacks (never synchronously in the
  // effect body) to avoid cascading renders.
  useEffect(() => {
    const q = deferred.trim();
    let cancelled = false;
    if (q.length < 2) {
      void Promise.resolve().then(() => {
        if (!cancelled) setTaskItems([]);
      });
      return () => {
        cancelled = true;
      };
    }
    api.search
      .query(q, "all", 8)
      .then((res) => {
        if (cancelled) return;
        setTaskItems(
          res.results.map((r): CmdItem => ({
            id: `sr-${r.type}-${r.id}`,
            group: "Search results",
            label: r.title ? `${r.title}` : r.snippet.slice(0, 80),
            hint: r.type === "task" ? "task" : "comment",
            run: () => router.push(r.type === "task" ? `/app/tasks/${r.id}` : `/app/tasks/${r.taskId ?? ""}`),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setTaskItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [deferred, router]);

  const items = useMemo<CmdItem[]>(() => {
    const nav: CmdItem[] = (
      [
        ["Your work", "/app/work"],
        ["Boards", "/app/board"],
        ["Projects", "/app/projects"],
        ["Teams", "/app/teams"],
        ["Activity", "/app/activity"],
        ["Settings", "/app/settings"],
        ["Members", "/app/settings/members"],
        // ["Usage & plan", "/app/settings/usage"], // usage commented out
        ["Integrations", "/app/settings/integrations"],
        ["Audit log", "/app/settings/audit"],
      ] as const satisfies readonly [string, string][]
    ).map(([label, href]): CmdItem => {
      const l = label ?? "";
      return {
        id: `nav-${href}`,
        group: "Jump to",
        label: l,
        hint: "go",
        run: () => router.push(href),
      };
    });

    // Real org memberships — switch calls the backend (new tenant-scoped JWT).
    const orgItems: CmdItem[] = memberships.map((m): CmdItem => ({
      id: `org-${m.tenant_id}`,
      group: "Switch tenant",
      label: m.tenant_name ?? "",
      hint: `org/${m.tenant_slug}`,
      run: () => {
        void setOrg(m.tenant_id);
        toast({ title: `Switched to ${m.tenant_name ?? ""}`, msg: "Scoped to this tenant now." });
      },
    }));

    const actions: CmdItem[] = [
      {
        id: "act-task",
        group: "Actions",
        label: "Create task",
        hint: "new",
        run: () => {
          toast({ title: "Create task", msg: "Open a project board and use " + '"Create".' });
          router.push("/app/board");
        },
      },
      {
        id: "act-invite",
        group: "Actions",
        label: "Invite a teammate",
        hint: "admin",
        run: () => router.push("/app/settings/members"),
      },
    ];

    return [...nav, ...orgItems, ...actions, ...taskItems];
  }, [router, setOrg, toast, memberships, taskItems]);

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return items.filter((i) => i.group !== "Tasks").slice(0, 12);
    const out: CmdItem[] = [];
    for (const i of items) {
      if (out.length >= 12) break;
      const hay = `${i.label ?? ""} ${i.hint ?? ""}`.toLowerCase();
      if (hay.includes(q)) out.push(i);
    }
    return out;
  }, [deferred, items]);

  // keep selection inside bounds when the list shrinks (render-adjustment:
  // derived from filtered.length, no effect, no cascading render).
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
    [filtered, onClose]
  );

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
          Search tasks, jump anywhere, or switch tenant.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b border-border px-3">
          <IconSearch size={16} className="dim" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, jump anywhere, switch tenant…"
            aria-label="Command palette input"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-autocomplete="list"
            aria-activedescendant={filtered[sel] ? `cmdk-opt-${sel}` : undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <IconX size={14} />
          </Button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto p-1.5" role="listbox" id="cmdk-list" aria-label="Commands">
          {filtered.length === 0 ? (
            <div className="empty" style={{ padding: "24px 16px" }}>
              <div className="empty-title">Nothing matches "{query}"</div>
              <p className="empty-msg">
                Search covers task keys, titles, and pages in this tenant.
              </p>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {showGroup ? (
                    <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
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
                    <IconFile size={13} className="dim" />
                    <span
                      className="grow"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {item.label}
                    </span>
                    {item.hint ? <span className="cmdk-hint">{item.hint}</span> : null}
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