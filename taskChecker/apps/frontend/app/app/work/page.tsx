"use client";

import { useMemo, memo, startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/store";
import { LagoonShell } from "@/components/lagoon/LagoonShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { IconClock, IconPlus, IconSearch } from "@/components/icons";
import { api, getCurrentTenantId, type Task, type Project } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSWR } from "@/lib/swr";
import { cx, isOverdue } from "@/lib/utils";
import { lagoonAvatarTone, lagoonInitials, toneForPriority } from "@/components/lagoon/lagoon-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AnimatePresence, listItem, motion, PageEnter } from "@/components/motion";

const STATUS_DOT: Record<string, string> = {
  backlog: "var(--lagoon-gold)",
  todo: "var(--lagoon-purple)",
  in_progress: "var(--lagoon-green)",
  done: "var(--lagoon-success)",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

type TaskWithProject = { task: Task; project: Project | null };

/**
 * TeamFlow task card for the Work page — Quiet Harbor voice: status dot +
 * label pill + text carry meaning (never a side stripe), tabular due dates.
 */
const TaskCard = memo(function TaskCard({ item }: { item: TaskWithProject }) {
  const { task, project } = item;
  const overdue = isOverdue(task.dueAt, task.status);
  const tone = toneForPriority(task.priority);
  const assigneeSeed = task.assigneeId ?? task.id;

  return (
    <motion.div
      // Position-only layout so card text never distorts on filter changes.
      // Shared listItem variant keeps one motion language; hover lift stays
      // in CSS (motion.* is reserved for mount/unmount + layout).
      layout="position"
      variants={listItem}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <Link
        href={`/app/tasks/${task.id}`}
        className="lagoon-board-card"
        style={{ display: "block", minHeight: "auto", padding: 16 }}
        title={task.priority !== "none" ? `Priority: ${task.priority}` : task.title}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: STATUS_DOT[task.status] ?? "var(--lagoon-muted-fg)", flex: "none" }} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug">{task.title}</span>
        </span>
        {task.description ? (
          <span className="lagoon-card-desc mt-1 line-clamp-2 block">{task.description}</span>
        ) : null}
        <span className="mt-3 flex min-h-6 flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{STATUS_LABEL[task.status] ?? task.status}</span>
          {tone ? (
            <Badge variant="secondary" className={cx("border-0 capitalize", `lg-pill-${tone}`)}>
              {task.priority}
            </Badge>
          ) : null}
          {task.dueAt ? (
            <span
              className={cx("lagoon-due tabular-nums", overdue && "is-overdue")}
              title={overdue ? "Overdue" : undefined}
            >
              <IconClock size={12} />
              {new Date(task.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {overdue ? " · Overdue" : null}
            </span>
          ) : null}
          {project && (
            <span className="ctx-key ml-auto">{project.key}</span>
          )}
          <Avatar size="sm" title="Assignee" className="lagoon-avatar" style={{ width: 20, height: 20, background: lagoonAvatarTone(assigneeSeed) }}>
            <AvatarFallback style={{ background: "transparent", color: "#fff", fontSize: 8 }}>
              {lagoonInitials(project?.key ?? "?")}
            </AvatarFallback>
          </Avatar>
        </span>
      </Link>
    </motion.div>
  );
});

export default function WorkPage() {
  const { org } = useTenant();
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "assigned" | "reported">("assigned");
  const [search, setSearch] = useState("");

  const orgId = getCurrentTenantId();
  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `work-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const projects = projectsQ.data?.projects ?? [];

  // All my tasks across the tenant's projects — fetched in parallel per project.
  // Key includes the project set so a newly created project revalidates
  // instead of reusing the stale closure; limit 50 halves the fan-out payload.
  const projectIdsKey = projects.map((p) => p.id).join(",");
  const tasksQ = useSWR<TaskWithProject[]>(
    orgId && projects.length > 0 ? `work-tasks-${orgId}-${projectIdsKey}` : null,
    async () => {
      const pages = await Promise.all(projects.map((p) => api.tasks.list(orgId!, p.id, { limit: 50 })));
      return pages.flatMap((page, i) => page.data.map((task) => ({ task, project: projects[i] ?? null })));
    },
  );

  const isLoading = projectsQ.isLoading || tasksQ.isLoading;

  const myTasks = useMemo(() => {
    if (!user) return [];
    return (tasksQ.data ?? []).filter(({ task }) =>
      (filter === "assigned" && task.assigneeId === user.id) ||
      (filter === "reported" && task.reporterId === user.id) ||
      (filter === "all" && (task.assigneeId === user.id || task.reporterId === user.id)),
    );
  }, [tasksQ.data, filter, user]);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myTasks;
    return myTasks.filter(({ task }) =>
      task.title.toLowerCase().includes(q) ||
      (task.description ?? "").toLowerCase().includes(q) ||
      task.id.toLowerCase().includes(q),
    );
  }, [myTasks, search]);

  const attention = useMemo(() => {
    const open = myTasks.filter(({ task }) => task.status !== "done");
    return {
      overdue: open.filter(({ task }) => isOverdue(task.dueAt, task.status)).length,
      dueToday: open.filter(({ task }) => {
        if (!task.dueAt || isOverdue(task.dueAt, task.status)) return false;
        return (task.dueAt ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10);
      }).length,
      open: open.length,
    };
  }, [myTasks]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => {
      setSearch(e.target.value);
    });
  };

  const handleFilterChange = (f: "all" | "assigned" | "reported") => {
    startTransition(() => {
      setFilter(f);
    });
  };

  return (
    <LagoonShell
      projects={projects}
      activeProjectId=""
      onSelectProject={(id) => router.push(`/app/board?project=${id}`)}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      <div className="lagoon-dash" style={{ overflowY: "auto" }}>
        <div className="lagoon-dash-inner">
      <PageEnter className="page">
        <motion.header
          className="page-header"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div>
            <h1 className="page-title">Your work</h1>
            <p className="page-subtitle">Tasks assigned to you or created by you in {org?.name ?? "your organization"}</p>
          </div>
          <div className="page-actions">
            <Button onClick={() => router.push("/app/board")}>
              <IconPlus size={14} /> New task
            </Button>
          </div>
        </motion.header>

        <div className="lagoon-filterbar" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <InputGroup variant="search" className="lagoon-search" style={{ width: 320, maxWidth: "100%" }}>
            <InputGroupAddon align="inline-start">
              <IconSearch size={14} />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search your tasks"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search your tasks…"
            />
          </InputGroup>
          <div className="filter-tabs" role="tablist" aria-label="Task scope">
            {(["all", "assigned", "reported"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={cx("filter-tab", filter === f ? "active" : "")}
                onClick={() => handleFilterChange(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {!isLoading && myTasks.length > 0 ? (
          <p className="tnum" style={{ fontSize: 12, color: "var(--lagoon-muted-fg)", marginBottom: 12 }} role="status">
            {attention.open} open
            {attention.overdue > 0 ? ` · ${attention.overdue} overdue` : ""}
            {attention.dueToday > 0 ? ` · ${attention.dueToday} due today` : ""}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ gridColumn: "1 / -1" }} role="status" aria-label="Loading tasks">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="lagoon-board-card" style={{ minHeight: "auto", padding: 16 }} aria-hidden>
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-2 rounded-full" />
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
          ) : filteredTasks.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconSearch size={16} />
                </EmptyMedia>
                <EmptyTitle>{search ? `No tasks match "${search.trim()}"` : "You're all caught up"}</EmptyTitle>
                <EmptyDescription>
                  {search
                    ? "Try a different search term, or clear the search to see everything in scope."
                    : "Tasks assigned to you or reported by you will land here. Create the first one to get moving."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex items-center gap-2">
                  {search ? (
                    <Button variant="secondary" size="sm" onClick={() => handleSearchChange({ target: { value: "" } } as React.ChangeEvent<HTMLInputElement>)}>
                      Clear search
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => router.push("/app/board")}>
                    <IconPlus size={14} /> New task
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {filteredTasks.map((item) => (
                <TaskCard key={item.task.id} item={item} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </PageEnter>
        </div>
      </div>
    </LagoonShell>
  );
}

