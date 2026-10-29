"use client";

import { useMemo, memo, startTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/store";
import { LagoonShell } from "@/components/lagoon/LagoonShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  IconClock,
  IconPlus,
  IconSearch,
  IconCheck,
  IconBoard,
  IconPulse,
  IconX,
} from "@/components/icons";
import { api, getCurrentTenantId, type Task, type Project } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSWR } from "@/lib/swr";
import { cx, isOverdue } from "@/lib/utils";
import { lagoonAvatarTone, toneForPriority } from "@/components/lagoon/lagoon-utils";
import { UserAvatar } from "@/components/user/user-avatar";
import { PhotoComponent } from "@/components/user/photo-component";
import { useUserPhoto } from "@/lib/avatar-store";
import { AnimatePresence, motion } from "@/components/motion";

const STATUS_DOT: Record<string, string> = {
  backlog: "var(--lagoon-gold, #f59e0b)",
  todo: "var(--lagoon-purple, #8b5cf6)",
  in_progress: "var(--lagoon-green, #10b981)",
  done: "var(--lagoon-success, #22c55e)",
};

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

type TaskWithProject = { task: Task; project: Project | null };

/**
 * Modern TeamFlow task card — flex layout, photo avatar support,
 * hover elevation, subtle border glow, and framer-motion micro-interactions.
 */
