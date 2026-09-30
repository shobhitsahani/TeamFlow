"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  IconArrowLeft,
  IconClock,
  IconMessageSquare,
  IconMoreHorizontal,
  IconTrash,
  IconX,
} from "@/components/icons";
import { api, getCurrentTenantId, type Comment, type Task } from "@/lib/api";
import { ConfirmDialog, useToast } from "@/components/overlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useSWR } from "@/lib/swr";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { cx, timeAgo, hueFrom, isOverdue, initials } from "@/lib/utils";
import { AnimatePresence, motion, PageEnter } from "@/components/motion";

const STATUSES = ["backlog", "todo", "in_progress", "done"] as const;
const PRIORITIES = ["critical", "high", "medium", "low", "none"] as const;
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
const STATUS_COLORS: Record<string, string> = {
  backlog: "var(--muted)",
  todo: "hsl(210 80% 50%)",
  in_progress: "hsl(35 90% 50%)",
  done: "hsl(140 60% 45%)",
};

function SidebarCard({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cx("sidebar-card", className)}>{children}</div>;
}

function CommentItem({
  comment,
  authorName,
  nameLoading,
  onDelete,
  canDelete,
  isOwn,
}: {
  comment: Comment;
  authorName: string | null;
  nameLoading?: boolean;
  onDelete: () => void;
  canDelete: boolean;
  isOwn: boolean;
}) {
  const tint = hueFrom(comment.authorId);
  return (
    <motion.div
      className="comment-item"
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className="comment-avatar">
        {nameLoading ? (
          <Skeleton aria-hidden className="size-6 shrink-0 rounded-full" />
        ) : (
          <Avatar size="sm">
            <AvatarFallback
              style={{
                background: `hsl(${tint} 45% 20%)`,
                color: `hsl(${tint} 80% 78%)`,
              }}
            >
              {initials(authorName ?? "?")}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className="comment-content">
        <div className="comment-header">
          {nameLoading ? (
            <Skeleton aria-hidden className="h-3 w-24 rounded" />
          ) : (
            <span className="comment-author">
              {authorName ?? "Unknown"}
              {isOwn ? <span className="faint"> · you</span> : null}
            </span>
          )}
          <span className="comment-time">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="comment-body" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {comment.body}
        </p>
        {canDelete ? (
          <div className="comment-actions">
            <Button variant="ghost" size="xs" onClick={onDelete}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export default function TaskDetailPage() {
  const { user, memberships } = useAuth();
  const params = useParams<{ id: string }>();
  const taskId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const toast = useToast();
  const orgId = getCurrentTenantId();
  const [commentBody, setCommentBody] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  // Deadline preset state only (days input); the deadline itself always
  // persists instantly via patch() — single editing model, no staged modal.
  const [customDays, setCustomDays] = useState("");
  const [titleKey, setTitleKey] = useState(0);
  const [descKey, setDescKey] = useState(0);
  // Start of today, captured once — lets the preset chip derive purely
  // from task.dueAt without impure Date.now() calls during render.
  const [todayMs] = useState(() => {
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    return n.getTime();
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const taskQ = useSWR<{ task: Task }>(taskId ? `task-${taskId}` : null, () => api.tasks.get(taskId));
  const commentsQ = useSWR<{ data: Comment[]; nextCursor: string | null; hasMore: boolean }>(
    taskId ? `comments-${taskId}` : null,
    () => api.comments.list(taskId, { limit: 50 }),
  );
  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null }> }>(
    orgId ? `task-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );
  const projectQ = useSWR<{ projects: Array<{ id: string; name: string; key: string; teamId: string | null }> }>(
    taskId && orgId ? `task-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );

  const task = taskQ.data?.task ?? null;
  const comments = commentsQ.data?.data ?? [];
  const nameById = useMemo(
    () => new Map((membersQ.data?.members ?? []).map((m) => [m.userId, m.name ?? null])),
    [membersQ.data],
  );
  const project = useMemo(
    () => (task ? projectQ.data?.projects.find((p) => p.id === task.projectId) : null) ?? null,
    [task, projectQ.data],
  );
  const myRole = memberships.find((m) => m.tenant_id === orgId)?.role;
  const canWrite = myRole === "owner" || myRole === "admin" || myRole === "member";
  const assignee = task?.assigneeId
    ? { id: task.assigneeId, name: nameById.get(task.assigneeId) ?? "Unknown" }
    : null;
  const reporter = task?.reporterId
    ? { id: task.reporterId, name: nameById.get(task.reporterId) ?? "Unknown" }
    : null;

  const patch = async (data: Partial<Task>, okMsg: string) => {
    if (!taskId || !task) return;
    // Optimistic: controlled selects (status/priority) render from server
    // state, so without this they snap back to the old value while the PATCH
    // is in flight. Roll back to server state on failure.
    await taskQ.mutate({ task: { ...task, ...data } }, { revalidate: false });
    try {
      await api.tasks.update(taskId, data);
      await taskQ.mutate();
      toast({ title: okMsg, msg: "Saved." });
    } catch (err) {
      await taskQ.mutate();
      toast({ title: "Update failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleStatusChange = (status: string) =>
    void patch({ status: status as Task["status"] }, "Status updated");
  const handlePriorityChange = (priority: string) =>
    void patch({ priority: priority as Task["priority"] }, "Priority updated");

  const handleDelete = async () => {
    if (!taskId) return;
    setDeleting(true);
    try {
      await api.tasks.delete(taskId);
      toast({ title: "Task deleted", msg: "Task moved to trash" });
      router.push("/app/work");
    } catch (err) {
      toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again." });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  /** Set the deadline N days from now (same time of day), persisted instantly. */
  const applyDueInDays = (days: number) => {
    if (!taskId) return;
    const d = new Date(new Date().getTime() + days * 86_400_000);
    void patch({ dueAt: d.toISOString() }, "Deadline updated");
  };

  /** Clear the deadline. */
  const clearDue = () => {
    if (!taskId) return;
    setCustomDays("");
    void patch({ dueAt: null }, "Deadline cleared");
  };

  /** Set the deadline to an absolute calendar date, keeping the current
   * time of day (or now when none is set yet). Persisted instantly. */
  const applyDueDate = (date: Date | undefined) => {
    if (!taskId) return;
    if (!date) {
      void patch({ dueAt: null }, "Deadline cleared");
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const base = task?.dueAt ? new Date(task.dueAt) : new Date();
    const next = new Date(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}:00`,
    );
    void patch({ dueAt: next.toISOString() }, "Deadline updated");
  };

  /** Preset chip reflecting the current deadline (derived, never staged). */
  const duePreset: "none" | "1" | "3" | "7" | "custom" = (() => {
    if (!task?.dueAt) return "none";
    const days = Math.round((new Date(task.dueAt).getTime() - todayMs) / 86_400_000);
    return days === 1 || days === 3 || days === 7 ? String(days) as "1" | "3" | "7" : "custom";
  })();

  /** Commit the custom-days field (blur/Enter — not per keystroke). */
  const commitCustomDays = () => {
    const n = Math.floor(Number(customDays));
    if (!taskId || !Number.isFinite(n) || n < 1 || n > 365) return;
    applyDueInDays(n);
  };

  const handleComment = async () => {
    const body = commentBody.trim();
    if (!body || !taskId || postingComment) return;
    setPostingComment(true);
    try {
      const res = await api.comments.create(taskId, body);
      setCommentBody("");
      // Optimistic: show the new comment instantly, then reconcile with server.
      await commentsQ.mutate(
        (current) => ({
          data: [res.comment, ...(current?.data ?? [])],
          nextCursor: current?.nextCursor ?? null,
          hasMore: current?.hasMore ?? false,
        }),
      );
      toast({ title: "Comment added", msg: "Posted." });
    } catch (err) {
      toast({ title: "Comment failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    // Optimistic: remove instantly, roll back to server state on failure.
    await commentsQ.mutate(
      (current) => ({
        data: (current?.data ?? []).filter((c) => c.id !== commentId),
        nextCursor: current?.nextCursor ?? null,
        hasMore: current?.hasMore ?? false,
      }),
      { revalidate: false },
    );
    try {
      await api.comments.delete(commentId);
      await commentsQ.mutate();
    } catch (err) {
      await commentsQ.mutate();
      toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  const canDeleteComment = (c: Comment) => c.authorId === user?.id;

  if (taskQ.isLoading) {
    return (
      <AppShell>
        <div className="page">
          <div className="flex max-w-3xl flex-col gap-3" role="status" aria-label="Loading task">
            <Skeleton className="h-8 w-2/3 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell>
        <div className="page">
          <PageEnter className="empty-state">
            <h3>Task not found</h3>
            <p>It may be deleted, or belong to another organization.</p>
          </PageEnter>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageEnter className="page task-detail-page">
        <motion.header
          className="task-header-bar"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Link href="/app/work" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back">
            <IconArrowLeft size={18} />
          </Link>
          <div className="task-header-main">
            {canWrite ? (
              <Input
                key={`${task.id}-${titleKey}`}
                defaultValue={task.title}
                aria-label="Task title"
                maxLength={200}
                className="trello-detail-title border-0 bg-transparent px-0 shadow-none focus-visible:ring-1"
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== task.title) void patch({ title: v }, "Title updated");
                  else setTitleKey((k) => k + 1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  else if (e.key === "Escape") setTitleKey((k) => k + 1);
                }}
              />
            ) : (
              <h1 className="trello-detail-title">{task.title}</h1>
            )}
            <p className="trello-detail-sub">
              in list <strong>{STATUS_LABELS[task.status]}</strong>
              {project ? (
                <>
                  {" "}on <Link href={`/app/board?project=${project.id}`}>{project.name}</Link>
                </>
              ) : null}{" "}
              <span className="mono">· {project?.key ?? "ID"}-{task.id.slice(0, 4).toUpperCase()}</span>
            </p>
            <div className="task-detail-meta">
              <span className="task-status-badge" style={{ background: STATUS_COLORS[task.status] }}>
                {STATUS_LABELS[task.status]}
              </span>
              {isOverdue(task.dueAt, task.status) ? (
                <span
                  className="task-status-badge"
                  style={{ background: "hsl(0 75% 45%)" }}
                  title={`Deadline passed ${new Date(task.dueAt as string).toLocaleString()} — moves back to Backlog automatically`}
                >
                  OVERDUE
                </span>
              ) : null}
            </div>
          </div>
          <div className="task-header-actions">
            {canWrite ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" aria-label="Task options" />
                  }
                >
                  <IconMoreHorizontal size={18} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    closeOnClick
                    variant="destructive"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <IconTrash size={16} /> Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </motion.header>

        <div className="task-detail-grid">
          <motion.main
            className="task-main"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <section className="task-section">
              <h3 className="trello-section-head">Description</h3>
              <div className="task-description">
                {canWrite ? (
                  <Textarea
                    key={`${task.id}-desc-${descKey}`}
                    defaultValue={task.description ?? ""}
                    rows={3}
                    placeholder="No description yet. Write one here…"
                    onBlur={(e) => {
                      if (e.target.value !== (task.description ?? "")) {
                        void patch({ description: e.target.value }, "Description updated");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setDescKey((k) => k + 1);
                    }}
                  />
                ) : task.description ? (
                  <p>{task.description}</p>
                ) : (
                  <p className="faint">No description.</p>
                )}
              </div>
            </section>

            <section className="task-section">
              <h3 className="trello-section-head">Activity {comments.length > 0 ? <span className="faint">({comments.length})</span> : null}</h3>
              <div className="comments-list">
                {commentsQ.isLoading ? (
                  <div role="status" aria-label="Loading comments" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[0, 1].map((i) => (
                      <div key={i} className="comment-item" aria-hidden>
                        <div className="comment-avatar">
                          <Skeleton className="size-6 shrink-0 rounded-full" />
                        </div>
                        <div className="comment-content" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Skeleton className="h-3 w-28 rounded" />
                          <Skeleton className="h-3 w-full rounded" />
                          <Skeleton className="h-3 w-2/3 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : comments.length === 0 ? (
                  <p className="empty-text">No comments yet. Be the first to comment!</p>
                ) : (
                  <AnimatePresence initial={false} mode="popLayout">
                    {comments.map((c) => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        authorName={nameById.get(c.authorId) ?? null}
                        nameLoading={membersQ.isLoading && !nameById.get(c.authorId)}
                        canDelete={canDeleteComment(c)}
                        isOwn={c.authorId === user?.id}
                        onDelete={() => void handleDeleteComment(c.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
                {canWrite ? (
                  <form
                    className="comment-form trello-comment-box"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleComment();
                    }}
                  >
                    <Textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void handleComment();
                      }}
                      placeholder="Write a comment… (⌘/Ctrl + Enter to post)"
                      rows={3}
                      disabled={postingComment}
                    />
                    <div className="comment-form-actions">
                      <Button
                        type="submit"
                        disabled={!commentBody.trim() || postingComment}
                        loading={postingComment}
                      >
                        <IconMessageSquare size={14} /> Add comment
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className="empty-text">View-only role — you can read but not post comments.</p>
                )}
              </div>
            </section>
          </motion.main>

          <motion.aside
            className="task-sidebar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SidebarCard>
              <h3 className="trello-section-head" style={{ fontSize: 14 }}>Details</h3>
              <Field>
                <FieldLabel htmlFor="task-status">Status</FieldLabel>
                <Select
                  value={task.status}
                  disabled={!canWrite}
                  onValueChange={(v) => { if (v) handleStatusChange(v); }}
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-priority">Priority</FieldLabel>
                <Select
                  value={task.priority}
                  disabled={!canWrite}
                  onValueChange={(v) => { if (v) handlePriorityChange(v); }}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-assignee">Assignee</FieldLabel>
                {canWrite ? (
                  <Select
                    value={task.assigneeId ?? "unassigned"}
                    onValueChange={(v) => {
                      const next = !v || v === "unassigned" ? null : v;
                      if (next !== (task.assigneeId ?? null)) void patch({ assigneeId: next }, "Assignee updated");
                    }}
                  >
                    <SelectTrigger id="task-assignee">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(membersQ.data?.members ?? []).map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name ?? m.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="faint" style={{ fontSize: 13 }}>{assignee?.name ?? "Unassigned"}</span>
                )}
              </Field>
              <Field>
                <FieldLabel>Reporter</FieldLabel>
                <span className="faint" style={{ fontSize: 13 }}>{reporter?.name ?? "Unknown"}</span>
              </Field>
              <Field>
                <FieldLabel>Deadline</FieldLabel>
                {canWrite ? (
                  <>
                    <div className="due-presets" role="group" aria-label="Deadline">
                      {[
                        { preset: "1", label: "1 day" },
                        { preset: "3", label: "3 days" },
                        { preset: "7", label: "7 days" },
                      ].map((o) => (
                        <Button
                          key={o.preset}
                          size="sm"
                          variant={duePreset === o.preset ? "default" : "secondary"}
                          onClick={() => applyDueInDays(Number(o.preset))}
                          aria-pressed={duePreset === o.preset}
                        >
                          {o.label}
                        </Button>
                      ))}
                      <span className={cx("due-custom-heroui", duePreset === "custom" && "due-custom-heroui--active")}>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={customDays}
                          onChange={(e) => setCustomDays(e.target.value)}
                          onBlur={commitCustomDays}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          placeholder="days"
                          aria-label="Custom deadline in days"
                          className="due-custom-input"
                        />
                      </span>
                      {task.dueAt ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearDue}
                          aria-label="Clear deadline"
                        >
                          <IconX size={14} />
                        </Button>
                      ) : null}
                    </div>
                    <DatePicker
                      value={task.dueAt ? new Date(task.dueAt) : undefined}
                      onSelect={applyDueDate}
                      placeholder="Pick a specific date…"
                    />
                  </>
                ) : null}
                {task.dueAt ? (
                  <span className="faint" style={{ fontSize: 13 }}>
                    <IconClock size={12} /> {new Date(task.dueAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="faint" style={{ fontSize: 13 }}>No deadline.</span>
                )}
                {task.dueAt && task.status !== "done" && task.status !== "backlog" ? (
                  <FieldDescription>If the deadline passes first, this task moves back to Backlog automatically.</FieldDescription>
                ) : null}
              </Field>
            </SidebarCard>
          </motion.aside>
        </div>

        <ConfirmDialog
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete task?"
          body={`“${task.title}” will be moved to trash.`}
          confirmLabel="Delete task"
          danger
          busy={deleting}
          onConfirm={() => void handleDelete()}
        />
      </PageEnter>
    </AppShell>
  );
}