"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  MessageSquare,
  ListTodo,
  Search,
  Sparkles,
  ArrowRight,
  X,
  User,
  Tag,
  AlertCircle,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import styles from "./landing.module.css";

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "in_progress" | "in_review" | "done";
  priority: "critical" | "high" | "medium" | "low";
  tag: string;
  assignee: {
    name: string;
    initials: string;
    color: string;
  };
  dueDate: string;
  checklist?: {
    done: number;
    total: number;
  };
  commentsCount?: number;
}

const SAMPLE_TASKS: TaskItem[] = [
  {
    id: "TF-101",
    title: "Implement Postgres RLS policy verification",
    description: "Ensure Row Level Security blocks cross-tenant reads at the database engine level, even if an application filter is omitted.",
    status: "backlog",
    priority: "critical",
    tag: "Security",
    assignee: { name: "Alex Kumar", initials: "AK", color: "bg-indigo-600" },
    dueDate: "Tomorrow",
    checklist: { done: 4, total: 4 },
    commentsCount: 3,
  },
  {
    id: "TF-102",
    title: "WebSocket reconnection buffer & replay stream",
    description: "Store since-cursor events in memory buffer to guarantee zero dropped task changes on reconnect.",
    status: "backlog",
    priority: "medium",
    tag: "Backend",
    assignee: { name: "Sarah Miller", initials: "SM", color: "bg-teal-600" },
    dueDate: "Oct 24",
    checklist: { done: 1, total: 3 },
  },
  {
    id: "TF-103",
    title: "Audit log CSV & JSON export ledger",
    description: "Stream tenant audit actions into downloadable compliance archives with cryptographic checksums.",
    status: "backlog",
    priority: "low",
    tag: "Compliance",
    assignee: { name: "Liam Davis", initials: "LD", color: "bg-amber-600" },
    dueDate: "Oct 28",
  },
  {
    id: "TF-104",
    title: "Tenant workspace isolation audit",
    description: "Validate withTenant() context injection on all mutated GraphQL and REST endpoints.",
    status: "in_progress",
    priority: "critical",
    tag: "Security",
    assignee: { name: "Elena Ramos", initials: "ER", color: "bg-purple-600" },
    dueDate: "Today",
    checklist: { done: 3, total: 4 },
    commentsCount: 6,
  },
  {
    id: "TF-105",
    title: "Kanban board fluid drag transitions",
    description: "Fine-tune cubic-bezier spring curves for card displacement during fast drag operations.",
    status: "in_progress",
    priority: "high",
    tag: "Frontend",
    assignee: { name: "Jordan Patel", initials: "JP", color: "bg-rose-600" },
    dueDate: "Oct 22",
    checklist: { done: 1, total: 2 },
  },
  {
    id: "TF-106",
    title: "Cursor-based pagination on notifications",
    description: "Replace limit-offset queries with monotonic UUIDv7 cursor bounds for stable catch-up feeds.",
    status: "in_review",
    priority: "high",
    tag: "API",
    assignee: { name: "Alex Kumar", initials: "AK", color: "bg-indigo-600" },
    dueDate: "Oct 20",
    checklist: { done: 2, total: 2 },
    commentsCount: 2,
  },
  {
    id: "TF-107",
    title: "Dark theme contrast & focus ring floor",
    description: "Verify all body and placeholder text meets 4.5:1 contrast and focus rings carry 2px offset.",
    status: "in_review",
    priority: "medium",
    tag: "Design",
    assignee: { name: "Sarah Miller", initials: "SM", color: "bg-teal-600" },
    dueDate: "Oct 21",
    checklist: { done: 2, total: 2 },
  },
  {
    id: "TF-108",
    title: "Organization provisioning & invitation flow",
    description: "Multi-tenant onboarding flow with domain whitelisting and auto-role assignment.",
    status: "done",
    priority: "high",
    tag: "Auth",
    assignee: { name: "Elena Ramos", initials: "ER", color: "bg-purple-600" },
    dueDate: "Done",
    checklist: { done: 3, total: 3 },
  },
  {
    id: "TF-109",
    title: "Scoped API keys with rate-limiting ledger",
    description: "Issue granular API tokens restricted to specific project boards and tenant scopes.",
    status: "done",
    priority: "medium",
    tag: "Infra",
    assignee: { name: "Liam Davis", initials: "LD", color: "bg-amber-600" },
    dueDate: "Done",
    checklist: { done: 2, total: 2 },
  },
];

