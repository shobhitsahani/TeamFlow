/* Lagoon board — joyful kanban ported from treloo-joyful-design, backed by
   the real projects/tasks API. Board / Timeline / Calendar views, label-tone
   filter, active-only toggle, search, drag-and-drop (mouse + touch),
   inline composers, list rename, starring, and the full card modal. */

"use client";

import { Suspense, memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LagoonShell, useLagoonChrome } from "@/components/lagoon/LagoonShell";
import { EventManager, type CalendarEvent } from "@/components/ui/event-manager";
import { LagoonCardModal } from "@/components/lagoon/LagoonCardModal";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconColumns,
  IconList,
  IconListTodo,
  IconLogout,
  IconMenu,
  IconMoreHorizontal,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSliders,
  IconStar,
  IconX,
} from "@/components/icons";
import { api, getCurrentTenantId, type ListLabel, type Member, type Task, type Project } from "@/lib/api";
import { useToast } from "@/components/overlay";
import { useAuth } from "@/lib/auth";
import { useTenant } from "@/components/store";
import { useSWR } from "@/lib/swr";
import { useUpdateTask } from "@/lib/mutations";
import { AnimatePresence, DUR, LAYOUT_SPRING, motion, PageEnter, useLayoutReady, viewFade } from "@/components/motion";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { CinematicThemeSwitcher } from "@/components/ui/cinematic-theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cx } from "@/lib/utils";
import {
  LAGOON_TONES,
  clearLagoonMeta,
  effectiveLabel,
  lagoonAvatarTone,
  lagoonDueBadge,
  lagoonInitials,
  loadLagoonMeta,
  toYmd,
  todayYmd,
  type LagoonTone,
} from "@/components/lagoon/lagoon-utils";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "done"] as const;
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
/* Board column dots — gold backlog / purple todo / green progress / success done. */
const STATUS_DOT: Record<string, string> = {
  backlog: "var(--lagoon-gold)",
  todo: "var(--lagoon-purple)",
  in_progress: "var(--lagoon-green)",
  done: "var(--lagoon-success)",
};

type BoardView = "board" | "timeline" | "calendar";

/** Joyful task card — label pill, title, description, assignee, due badge,
 *  checklist progress. Click opens the card modal. Mouse uses native HTML5
 *  drag-and-drop; touch uses the long-press pointer handlers below. */