const TaskCard = memo(function TaskCard({ item }: { item: TaskWithProject }) {
  const { task, project } = item;
  const overdue = isOverdue(task.dueAt, task.status);
  const tone = toneForPriority(task.priority);
  const assigneeSeed = task.assigneeId ?? task.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="group relative"
    >
      <Link
        href={`/app/tasks/${task.id}`}
        className="flex flex-col justify-between p-4.5 rounded-2xl bg-[#121824]/90 border border-white/8 hover:border-purple-500/30 hover:bg-[#161e2e] shadow-lg hover:shadow-purple-500/5 transition-all text-slate-200"
        style={{ minHeight: 140 }}
      >
        <div>
          {/* Status & Priority Row */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full shrink-0 shadow-xs"
                style={{ background: STATUS_DOT[task.status] ?? "var(--lagoon-muted-fg)" }}
              />
              <span className="text-[11px] font-medium text-slate-400">
                {STATUS_LABEL[task.status] ?? task.status}
              </span>
            </div>
            {tone ? (
              <Badge variant="secondary" className={cx("text-[10px] uppercase tracking-wider px-2 py-0.5 border-0", `lg-pill-${tone}`)}>
                {task.priority}
              </Badge>
            ) : null}
          </div>

          {/* Task Title */}
          <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors line-clamp-2">
            {task.title}
          </h3>

          {/* Task Description */}
          {task.description ? (
            <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          ) : null}
        </div>

        {/* Footer info: Due date, project key, photo avatar */}
        <div className="mt-4 pt-3 border-t border-white/6 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-3">
            {task.dueAt ? (
              <span
                className={cx("flex items-center gap-1 font-mono text-[11px]", overdue && "text-red-400 font-semibold")}
              >
                <IconClock size={12} />
                {new Date(task.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {overdue ? " (Overdue)" : ""}
              </span>
            ) : null}
            {project ? (
              <span className="px-1.5 py-0.5 rounded-md bg-white/5 font-mono text-[10px] text-slate-300 border border-white/5">
                {project.key}
              </span>
            ) : null}
          </div>

          {/* Assignee Avatar */}
          <UserAvatar
            name={task.assigneeId ? "Assignee" : "Unassigned"}
            seed={assigneeSeed}
            size="xs"
            title={task.assigneeId ? "Assigned" : "Unassigned"}
          />
        </div>
      </Link>
    </motion.div>
  );
});

export default function WorkPage() {
  const { org } = useTenant();
  const router = useRouter();
  const { user } = useAuth();
  const { photoUrl, setPhotoUrl } = useUserPhoto();
  const [filter, setFilter] = useState<"all" | "assigned" | "reported">("assigned");
  const [search, setSearch] = useState("");
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  const orgId = getCurrentTenantId();
  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `work-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const projects = projectsQ.data?.projects ?? [];

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
    const all = tasksQ.data ?? [];
    const open = myTasks.filter(({ task }) => task.status !== "done");
    const completed = myTasks.filter(({ task }) => task.status === "done");
    return {
      total: all.length,
      assigned: (tasksQ.data ?? []).filter(({ task }) => task.assigneeId === user?.id).length,
      open: open.length,
      overdue: open.filter(({ task }) => isOverdue(task.dueAt, task.status)).length,
      dueToday: open.filter(({ task }) => {
        if (!task.dueAt || isOverdue(task.dueAt, task.status)) return false;
        return (task.dueAt ?? "").slice(0, 10) === new Date().toISOString().slice(0, 10);
      }).length,
      completed: completed.length,
    };
  }, [tasksQ.data, myTasks, user?.id]);

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
      <div className="w-full min-h-full p-6 md:p-10 flex flex-col items-center">
        <div className="w-full max-w-6xl flex flex-col gap-8">
          {/* Top Page Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/8"
          >
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                  Your work
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {attention.open} active
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Tasks assigned to you or created by you in{" "}
                <span className="text-slate-200 font-medium">{org?.name ?? "your organization"}</span>
              </p>
            </div>

            {/* Header Right Actions: Photo Component trigger + New task */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPhotoModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white transition-all shadow-xs"
              >
                <UserAvatar
                  name={user?.name ?? "User"}
                  src={photoUrl}
                  seed={user?.id}
                  size="xs"
                />
                <span className="hidden sm:inline">Change photo</span>
              </button>

              <Button
                onClick={() => router.push("/app/board")}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-purple-600/20 px-4 py-2 rounded-xl transition-all"
              >
                <IconPlus size={15} className="mr-1.5" /> New task
              </Button>
            </div>
          </motion.div>

          {/* Metric KPI Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {[
              {
                label: "Assigned to You",
                value: attention.assigned,
                icon: IconCheck,
                color: "text-purple-400",
                bg: "bg-purple-500/10",
                border: "border-purple-500/20",
              },
              {
                label: "Open in Scope",
                value: attention.open,
                icon: IconPulse,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
              },
              {
                label: "Due Soon / Overdue",
                value: attention.overdue + attention.dueToday,
                icon: IconClock,
                color: attention.overdue > 0 ? "text-amber-400" : "text-emerald-400",
                bg: attention.overdue > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
                border: attention.overdue > 0 ? "border-amber-500/20" : "border-emerald-500/20",
              },
              {
                label: "Total Projects",
                value: projects.length,
                icon: IconBoard,
                color: "text-indigo-400",
                bg: "bg-indigo-500/10",
                border: "border-indigo-500/20",
              },
            ].map((kpi, idx) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className={cx(
                  "p-4 rounded-2xl bg-[#111722]/80 border backdrop-blur-sm flex flex-col justify-between",
                  kpi.border,
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                  <div className={cx("p-1.5 rounded-lg", kpi.bg, kpi.color)}>
                    <kpi.icon size={14} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white tracking-tight">{kpi.value}</div>
              </motion.div>
            ))}
          </div>

          {/* Search Bar + Animated Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-white/[0.02] border border-white/6">
            {/* Search Input Group */}
            <div className="relative flex-1 max-w-md">
              <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                aria-label="Search your tasks"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search your tasks by title or description..."
                className="w-full pl-10 pr-9 py-2 text-xs rounded-xl bg-white/5 border border-white/8 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <IconX size={14} />
                </button>
              ) : null}
            </div>

            {/* Filter Tabs with Framer Motion Sliding Pill Indicator */}
            <div className="flex items-center gap-1 p-1 bg-black/30 rounded-xl border border-white/6" role="tablist">
              {(["all", "assigned", "reported"] as const).map((f) => {
                const isActive = filter === f;
                const label = f === "all" ? "All tasks" : f === "assigned" ? "Assigned" : "Reported";
                return (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleFilterChange(f)}
                    className={cx(
                      "relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors select-none",
                      isActive ? "text-white font-semibold" : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {isActive ? (
                      <motion.div
                        layoutId="activeWorkTabPill"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-primary shadow-xs"
                      />
                    ) : null}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Task Grid or Empty State */}
          <div className="w-full">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Loading tasks">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-5 rounded-2xl bg-[#121824]/60 border border-white/6 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-2.5 rounded-full" />
                      <Skeleton className="h-4 flex-1 rounded" />
                    </div>
                    <Skeleton className="h-3 w-3/4 rounded mt-1" />
                    <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              /* High-craft empty state with ambient glow & motion */
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-[#121722]/90 to-[#0e1219]/90 p-8 sm:p-12 text-center shadow-2xl flex flex-col items-center"
              >
                {/* Radial ambient glow behind */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle 320px at 50% 35%, rgba(139, 92, 246, 0.15), transparent 70%)",
                  }}
                />

                {/* Floating icon container with spring bounce */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative flex items-center justify-center size-16 rounded-2xl bg-gradient-to-tr from-purple-600/30 to-indigo-600/20 border border-purple-500/30 text-purple-300 shadow-xl shadow-purple-500/10 mb-4"
                >
                  <IconSearch size={28} />
                </motion.div>

                <h2 className="text-xl font-bold tracking-tight text-white mb-2">
                  {search ? `No tasks match "${search.trim()}"` : "You're all caught up"}
                </h2>

                <p className="max-w-md text-sm text-slate-400 mb-8 leading-relaxed">
                  {search
                    ? "Try a different search keyword or clear your filter to view all project tasks."
                    : "Tasks assigned to you or created by you in this organization will appear here. Create a task to get your workflow moving."}
                </p>

                {/* Quick Action Pills */}
                <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
                  {search ? (
                    <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={() => router.push("/app/board")}
                        className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-md px-4 py-2"
                      >
                        <IconPlus size={14} className="mr-1.5" /> Create new task
                      </Button>
                      <button
                        type="button"
                        onClick={() => setPhotoModalOpen(true)}
                        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition-all"
                      >
                        <UserAvatar name={user?.name ?? "User"} src={photoUrl} seed={user?.id} size="xs" />
                        Set profile photo
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push("/app/board")}
                        className="rounded-xl border border-white/10 text-slate-300 hover:text-white"
                      >
                        <IconBoard size={14} className="mr-1.5" /> Explore boards
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            ) : (
              /* Grid of Tasks */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredTasks.map((item) => (
                    <TaskCard key={item.task.id} item={item} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {photoModalOpen ? (
        <PhotoComponent
          name={user?.name ?? "User"}
          currentPhotoUrl={photoUrl}
          onSavePhoto={(url) => {
            setPhotoUrl(url);
            setPhotoModalOpen(false);
          }}
          trigger={() => null}
          onClose={() => setPhotoModalOpen(false)}
        />
      ) : null}
    </LagoonShell>
  );
}