type FilterType = "all" | "high" | "security" | "done";

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: "all", label: `All tasks (${SAMPLE_TASKS.length})` },
  { id: "high", label: "Critical & High" },
  { id: "security", label: "Security & Auth" },
  { id: "done", label: "Completed" },
];

export function InteractiveBoardPreview() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openTask = (task: TaskItem) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTask(task);
  };

  useEffect(() => {
    if (!selectedTask) return;

    const dialog = dialogRef.current;
    const originalOverflow = document.body.style.overflow;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedTask(null);
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      triggerRef.current?.focus();
    };
  }, [selectedTask]);

  const filteredTasks = SAMPLE_TASKS.filter((task) => {
    if (filter === "high") {
      return task.priority === "critical" || task.priority === "high";
    }
    if (filter === "security") {
      return task.tag.toLowerCase().includes("security") || task.tag.toLowerCase().includes("auth");
    }
    if (filter === "done") {
      return task.status === "done";
    }
    return true;
  });

  const columns = [
    { key: "backlog", label: "Backlog", color: "border-slate-700/60" },
    { key: "in_progress", label: "In Progress", color: "border-purple-500/40" },
    { key: "in_review", label: "In Review", color: "border-blue-500/40" },
    { key: "done", label: "Done", color: "border-emerald-500/40" },
  ] as const;

  return (
    <div id="board-preview" className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      {/* Board Window Frame */}
      <div className="relative rounded-xl border border-white/[0.08] bg-[#0a090d] shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] transition-colors">
        {/* Top Window Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] px-4 py-3 sm:px-6">
          {/* Traffic Lights & Org Breadcrumb */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="size-3 rounded-full bg-rose-500/80" />
              <span className="size-3 rounded-full bg-amber-500/80" />
              <span className="size-3 rounded-full bg-emerald-500/80" />
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-xs font-semibold tracking-tight text-white">
              <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-xs text-purple-300">
                Acme Org
              </span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-300">Engineering Sprint 14</span>
            </div>
          </div>

          {/* Status Indicators & Search Mock */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 motion-reduce:animate-none" />
              Realtime Synced
            </div>

            <div className="hidden items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400 sm:flex">
              <Search className="size-3.5 text-zinc-500" />
              <span>Search tasks...</span>
              <kbd className="rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono text-xs text-zinc-300">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] bg-white/[0.015] px-4 py-2.5 sm:px-6">
          <div
            className="flex items-center gap-1.5 overflow-x-auto text-xs"
            role="group"
            aria-label="Filter tasks"
          >
            <span className="mr-1 shrink-0 text-xs font-medium text-zinc-500">Filters:</span>
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={filter === option.id}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c693fd] ${
                  filter === option.id
                    ? "bg-purple-600 text-white"
                    : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Click any card to inspect details</span>
          </div>
        </div>

        {/* Kanban Board Grid */}
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => {
            const tasksInCol = filteredTasks.filter((t) => t.status === col.key);

            return (
              <div
                key={col.key}
                className="flex flex-col rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"
              >
                {/* Column Header */}
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold uppercase tracking-wider text-zinc-300"
                      style={{ fontFamily: "var(--font-joy-display)" }}
                    >
                      {col.label}
                    </span>
                    <span className={`${styles.monoData} rounded-full bg-white/[0.08] px-2 py-0.5 font-medium text-zinc-300`}>
                      {tasksInCol.length}
                    </span>
                  </div>
                </div>

                {/* Cards List */}
                <div className="flex flex-1 flex-col gap-2.5">
                  {tasksInCol.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-zinc-500">
                      No tasks in this filter
                    </div>
                  ) : (
                    tasksInCol.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => openTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openTask(task);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-haspopup="dialog"
                        className="group relative cursor-pointer rounded-lg border border-white/[0.07] bg-[#0d0c11] p-3 transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[#131017] hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.7)] focus-visible:border-[#c693fd] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c693fd]"
                      >
                        {/* Top Meta: Tag & Priority */}
                        <div className="mb-2 flex items-center justify-between gap-1 text-xs">
                          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-300">
                            {task.tag}
                          </span>

                          <span
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
                              task.priority === "critical"
                                ? "bg-amber-500/15 text-amber-300"
                                : task.priority === "high"
                                  ? "bg-purple-500/15 text-purple-300"
                                  : task.priority === "medium"
                                    ? "bg-blue-500/15 text-blue-300"
                                    : "bg-slate-500/15 text-slate-300"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                task.priority === "critical"
                                  ? "bg-amber-400"
                                  : task.priority === "high"
                                    ? "bg-purple-400"
                                    : task.priority === "medium"
                                      ? "bg-blue-400"
                                      : "bg-slate-400"
                              }`}
                            />
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        </div>

                        {/* Title */}
                        <h4
                          className={`${styles.boardCardTitle} line-clamp-2 text-zinc-100 transition-colors group-hover:text-white`}
                        >
                          {task.title}
                        </h4>

                        {/* Footer Meta */}
                        <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2 text-xs text-zinc-400">
                          {/* Checklist / Comments indicator */}
                          <div className="flex items-center gap-2.5">
                            {task.checklist && (
                              <span
                                className={`${styles.monoData} flex items-center gap-1 ${
                                  task.checklist.done === task.checklist.total
                                    ? "text-emerald-400"
                                    : "text-zinc-400"
                                }`}
                              >
                                <ListTodo className="size-3" />
                                <span>
                                  {task.checklist.done}/{task.checklist.total}
                                </span>
                              </span>
                            )}

                            {task.commentsCount && (
                              <span className={`${styles.monoData} flex items-center gap-1 text-zinc-400`}>
                                <MessageSquare className="size-3" />
                                <span>{task.commentsCount}</span>
                              </span>
                            )}

                            {task.dueDate && (
                              <span className={`${styles.monoData} flex items-center gap-1 text-zinc-400`}>
                                <Clock className="size-3" />
                                <span>{task.dueDate}</span>
                              </span>
                            )}
                          </div>

                          {/* Assignee Avatar */}
                          <div
                            className={`flex size-5.5 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs ${task.assignee.color}`}
                            title={task.assignee.name}
                          >
                            {task.assignee.initials}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Dock Action Prompt */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <Sparkles className="size-4 text-[#c693fd]" />
            <span>
              This is a live preview of TeamFlow. Every task mutation is isolated by tenant ID and
              synced in milliseconds.
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => router.push("/app/board")}
            className="gap-1.5 rounded-lg bg-[oklch(0.65_0.24_300)] text-xs font-semibold text-white shadow-sm hover:brightness-110"
          >
            Open full board
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Task Details Modal Preview */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-preview-title"
            aria-describedby="task-preview-description"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, ease: "easeOut" }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedTask(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(4_8_18)]/70 p-4"
          >
            <motion.div
              initial={
                prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }
              }
              animate={
                prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
              }
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#0b090e] p-6 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)]"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div>
                  <span className="font-mono text-xs text-purple-400">{selectedTask.id}</span>
                  <h3 id="task-preview-title" className={`${styles.dialogTitle} mt-1 text-white`}>
                    {selectedTask.title}
                  </h3>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c693fd]"
                  aria-label="Close task preview"
                >
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>

              {/* Properties Grid */}
              <div className="my-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <User className="size-3.5" /> Assignee
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 font-medium text-zinc-200">
                    <span
                      className={`flex size-4.5 items-center justify-center rounded-full text-xs font-bold text-white ${selectedTask.assignee.color}`}
                    >
                      {selectedTask.assignee.initials}
                    </span>
                    {selectedTask.assignee.name}
                  </span>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <AlertCircle className="size-3.5" /> Priority
                  </span>
                  <span className="mt-1 block font-medium capitalize text-zinc-200">
                    {selectedTask.priority}
                  </span>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Tag className="size-3.5" /> Category Tag
                  </span>
                  <span className="mt-1 block font-mono font-medium text-purple-300">
                    {selectedTask.tag}
                  </span>
                </div>

                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    <Clock className="size-3.5" /> Due Date
                  </span>
                  <span className="mt-1 block font-medium text-zinc-200">
                    {selectedTask.dueDate}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <h5 className="mb-1 text-xs font-semibold text-zinc-400">Description</h5>
                <p
                  id="task-preview-description"
                  className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs leading-relaxed text-zinc-300"
                >
                  {selectedTask.description}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTask(null)}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Close preview
                </Button>
                <Button
                  size="sm"
                  onClick={() => router.push("/app/board")}
                  className="bg-[oklch(0.65_0.24_300)] text-xs font-semibold text-white hover:brightness-110"
                >
                  Open in Board
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