const LagoonTaskCard = memo(function LagoonTaskCard({
  task,
  metaTick,
  assigneeName,
  draggable,
  dragging,
  touchActive,
  layoutReady,
  canWrite,
  isDone,
  today,
  moveTargets,
  onDragStart,
  onDragEnd,
  onTouchDragStart,
  onTouchDragMove,
  onTouchDragEnd,
  onTouchDragCancel,
  onOpen,
  onDone,
  onMove,
}: {
  task: Task;
  metaTick: number;
  assigneeName: string | null;
  draggable: boolean;
  dragging: boolean;
  touchActive: boolean;
  /** False on first paint / board switch: skips layout swirl, animates only
   *  real user-driven moves afterwards. */
  layoutReady: boolean;
  canWrite: boolean;
  isDone: boolean;
  today: string | null;
  /** All board lists (status + display label) for the keyboard Move menu. */
  moveTargets: { status: Task["status"]; label: string }[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onTouchDragStart: (e: React.PointerEvent, taskId: string) => void;
  onTouchDragMove: (e: React.PointerEvent) => void;
  onTouchDragEnd: (e: React.PointerEvent) => void;
  onTouchDragCancel: () => void;
  onOpen: (task: Task) => void;
  onDone: (task: Task) => void;
  onMove: (task: Task, status: Task["status"]) => void;
}) {
  // Label + checklist live in per-task local meta (no backend fields for
  // them); metaTick re-reads after the modal saves.
  const meta = useMemo(() => {
    void metaTick;
    return loadLagoonMeta(task.id);
  }, [task.id, metaTick]);
  const label = useMemo(() => effectiveLabel(task.priority, meta), [task.priority, meta]);
  const dueYmd = toYmd(task.dueAt);
  const due = dueYmd ? lagoonDueBadge(dueYmd, today) : null;
  const doneItems = meta.checklist.filter((c) => c.done).length;
  // Keyboard Move menu (M shortcut) — controlled open so the key and the
  // button share one menu. Hidden entirely for read-only viewers.
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <motion.div
      // Position-only layout: text never stretches while the card settles.
      // Disabled while dragging (fights the drag) and before first paint
      // (mount/refetch swirl) — only real user-driven moves animate.
      layout={layoutReady && !dragging && !touchActive ? "position" : false}
      data-slot="lagoon-card"
      role="listitem"
      tabIndex={0}
      aria-label={`Open ${task.title}`}
      draggable={draggable}
      onDragStart={(e: unknown) => onDragStart(e as React.DragEvent, task.id)}
      onDragEnd={onDragEnd as unknown as (e: unknown) => void}
      onPointerDown={(e) => onTouchDragStart(e, task.id)}
      onPointerMove={onTouchDragMove}
      onPointerUp={onTouchDragEnd}
      onPointerCancel={onTouchDragCancel}
      onContextMenu={(e) => {
        if (touchActive) e.preventDefault();
      }}
      onClick={() => onOpen(task)}
      style={touchActive ? { touchAction: "none", userSelect: "none" } : { touchAction: "pan-y" }}
      onKeyDown={(e) => {
        // Inner controls (e.g. the Done button) handle their own activation;
        // ignore bubbled keys so they don't also open the modal.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        } else if ((e.key === "m" || e.key === "M") && canWrite && !e.metaKey && !e.ctrlKey && !e.altKey) {
          // M opens the Move menu — the keyboard path to change lists
          // without drag-and-drop or opening the modal.
          e.preventDefault();
          setMoveOpen(true);
        }
      }}
      initial={layoutReady ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: DUR.fast, ease: "easeOut" }}
      className="[--card-spacing:0]"
    >
    <Card
      data-slot="lagoon-card-inner"
      className={cx("lagoon-card cursor-grab", dragging && "is-dragging opacity-45", isDone && "is-done opacity-70")}
    >
      {label ? (
        <Badge variant="secondary" title="Personal tag — only visible to you" className={cx("lagoon-card-label border-0", `lg-pill-${label.tone}`)}>{label.text}</Badge>
      ) : null}
      <Tooltip>
        <TooltipTrigger
          render={
            <h3 className="lagoon-card-title text-[13px] font-semibold leading-snug" />
          }
        >
          {task.title}
        </TooltipTrigger>
        <TooltipContent>{task.title}</TooltipContent>
      </Tooltip>
      {task.description ? <p className="lagoon-card-desc mt-1 line-clamp-2 text-[11px]">{task.description}</p> : null}
      {assigneeName || due || meta.checklist.length > 0 || isDone || canWrite ? (
      <div className="lagoon-card-foot mt-3 flex min-h-6 items-center gap-2">
        {assigneeName ? (
          <Avatar size="sm" title={assigneeName} style={{ background: lagoonAvatarTone(task.assigneeId ?? "?") }}>
            <AvatarFallback style={{ background: "transparent", color: "#fff", fontSize: 9 }}>
              {lagoonInitials(assigneeName)}
            </AvatarFallback>
          </Avatar>
        ) : null}
        {due ? (
          <Badge
            variant="secondary"
            className={cx(
              "lagoon-due gap-1 text-[10px] font-normal tabular-nums",
              due.status === "overdue" && !isDone && "is-overdue bg-destructive/10 text-destructive font-semibold",
              due.status === "today" && "is-today font-semibold",
            )}
          >
            <IconCalendar size={12} />
            {due.status === "overdue" && !isDone ? `Overdue · ${due.text}` : due.text}
          </Badge>
        ) : null}
        <span className="lagoon-card-stats ml-auto flex items-center gap-2 text-[10px] tabular-nums">
          {meta.checklist.length > 0 ? (
            <span className={cx(doneItems === meta.checklist.length && "is-complete")} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconListTodo size={12} />
              {doneItems}/{meta.checklist.length}
            </span>
          ) : null}
          {isDone ? <IconCheck size={12} style={{ color: "var(--lagoon-success)" }} /> : null}
          {canWrite ? (
            <DropdownMenu modal={false} open={moveOpen} onOpenChange={setMoveOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="lagoon-done-btn"
                    aria-label={`Move ${task.title} to another list`}
                    title="Move to another list (M)"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                }
              >
                <IconColumns size={12} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {moveTargets.map((t) => (
                    <DropdownMenuItem
                      key={t.status}
                      closeOnClick
                      disabled={t.status === task.status}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(task, t.status);
                      }}
                    >
                      <span
                        aria-hidden
                        style={{ width: 8, height: 8, borderRadius: 9999, background: STATUS_DOT[t.status] ?? "var(--lagoon-muted-fg)", flex: "none" }}
                      />
                      {t.label}
                      {t.status === task.status ? (
                        <IconCheck size={14} style={{ marginLeft: "auto" }} />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {!isDone && canWrite ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="lagoon-done-btn"
                    aria-label={`Mark ${task.title} as done`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDone(task);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                }
              >
                <IconCheck size={12} />
              </TooltipTrigger>
              <TooltipContent>Mark as done</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      </div>
      ) : null}
    </Card>
    </motion.div>
  );
});

/** Lagoon-style list title — click to rename inline, Enter/blur saves. */
function LagoonListTitle({
  status,
  title,
  canWrite,
  onRename,
}: {
  status: Task["status"];
  title: string;
  canWrite: boolean;
  onRename: (status: Task["status"], label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  // Sync draft when the saved title changes outside editing (render-adjustment
  // pattern: no effect, no cascading render).
  const [prevTitle, setPrevTitle] = useState(title);
  const [prevEditing, setPrevEditing] = useState(editing);
  if (title !== prevTitle || editing !== prevEditing) {
    setPrevTitle(title);
    setPrevEditing(editing);
    if (!editing) setDraft(title);
  }

  if (!editing) {
    return (
      <h2
        title={canWrite ? "Rename list" : title}
        onClick={() => {
          if (canWrite) {
            setDraft(title);
            setEditing(true);
          }
        }}
        // Rename is click-driven; expose it to keyboard users identically.
        tabIndex={canWrite ? 0 : undefined}
        role={canWrite ? "button" : undefined}
        aria-label={canWrite ? `Rename list ${title}` : undefined}
        onKeyDown={(e) => {
          if (!canWrite) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDraft(title);
            setEditing(true);
          }
        }}
        style={canWrite ? { cursor: "pointer" } : undefined}
      >
        {title}
      </h2>
    );
  }

  const commit = () => {
    setEditing(false);
    const next = draft.trim().slice(0, 50);
    if (next && next !== title) onRename(status, next);
    else setDraft(title);
  };

  return (
    <Input
      autoFocus
      value={draft}
      maxLength={50}
      aria-label="List name"
      className="h-7 px-2 py-1 text-[13px] font-semibold"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(title);
          setEditing(false);
        }
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

/** Flat timeline row — same card data, sorted by due date. Memoized so typing
 *  in search or opening a menu doesn't re-render every row. */
const LagoonTimelineRow = memo(function LagoonTimelineRow({
  task,
  project,
  assigneeName,
  metaTick,
  today,
  onOpen,
}: {
  task: Task;
  project: Project | null;
  assigneeName: string | null;
  metaTick: number;
  today: string | null;
  onOpen: (task: Task) => void;
}) {
  const meta = useMemo(() => {
    void metaTick;
    return loadLagoonMeta(task.id);
  }, [task.id, metaTick]);
  const label = useMemo(() => effectiveLabel(task.priority, meta), [task.priority, meta]);
  const dueYmd = toYmd(task.dueAt);
  const due = dueYmd ? lagoonDueBadge(dueYmd, today) : null;
  return (
    <Item
      variant="outline"
      size="sm"
      role="button"
      tabIndex={0}
      aria-label={`Open ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className="lagoon-tl-row cursor-pointer bg-card text-left"
    >
      <ItemMedia>
        <span style={{ width: 8, height: 8, borderRadius: 9999, background: STATUS_DOT[task.status] ?? "var(--lagoon-muted-fg)", flex: "none" }} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="block w-full min-w-0 truncate text-[13px]">{task.title}</ItemTitle>
        <ItemDescription className="font-mono text-[10px] tabular-nums">
          {project ? `${project.key} · ` : ""}{STATUS_LABELS[task.status] ?? task.status}
        </ItemDescription>
      </ItemContent>
      {label ? <Badge variant="secondary" title="Personal tag — only visible to you" className={cx("lagoon-card-label border-0", `lg-pill-${label.tone}`)} style={{ marginBottom: 0 }}>{label.text}</Badge> : null}
      {due ? (
        <Badge variant="secondary" className={cx("lagoon-due gap-1 font-normal", due.status === "overdue" && "is-overdue bg-destructive/10 text-destructive font-semibold", due.status === "today" && "is-today font-semibold")}>
          <IconCalendar size={12} />{due.text}
        </Badge>
      ) : null}
      {assigneeName ? (
        <Avatar size="sm" title={assigneeName} style={{ background: lagoonAvatarTone(task.assigneeId ?? "?") }}>
          <AvatarFallback style={{ background: "transparent", color: "#fff", fontSize: 9 }}>
            {lagoonInitials(assigneeName)}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </Item>
  );
});

/** Touch-drag ghost — hoisted to module level (never defined inline in
 *  render) so it mounts once per drag instead of remounting every pointer
 *  move and killing the column's layout animations. */
const LagoonTouchGhost = memo(function LagoonTouchGhost({
  title,
  x,
  y,
}: {
  title: string;
  x: number;
  y: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: x,
        top: y,
        translate: "-50% -115%",
        zIndex: 200,
        pointerEvents: "none",
        minWidth: 180,
        maxWidth: 260,
        background: "var(--lagoon-card)",
        border: "1px solid var(--lagoon-border)",
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "var(--lagoon-shadow-md)",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {title}
    </div>
  );
});

function LagoonBoard() {
  const toast = useToast();
  const router = useRouter();
  const { user, memberships, logout } = useAuth();
  const { org, unread } = useTenant();
  const { openMenu, openNotifs, openNewBoard } = useLagoonChrome();
  const orgId = getCurrentTenantId();
  const searchParams = useSearchParams();
  const updateTask = useUpdateTask();

  const myRole = memberships.find((m) => m.tenant_id === orgId)?.role;
  const canWrite = myRole === "owner" || myRole === "admin" || myRole === "member";

  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `board-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const projects = projectsQ.data?.projects ?? [];

  const selectedProjectId =
    searchParams.get("project") && projects.some((p) => p.id === searchParams.get("project"))
      ? (searchParams.get("project") as string)
      : (projects[0]?.id ?? "");
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const tasksQ = useSWR<{ data: Task[]; nextCursor: string | null; hasMore: boolean }>(
    orgId && selectedProjectId ? `board-tasks-${orgId}-${selectedProjectId}` : null,
    () => api.tasks.list(orgId!, selectedProjectId, { limit: 100 }),
  );
  const projectTasks = useMemo(() => tasksQ.data?.data ?? [], [tasksQ.data]);

  const listsQ = useSWR<{ lists: ListLabel[] }>(
    selectedProjectId ? `board-lists-${selectedProjectId}` : null,
    () => api.projects.lists(selectedProjectId),
  );
  const labelMap = useMemo(
    () => new Map((listsQ.data?.lists ?? []).map((l) => [l.status, l.label])),
    [listsQ.data],
  );
  const labelFor = useCallback(
    (status: string) => labelMap.get(status as Task["status"]) ?? STATUS_LABELS[status] ?? status,
    [labelMap],
  );

  const membersQ = useSWR<{ members: Member[] }>(
    orgId ? `ctx-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );
  const members = useMemo(() => membersQ.data?.members ?? [], [membersQ.data]);
  const memberName = useCallback(
    (userId: string | null) => {
      if (!userId) return null;
      const m = members.find((x) => x.userId === userId);
      return m?.name ?? m?.email ?? null;
    },
    [members],
  );

  const handleRenameList = useCallback(
    async (status: Task["status"], label: string) => {
      const clean = label.trim().slice(0, 50);
      if (!canWrite || !selectedProjectId || !clean || clean === labelFor(status)) return;
      await listsQ.mutate(
        (current) => ({
          lists: [...(current?.lists ?? []).filter((l) => l.status !== status), { status, label: clean }],
        }),
        { revalidate: false },
      );
      try {
        await api.projects.renameList(selectedProjectId, status, clean);
        toast({ title: "List renamed", msg: `Now called "${clean}".` });
        await listsQ.mutate();
      } catch (err) {
        await listsQ.mutate();
        toast({ title: "Rename failed", msg: err instanceof Error ? err.message : "Try again." });
      }
    },
    [canWrite, selectedProjectId, listsQ, labelFor, toast],
  );

  // Joyful filters — Lagoon search + label-tone dots + active-only toggle.
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [toneFilter, setToneFilter] = useState<LagoonTone | null>(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [metaTick, setMetaTick] = useState(0);
  const bumpMeta = useCallback(() => setMetaTick((t) => t + 1), []);
  const [today] = useState<string | null>(() => todayYmd());

  // Board / Timeline / Calendar views (?view= deep-links from the sidebar).
  const viewParam = searchParams.get("view");
  const [view, setView] = useState<BoardView>(
    viewParam === "calendar" || viewParam === "timeline" ? viewParam : "board",
  );
  // Sync view when the URL param changes (render-adjustment, no effect).
  const [prevViewParam, setPrevViewParam] = useState(viewParam);
  if (viewParam !== prevViewParam) {
    setPrevViewParam(viewParam);
    if (viewParam === "board" || viewParam === "timeline" || viewParam === "calendar") {
      setView(viewParam);
    }
  }

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [touchDrag, setTouchDrag] = useState<{ taskId: string; active: boolean; x: number; y: number } | null>(null);
  const touchTimer = useRef<number | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  // Element that opened the card modal — focus returns here on close.
  const openerRef = useRef<HTMLElement | null>(null);
  const restoreOpenerFocus = useCallback(() => {
    const el = openerRef.current;
    openerRef.current = null;
    if (el && document.contains(el)) {
      requestAnimationFrame(() => el.focus({ preventScroll: true }));
    }
  }, []);
  const TOUCH_HOLD_MS = 280;
  // 20px budget before the hold cancels; a mostly-vertical swipe is a page
  // scroll, not a drag — release the hold so scrolling never gets stuck.
  const TOUCH_MOVE_TOLERANCE = 20;
  const TOUCH_SCROLL_RATIO = 2;

  useEffect(() => {
    return () => {
      if (touchTimer.current !== null) window.clearTimeout(touchTimer.current);
    };
  }, []);

  const [composerFor, setComposerFor] = useState<Task["status"] | null>(null);
  const [composerText, setComposerText] = useState("");
  const [starred, setStarred] = useState(false);
  // Client-only starred flag per board; read in a subscription callback so the
  // effect body never calls setState synchronously.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        try {
          return window.localStorage.getItem(`tf.board.star.${selectedProjectId}`) === "1";
        } catch {
          return false;
        }
      })
      .then((value) => {
        if (!cancelled) setStarred(value);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);
  const toggleStarred = useCallback(() => {
    setStarred((v) => {
      try {
        window.localStorage.setItem(`tf.board.star.${selectedProjectId}`, v ? "0" : "1");
      } catch {
        // storage unavailable — session-only star
      }
      return !v;
    });
  }, [selectedProjectId]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedTask = selectedTaskId ? (projectTasks.find((t) => t.id === selectedTaskId) ?? null) : null;

  const handleSelectProject = useCallback(
    (id: string) => {
      setSelectedTaskId(null);
      setComposerFor(null);
      router.push(`/app/board?project=${id}`);
    },
    [router],
  );

  const columns = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        tasks: projectTasks.filter((t) => t.status === status),
      })),
    [projectTasks],
  );

  const filteredColumns = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    // metaTick re-reads per-task local meta (labels/checklists) after modal saves.
    void metaTick;
    return columns.map((col) => ({
      ...col,
      tasks: col.tasks.filter((t) => {
        if (activeOnly && t.status === "done") return false;
        if (toneFilter) {
          const meta = loadLagoonMeta(t.id);
          const label = effectiveLabel(t.priority, meta);
          if (!label || label.tone !== toneFilter) return false;
        }
        if (!q) return true;
        const meta = loadLagoonMeta(t.id);
        const labelText = effectiveLabel(t.priority, meta)?.text ?? "";
        return `${t.title} ${t.description ?? ""} ${labelText}`.toLowerCase().includes(q);
      }),
    }));
  }, [columns, deferredSearch, activeOnly, toneFilter, metaTick]);

  const flatTasks = useMemo(() => filteredColumns.flatMap((c) => c.tasks), [filteredColumns]);

  // Personal-tag counts per tone for the filter dots. Personal tags live on
  // this device only (see lagoon-utils), so counts are labeled as yours.
  // Honors the Active scope but not the tone filter itself (a selected tone
  // must still show its own total).
  const toneCounts = useMemo(() => {
    void metaTick;
    const counts: Record<LagoonTone, number> = { gold: 0, green: 0, purple: 0 };
    for (const t of projectTasks) {
      if (activeOnly && t.status === "done") continue;
      const tone = effectiveLabel(t.priority, loadLagoonMeta(t.id))?.tone;
      if (tone) counts[tone] += 1;
    }
    return counts;
  }, [projectTasks, metaTick, activeOnly]);

  const timelineTasks = useMemo(
    () =>
      [...flatTasks].sort((a, b) => {
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return a.dueAt < b.dueAt ? -1 : 1;
      }),
    [flatTasks],
  );

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", taskId);
    } catch {
      /* noop */
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverCol(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
  }, []);

  // Screen-reader announcements for list moves (drag, menu, or Done) —
  // the toast is visual-only, this is the non-visual equivalent.
  const [announce, setAnnounce] = useState("");

  const performDrop = useCallback(
    async (taskId: string, newStatus: string) => {
      const target = projectTasks.find((t) => t.id === taskId);
      if (!target || target.status === newStatus) return;
      await tasksQ.mutate(
        (current) => ({
          ...(current ?? { data: [], nextCursor: null, hasMore: false }),
          data: (current?.data ?? []).map((t) =>
            t.id === taskId ? { ...t, status: newStatus as Task["status"] } : t,
          ),
        }),
        { revalidate: false },
      );
      try {
        await updateTask(taskId, { status: newStatus as Task["status"] }, selectedProjectId);
        toast({ title: "Task moved", msg: `Moved to ${labelFor(newStatus)}` });
        setAnnounce(`Moved ${target.title} to ${labelFor(newStatus)}.`);
        await tasksQ.mutate();
      } catch (err) {
        await tasksQ.mutate();
        toast({ title: "Move failed", msg: err instanceof Error ? err.message : "Try again." });
        setAnnounce(`Could not move ${target.title}. Try again.`);
      }
    },
    [projectTasks, updateTask, selectedProjectId, toast, tasksQ, labelFor],
  );

  const handleDone = useCallback(
    async (task: Task) => {
      if (!canWrite || task.status === "done") return;
      await performDrop(task.id, "done");
    },
    [canWrite, performDrop],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      setDragOverCol(null);
      const taskId = draggedTaskId;
      setDraggedTaskId(null);
      if (!taskId) return;
      await performDrop(taskId, newStatus);
    },
    [draggedTaskId, performDrop],
  );

  const statusFromPoint = useCallback((x: number, y: number): string | null => {
    if (typeof document === "undefined") return null;
    const el = document.elementFromPoint(x, y);
    const col = el?.closest?.("[data-status]");
    return col?.getAttribute("data-status") ?? null;
  }, []);

  const cancelTouchDrag = useCallback(() => {
    if (touchTimer.current !== null) {
      window.clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    touchOrigin.current = null;
    setTouchDrag(null);
    setDragOverCol(null);
  }, []);

  const handleTouchDragStart = useCallback(
    (e: React.PointerEvent, taskId: string) => {
      if (e.pointerType === "mouse" || !canWrite) return;
      if (e.buttons !== undefined && e.buttons !== 1) return;
      touchOrigin.current = { x: e.clientX, y: e.clientY };
      setTouchDrag({ taskId, active: false, x: e.clientX, y: e.clientY });
      if (touchTimer.current !== null) window.clearTimeout(touchTimer.current);
      touchTimer.current = window.setTimeout(() => {
        touchTimer.current = null;
        setTouchDrag((t) => (t && t.taskId === taskId ? { ...t, active: true } : t));
        setDraggedTaskId(taskId);
        setDragOverCol(null);
      }, TOUCH_HOLD_MS);
    },
    [canWrite],
  );

  const handleTouchDragMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" || !touchDrag) return;
      if (!touchDrag.active) {
        const origin = touchOrigin.current;
        if (origin) {
          const dx = Math.abs(e.clientX - origin.x);
          const dy = Math.abs(e.clientY - origin.y);
          // Vertical swipe = page scroll intent: release the hold so the
          // page scrolls instead of arming a drag. Horizontal drift inside
          // the tolerance keeps the hold alive.
          if (dy > TOUCH_SCROLL_RATIO * Math.max(dx, 1) && dy > TOUCH_MOVE_TOLERANCE / 2) {
            if (touchTimer.current !== null) {
              window.clearTimeout(touchTimer.current);
              touchTimer.current = null;
            }
            touchOrigin.current = null;
            setTouchDrag(null);
            return;
          }
          if (Math.hypot(dx, dy) > TOUCH_MOVE_TOLERANCE) {
            if (touchTimer.current !== null) {
              window.clearTimeout(touchTimer.current);
              touchTimer.current = null;
            }
            touchOrigin.current = null;
            setTouchDrag(null);
            return;
          }
        }
        setTouchDrag({ ...touchDrag, x: e.clientX, y: e.clientY });
        return;
      }
      setTouchDrag({ ...touchDrag, x: e.clientX, y: e.clientY });
      const status = statusFromPoint(e.clientX, e.clientY);
      setDragOverCol((prev) => (prev === status ? prev : status));
    },
    [touchDrag, statusFromPoint],
  );

  const handleTouchDragEnd = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (touchTimer.current !== null) {
        window.clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
      touchOrigin.current = null;
      const wasActive = touchDrag?.active ?? false;
      const taskId = touchDrag?.taskId;
      setTouchDrag(null);
      setDragOverCol(null);
      setDraggedTaskId(null);
      if (!wasActive || !taskId) return;
      const status = statusFromPoint(e.clientX, e.clientY);
      if (!status) return;
      void performDrop(taskId, status);
    },
    [touchDrag, statusFromPoint, performDrop],
  );

  const handleQuickAdd = useCallback(async () => {
    const title = composerText.trim();
    if (!title || !orgId || !selectedProjectId || !composerFor) return;
    setComposerText("");
    try {
      await api.tasks.create({ projectId: selectedProjectId, title, status: composerFor });
      await tasksQ.mutate();
    } catch (err) {
      setComposerText(title);
      toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  }, [composerText, composerFor, orgId, selectedProjectId, tasksQ, toast]);

  /** Backend patch with optimistic UI — throws on failure for modal handling. */
  const patchTask = useCallback(
    async (taskId: string, patch: Partial<Task>) => {
      await tasksQ.mutate(
        (current) => ({
          ...(current ?? { data: [], nextCursor: null, hasMore: false }),
          data: (current?.data ?? []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        }),
        { revalidate: false },
      );
      try {
        await updateTask(taskId, patch, selectedProjectId);
        await tasksQ.mutate();
      } catch (err) {
        await tasksQ.mutate();
        throw err;
      }
    },
    [tasksQ, updateTask, selectedProjectId],
  );

  const handleDeleteTask = useCallback(
    async (task: Task) => {
      try {
        await api.tasks.delete(task.id);
        clearLagoonMeta(task.id);
        setSelectedTaskId(null);
        restoreOpenerFocus();
        await tasksQ.mutate();
        toast({ title: "Card deleted", msg: "Soft-deleted and hidden from boards." });
      } catch (err) {
        toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again." });
      }
    },
    [tasksQ, toast, restoreOpenerFocus],
  );

  /** Calendar view: tasks with due dates become draggable events. Colors mirror
   *  toneForPriority (gold has no calendar swatch; orange is its stand-in). */
  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      flatTasks
        .filter((t) => t.dueAt)
        .map((t) => {
          const start = new Date(t.dueAt as string);
          const color =
            t.priority === "critical" || t.priority === "high"
              ? "green"
              : t.priority === "medium"
                ? "purple"
                : t.priority === "low"
                  ? "orange"
                  : "blue";
          return {
            id: t.id,
            title: t.title,
            description: t.description ?? undefined,
            startTime: start,
            endTime: new Date(start.getTime() + 3600000),
            color,
            category: labelFor(t.status),
            tags: [t.priority],
          };
        }),
    [flatTasks, labelFor],
  );

  const handleCalCreate = useCallback(
    async (ev: Omit<CalendarEvent, "id">) => {
      if (!selectedProjectId) return;
      try {
        await api.tasks.create({
          projectId: selectedProjectId,
          title: ev.title,
          description: ev.description,
          status: "backlog",
          dueAt: ev.startTime.toISOString(),
        });
        await tasksQ.mutate();
        toast({ title: "Event created", msg: `"${ev.title}" added to the board.` });
      } catch (err) {
        toast({ title: "Create failed", msg: err instanceof Error ? err.message : "Try again." });
      }
    },
    [selectedProjectId, tasksQ, toast],
  );

  const handleCalUpdate = useCallback(
    async (id: string, patch: Partial<CalendarEvent>) => {
      const next: Partial<Task> = {};
      if (patch.title !== undefined) next.title = patch.title;
      if (patch.description !== undefined) next.description = patch.description;
      if (patch.startTime !== undefined) next.dueAt = (patch.startTime as Date).toISOString();
      try {
        await patchTask(id, next);
      } catch (err) {
        toast({ title: "Reschedule failed", msg: err instanceof Error ? err.message : "Try again." });
      }
    },
    [patchTask, toast],
  );

  const handleCalDelete = useCallback(
    async (id: string) => {
      const target = projectTasks.find((t) => t.id === id);
      if (target) await handleDeleteTask(target);
    },
    [projectTasks, handleDeleteTask],
  );

  const openCard = useCallback((task: Task) => {
    // Remember the trigger so focus can return to the exact card/row/chip
    // on close (Base UI has no Trigger here to return to on its own).
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedTaskId(task.id);
  }, []);

  const closeCard = useCallback(() => {
    setSelectedTaskId(null);
    // onClose fires from the modal's onExitComplete, so the card is settled
    // and ready to take focus back.
    restoreOpenerFocus();
  }, [restoreOpenerFocus]);

  // Layout animations stay off through first paint and board switches —
  // only real user-driven moves (drop, add, delete) animate afterwards.
  const layoutReady = useLayoutReady(selectedProjectId);

  // Touch-drag ghost task, derived once per render (stable props for the
  // memoized ghost below — no inline IIFE in the JSX).
  const touchGhostTask = touchDrag?.active
    ? projectTasks.find((t) => t.id === touchDrag.taskId) ?? null
    : null;

  if (projectsQ.isLoading) {
    return (
      <LagoonShell
        projects={[]}
        activeProjectId=""
        onSelectProject={() => {}}
        onProjectsChanged={() => projectsQ.mutate()}
      >
        <div className="lagoon-list-wrap" style={{ paddingTop: 32 }}>
          <div className="lagoon-board-scroll">
            <div className="lagoon-cols" role="status" aria-label="Loading boards">
              {[0, 1, 2].map((c) => (
                <div key={c} className="flex flex-none flex-col gap-2.5" style={{ width: 280 }} aria-hidden>
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </LagoonShell>
    );
  }

  if (projectsQ.error) {
    return (
      <LagoonShell
        projects={[]}
        activeProjectId=""
        onSelectProject={() => {}}
        onProjectsChanged={() => projectsQ.mutate()}
      >
        <div className="lagoon-list-wrap" style={{ paddingTop: 32 }}>
          <PageEnter className="lagoon-empty">
            <h3 className="lagoon-display" style={{ fontSize: 16, fontWeight: 600 }}>Couldn&apos;t load boards</h3>
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>
              {projectsQ.error instanceof Error ? projectsQ.error.message : "Something went wrong."}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="lagoon-create-btn border-0"
              onClick={() => void projectsQ.mutate()}
              style={{ marginTop: 16 }}
            >
              Try again
            </Button>
          </PageEnter>
        </div>
      </LagoonShell>
    );
  }

  if (projects.length === 0) {
    return (
      <LagoonShell
        projects={projects}
        activeProjectId=""
        onSelectProject={() => {}}
        onProjectsChanged={() => projectsQ.mutate()}
      >
        <div className="lagoon-list-wrap" style={{ paddingTop: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Board
              </h1>
              <p className="lagoon-sub">{org?.name ?? "Workspace"}</p>
            </div>
            <InputGroup variant="search" className="lagoon-search" style={{ width: 280 }}>
              <InputGroupAddon align="inline-start">
                <IconSearch size={14} />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Search boards"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search boards…"
              />
            </InputGroup>
          </div>
          <PageEnter className="lagoon-empty">
            <h3 className="lagoon-display" style={{ fontSize: 16, fontWeight: 600 }}>{search ? "No boards match" : "No boards yet"}</h3>
            <p style={{ marginTop: 8, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>
              {search ? "Try a different search term." : "Create your first board to start adding cards."}
            </p>
            {!search ? (
              <Button type="button" size="sm" className="lagoon-create-btn border-0" style={{ marginTop: 16 }} onClick={openNewBoard}>
                <IconPlus size={14} /> New board
              </Button>
            ) : null}
          </PageEnter>
        </div>
      </LagoonShell>
    );
  }

  return (
    <LagoonShell
      projects={projects}
      activeProjectId={selectedProjectId}
      onSelectProject={handleSelectProject}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      {/* Polite live region: announces list moves for screen readers.
          Toasts are visual-only; this mirrors performDrop outcomes. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announce}
      </div>
      <header className="lagoon-header">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="lagoon-icon-btn lagoon-only-mobile"
                onClick={openMenu}
              />
            }
          >
            <IconMenu size={18} />
          </TooltipTrigger>
          <TooltipContent>Menu</TooltipContent>
        </Tooltip>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--lagoon-gold)", flex: "none" }} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selectedProject?.name ?? "Board"}
          </h1>
          <p className="lagoon-sub">{org?.name ?? "Workspace"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <InputGroup variant="search" className="lagoon-search hidden min-w-0 sm:flex sm:w-56" data-lagoon-desktop-search>
            <InputGroupAddon align="inline-start">
              <IconSearch size={14} />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label="Search tasks"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
            />
          </InputGroup>
          <AvatarGroup className="items-center" data-lagoon-avatar-cluster>
            {members.slice(0, 3).map((m) => {
              const display = m.name ?? m.email ?? m.userId.slice(0, 4);
              const isMe = user?.id != null && m.userId === user.id;
              const avatar = (
                <Avatar
                  title={isMe ? "Account settings" : display}
                  size="sm"
                  className="lagoon-avatar"
                  style={{
                    width: 28,
                    height: 28,
                    background: lagoonAvatarTone(m.userId),
                    border: "2px solid var(--lagoon-card)",
                    marginLeft: -8,
                    cursor: isMe ? "pointer" : undefined,
                  }}
                >
                  <AvatarFallback style={{ background: "transparent", color: "#fff", fontSize: 9 }}>
                    {lagoonInitials(display)}
                  </AvatarFallback>
                </Avatar>
              );
              /* Your own avatar opens your account menu (settings,
                 notifications, sign out). Teammates keep a name tooltip. */
              if (!isMe) return <span key={m.userId} className="contents">{avatar}</span>;
              return (
                <DropdownMenu key={m.userId} modal={false}>
                  <DropdownMenuTrigger render={avatar} aria-label="Account menu, signed in as yourself" />
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      {user ? (
                        <>
                          <span className="flex items-center gap-2">
                            <Avatar className="size-6">
                              <AvatarFallback
                                style={{
                                  background: lagoonAvatarTone(user.id),
                                  color: "#fff",
                                }}
                              >
                                {lagoonInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="block max-w-full truncate text-sm font-semibold text-foreground">
                              {user.name}
                            </span>
                          </span>
                          {user.email ? (
                            <span className="block max-w-full truncate text-xs font-normal text-muted-foreground">
                              {user.email}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="flex flex-col gap-1.5 py-0.5" aria-hidden>
                          <Skeleton className="h-3.5 w-28 rounded" />
                          <Skeleton className="h-3 w-36 rounded" />
                        </span>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem closeOnClick onClick={() => router.push("/app/settings")}>
                        <IconSettings size={16} />
                        Account settings
                      </DropdownMenuItem>
                      <DropdownMenuItem closeOnClick onClick={openNotifs}>
                        <IconBell size={16} />
                        Notifications
                        {unread > 0 ? (
                          <Badge variant="secondary" className="ml-auto tabular-nums">{unread}</Badge>
                        ) : null}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      closeOnClick
                      variant="destructive"
                      onClick={async () => {
                        await logout();
                        toast({ title: "Signed out", msg: "Session ended — see you soon." });
                        router.replace("/auth/sign-in");
                      }}
                    >
                      <IconLogout size={16} />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </AvatarGroup>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Board options"
                  className="lagoon-icon-btn relative"
                />
              }
            >
              <span className="relative inline-flex">
                <IconMoreHorizontal size={18} />
                {unread > 0 ? (
                  <Badge className="absolute top-0 right-0 border-0 p-0" style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--lagoon-green)", padding: 0 }}>
                    <span className="sr-only">{unread} unread notifications</span>
                  </Badge>
                ) : null}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem closeOnClick onClick={openNotifs}>
                <IconBell size={16} />
                Notifications
                {unread > 0 ? (
                  <Badge variant="secondary" className="ml-auto tabular-nums">{unread}</Badge>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem closeOnClick onClick={toggleStarred}>
                <IconStar size={16} style={starred ? { color: "var(--lagoon-gold)" } : undefined} />
                {starred ? "Unstar board" : "Star board"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <CinematicThemeSwitcher size="sm" />
          {/* Calendar view owns creation via the EventManager's New Event
              action — one primary CTA per screen, never two side by side. */}
          {view !== "calendar" ? (
            <Button
              type="button"
              size="sm"
              className="lagoon-create-btn border-0"
              onClick={() => {
                setComposerText("");
                setComposerFor(columns[0]?.status ?? "backlog");
                setView("board");
              }}
              disabled={!selectedProjectId || !user}
            >
              <IconPlus size={14} /> <span data-lagoon-create-label>Create</span>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="lagoon-filterbar" role="toolbar" aria-label="Board view and filters">
        <div role="group" aria-label="View" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <Button type="button" variant={view === "board" ? "secondary" : "ghost"} size="sm" className={cx("lagoon-view-btn border relative", view === "board" && "is-on")} aria-pressed={view === "board"} onClick={() => setView("board")}>
            {view === "board" ? (
              <motion.span layoutId="lagoon-view-tab" transition={LAYOUT_SPRING} aria-hidden className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-[var(--lagoon-purple)]" />
            ) : null}
            <IconColumns size={14} /> Board
          </Button>
          <Button type="button" variant={view === "timeline" ? "secondary" : "ghost"} size="sm" className={cx("lagoon-view-btn border relative", view === "timeline" && "is-on")} aria-pressed={view === "timeline"} onClick={() => setView("timeline")}>
            {view === "timeline" ? (
              <motion.span layoutId="lagoon-view-tab" transition={LAYOUT_SPRING} aria-hidden className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-[var(--lagoon-purple)]" />
            ) : null}
            <IconList size={14} /> Timeline
          </Button>
          <Button type="button" variant={view === "calendar" ? "secondary" : "ghost"} size="sm" className={cx("lagoon-view-btn border relative", view === "calendar" && "is-on")} aria-pressed={view === "calendar"} onClick={() => setView("calendar")}>
            {view === "calendar" ? (
              <motion.span layoutId="lagoon-view-tab" transition={LAYOUT_SPRING} aria-hidden className="absolute inset-x-2.5 bottom-1 h-0.5 rounded-full bg-[var(--lagoon-purple)]" />
            ) : null}
            <IconCalendar size={14} /> Calendar
          </Button>
        </div>
        <Separator orientation="vertical" className="mx-1 h-5" aria-hidden />
        <div role="group" aria-label="Filter by your personal tags, only visible to you" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="lagoon-tone-label" aria-hidden>
            Your tags
          </span>
          {LAGOON_TONES.map((tone) => (
            <Tooltip key={tone}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={toneFilter === tone ? `Clear ${tone} personal tag filter, ${toneCounts[tone]} cards` : `Filter by your ${tone} personal tags, ${toneCounts[tone]} cards, only you see these`}
                    aria-pressed={toneFilter === tone}
                    onClick={() => setToneFilter((v) => (v === tone ? null : tone))}
                    className={cx("lagoon-tone-btn rounded-full", toneFilter === tone && "is-on")}
                    style={{ background: "var(--lagoon-card)", position: "relative" }}
                  />
                }
              >
                <span style={{ width: 12, height: 12, borderRadius: 9999, background: `var(--lagoon-${tone})` }} />
                <span
                  aria-hidden
                  className="tabular-nums"
                  style={{
                    position: "absolute",
                    right: -6,
                    bottom: -6,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 9999,
                    background: "var(--lagoon-ink)",
                    color: "var(--lagoon-surface)",
                    fontSize: 9,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  {toneCounts[tone]}
                </span>
              </TooltipTrigger>
              <TooltipContent>{tone} personal tags · {toneCounts[tone]} card{toneCounts[tone] === 1 ? "" : "s"} — only you see these{toneFilter === tone ? " · click again to clear" : ""}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div role="group" aria-label="Task scope" style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <Button type="button" variant={activeOnly ? "secondary" : "outline"} size="sm" className={cx("lagoon-toggle-btn", activeOnly && "is-on")} aria-pressed={activeOnly} onClick={() => setActiveOnly((v) => !v)}>
            <IconSliders size={14} /> {activeOnly ? "Active only" : "All tasks"}
          </Button>
        </div>
        <InputGroup variant="search" className="lagoon-search w-full" data-lagoon-mobile-search>
          <InputGroupAddon align="inline-start">
            <IconSearch size={14} />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search tasks on mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
          />
        </InputGroup>
      </div>

      {tasksQ.error && selectedProjectId ? (
        <div style={{ padding: "12px 20px 0" }} role="alert">
          <p style={{ fontSize: 12, color: "var(--destructive)" }}>
            Couldn&apos;t load cards: {tasksQ.error instanceof Error ? tasksQ.error.message : "Something went wrong."}{" "}
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs font-semibold underline"
              onClick={() => void tasksQ.mutate()}
            >
              Retry
            </Button>
          </p>
        </div>
      ) : null}

      {/* View switch: short opacity crossfade (fast in, instant out), no slide.
          Skipped on first paint; tab indicator above shows the direction. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={view} variants={viewFade} initial="hidden" animate="show" exit="exit">
      {view === "board" ? (
        <div className="lagoon-board-scroll">
          <div className="lagoon-cols">
            {tasksQ.isLoading && projectTasks.length === 0 ? (
              STATUS_ORDER.map((status) => (
                <div key={status} className="lagoon-col" aria-hidden="true" style={{ gap: 8 }}>
                  <Skeleton className="h-5 w-24 rounded" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ))
            ) : (
            filteredColumns.map((col) => (
              <Card
                key={col.status}
                data-status={col.status}
                data-slot="lagoon-col"
                className="lagoon-col w-70 flex-none [--card-spacing:--spacing(2)] gap-2 px-2 sm:w-75"
                aria-label={`${labelFor(col.status)}, ${col.tasks.length} tasks`}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => void handleDrop(e, col.status)}
              >
                <div className="lagoon-col-head px-1 pt-1 pb-2">
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 9999, background: STATUS_DOT[col.status], flex: "none" }} />
                  <LagoonListTitle
                    status={col.status as Task["status"]}
                    title={labelFor(col.status)}
                    canWrite={canWrite}
                    onRename={handleRenameList}
                  />
                  <Badge variant="secondary" className="lagoon-col-count border-0 text-[11px] tabular-nums">{col.tasks.length}</Badge>
                </div>
                <div className={cx("lagoon-col-body", draggedTaskId && "is-dragging", dragOverCol === col.status && "is-dragover")} role="list">
                  <AnimatePresence initial={false} mode="popLayout">
                    {col.tasks.map((task) => (
                      <LagoonTaskCard
                        key={task.id}
                        task={task}
                        metaTick={metaTick}
                        assigneeName={memberName(task.assigneeId)}
                        draggable={canWrite}
                        dragging={draggedTaskId === task.id || (touchDrag?.active === true && touchDrag.taskId === task.id)}
                        touchActive={touchDrag?.active === true && touchDrag.taskId === task.id}
                        layoutReady={layoutReady}
                        canWrite={canWrite}
                        isDone={col.status === "done"}
                        today={today}
                        moveTargets={STATUS_ORDER.map((s) => ({ status: s, label: labelFor(s) }))}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onTouchDragStart={handleTouchDragStart}
                        onTouchDragMove={handleTouchDragMove}
                        onTouchDragEnd={handleTouchDragEnd}
                        onTouchDragCancel={cancelTouchDrag}
                        onOpen={openCard}
                        onDone={handleDone}
                        onMove={(t, s) => void performDrop(t.id, s)}
                      />
                    ))}
                  </AnimatePresence>
                  {col.tasks.length === 0 && composerFor !== col.status ? (
                    <p className="st-empty-quiet" style={{ padding: "12px 8px" }}>
                      {deferredSearch.trim() || toneFilter || activeOnly ? "No matching cards" : "No cards yet"}
                    </p>
                  ) : null}
                  {composerFor === col.status && canWrite ? (
                    <Card data-slot="lagoon-composer" className="lagoon-composer gap-2 p-2 shadow-xs">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleQuickAdd();
                      }}
                    >
                      <Textarea
                        autoFocus
                        value={composerText}
                        onChange={(e) => setComposerText(e.target.value)}
                        placeholder="What needs to be done?"
                        aria-label={`Add a card to ${labelFor(col.status)}`}
                        className="lagoon-composer-input min-h-16 resize-none border-0 bg-transparent p-1 text-xs shadow-none focus-visible:ring-0"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void handleQuickAdd();
                          } else if (e.key === "Escape") {
                            setComposerFor(null);
                            setComposerText("");
                          }
                        }}
                      />
                      <div className="lagoon-composer-actions mt-2 flex gap-1">
                        <Button type="submit" size="sm" className="lagoon-btn border-0" disabled={!composerText.trim()}>
                          Add card
                        </Button>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Cancel"
                                className="lagoon-icon-btn"
                                onClick={() => {
                                  setComposerFor(null);
                                  setComposerText("");
                                }}
                              />
                            }
                          >
                            <IconX size={16} />
                          </TooltipTrigger>
                          <TooltipContent>Cancel</TooltipContent>
                        </Tooltip>
                      </div>
                    </form>
                    </Card>
                  ) : canWrite ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="lagoon-add-card h-9 justify-start border-dashed text-xs font-normal"
                      onClick={() => {
                        setComposerText("");
                        setComposerFor(col.status as Task["status"]);
                      }}
                      disabled={!selectedProjectId || !user}
                    >
                      <IconPlus size={14} /> Add card
                    </Button>
                  ) : null}
                </div>
              </Card>
            )))}
          </div>
        </div>
      ) : view === "timeline" ? (
        <div className="lagoon-list-wrap">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 880 }}>
            {timelineTasks.length === 0 ? (
              <PageEnter className="lagoon-empty">
                <p style={{ fontSize: 13, color: "var(--lagoon-muted-fg)" }}>Nothing scheduled — add due dates to line up the work.</p>
              </PageEnter>
            ) : (
              timelineTasks.map((task) => (
                <LagoonTimelineRow
                  key={task.id}
                  task={task}
                  project={selectedProject}
                  assigneeName={memberName(task.assigneeId)}
                  metaTick={metaTick}
                  today={today}
                  onOpen={openCard}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="lagoon-list-wrap">
          <EventManager
            key={`${selectedProjectId}-${projectTasks.length}`}
            events={calendarEvents}
            onEventCreate={handleCalCreate}
            onEventUpdate={handleCalUpdate}
            onEventDelete={handleCalDelete}
            categories={STATUS_ORDER.map((s) => labelFor(s))}
            availableTags={["critical", "high", "medium", "low"]}
            defaultView="month"
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>

      {touchGhostTask && touchDrag?.active ? (
        <LagoonTouchGhost title={touchGhostTask.title} x={touchDrag.x} y={touchDrag.y} />
      ) : null}

      {!canWrite && projectTasks.length > 0 ? (
        <p style={{ padding: "0 20px 12px", fontSize: 11, color: "var(--lagoon-muted-fg)" }}>
          View-only role — ask an admin to move tasks.
        </p>
      ) : null}

      {selectedTask ? (
        <LagoonCardModal
          key={selectedTask.id}
          task={selectedTask}
          project={selectedProject}
          members={members}
          canWrite={canWrite}
          onClose={closeCard}
          onPatch={patchTask}
          onDelete={handleDeleteTask}
          onMetaChanged={bumpMeta}
        />
      ) : null}
    </LagoonShell>
  );
}

export default function BoardPageWrapper() {
  return (
    <Suspense fallback={<div className="lagoon" style={{ padding: 24 }} role="status" aria-label="Loading board"><Skeleton className="h-6 w-40 rounded" /><div style={{ display: "flex", gap: 16, marginTop: 16 }} aria-hidden><Skeleton className="h-48 rounded-lg" style={{ width: 280 }} /><Skeleton className="h-48 rounded-lg" style={{ width: 280 }} /><Skeleton className="h-48 rounded-lg" style={{ width: 280 }} /></div></div>}>
      <LagoonBoard />
    </Suspense>
  );
}
