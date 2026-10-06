/* Lagoon card modal — joyful card details ported from treloo-joyful-design.
   Title, description, label + color, assignee, due date, checklist,
   comments thread, delete. Text fields save on Done; member/due/priority
   persist immediately; checklist + label overrides persist per-task. */

"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, listItem, motion, popIn, staggerChild, staggerParent } from "@/components/motion";
import { api, type Comment, type Member, type PaginatedResponse, type Project, type Task } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { useToast } from "@/components/overlay";
import { IconTrash } from "@/components/icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DatePicker } from "@/components/ui/date-picker";
import {
  LAGOON_TONES,
  defaultLabelForPriority,
  lagoonAvatarTone,
  lagoonInitials,
  loadLagoonMeta,
  saveLagoonChecklist,
  saveLagoonLabel,
  toYmd,
  type LagoonCheckItem,
  type LagoonTone,
} from "./lagoon-utils";

export interface LagoonCardModalProps {
  task: Task;
  project: Project | null;
  members: Member[];
  canWrite: boolean;
  onClose: () => void;
  /** Persist a backend patch (title/description/status/priority/assignee/due). */
  onPatch: (taskId: string, patch: Partial<Task>) => Promise<void>;
  onDelete: (task: Task) => void;
  onMetaChanged: () => void;
}

export function LagoonCardModal({
  task,
  project,
  members,
  canWrite,
  onClose,
  onPatch,
  onDelete,
  onMetaChanged,
}: LagoonCardModalProps) {
  const toast = useToast();
  const meta = useMemo(() => loadLagoonMeta(task.id), [task.id]);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [label, setLabel] = useState(
    meta.label !== undefined ? meta.label : (defaultLabelForPriority(task.priority) ?? ""),
  );
  const [tone, setTone] = useState<LagoonTone | undefined>(meta.tone);
  const [checklist, setChecklist] = useState<LagoonCheckItem[]>(meta.checklist);
  const [saving, setSaving] = useState(false);
  const [commentSending, setCommentSending] = useState(false);
  const [visible, setVisible] = useState(true);
  const [closeFired, setCloseFired] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Disarm the delete confirm when a different card opens (render-adjustment
  // pattern: no effect, no cascading render).
  const [confirmingTaskId, setConfirmingTaskId] = useState(task.id);
  if (task.id !== confirmingTaskId) {
    setConfirmingTaskId(task.id);
    setConfirmingDelete(false);
  }

  /** Start motion exit; parent unmounts once the exit animation completes. */
  const requestClose = () => setVisible(false);
  const finishClose = () => {
    if (closeFired) return;
    setCloseFired(true);
    onClose();
  };

  const commentsQ = useSWR<PaginatedResponse<Comment>>(
    `lagoon-comments-${task.id}`,
    () => api.comments.list(task.id, { limit: 50 }),
  );
  const comments = useMemo(
    () => [...(commentsQ.data?.data ?? [])].reverse(),
    [commentsQ.data],
  );
  const [commentText, setCommentText] = useState("");

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.name) map.set(m.userId, m.name);
      else if (m.email) map.set(m.userId, m.email);
    }
    return map;
  }, [members]);

  const persistChecklist = (next: LagoonCheckItem[]) => {
    setChecklist(next);
    saveLagoonChecklist(task.id, next);
    onMetaChanged();
  };

  const persistLabel = (nextLabel: string, nextTone: LagoonTone | undefined) => {
    setLabel(nextLabel);
    setTone(nextTone);
    saveLagoonLabel(task.id, nextLabel, nextTone);
    onMetaChanged();
  };

  const handleMember = async (userId: string | null) => {
    if (!canWrite) return;
    try {
      await onPatch(task.id, { assigneeId: userId });
    } catch (err) {
      toast({ title: "Assignee failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleDue = async (ymd: string) => {
    if (!canWrite) return;
    try {
      if (!ymd) {
        await onPatch(task.id, { dueAt: null });
        return;
      }
      const d = new Date(`${ymd}T12:00:00`);
      if (Number.isNaN(d.getTime())) return;
      await onPatch(task.id, { dueAt: d.toISOString() });
    } catch (err) {
      toast({ title: "Due date failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handlePriority = async (priority: Task["priority"]) => {
    if (!canWrite) return;
    try {
      await onPatch(task.id, { priority });
    } catch (err) {
      toast({ title: "Priority failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  const handleAddCheck = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("checkItem") as HTMLInputElement | null;
    const text = input?.value.trim() ?? "";
    if (!text) return;
    persistChecklist([...checklist, { id: Date.now(), text, done: false }]);
    if (input) input.value = "";
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || commentSending) return;
    setCommentText("");
    setCommentSending(true);
    try {
      await api.comments.create(task.id, text);
      await commentsQ.mutate();
    } catch (err) {
      setCommentText(text);
      toast({ title: "Comment failed", msg: err instanceof Error ? err.message : "Try again." });
    } finally {
      setCommentSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.comments.delete(commentId);
      await commentsQ.mutate();
    } catch (err) {
      toast({ title: "Delete failed", msg: err instanceof Error ? err.message : "Try again." });
    }
  };

  /** Done persists the text fields (title/description/label), then closes. */
  const handleDone = async () => {
    if (!canWrite) {
      requestClose();
      return;
    }
    const patch: Partial<Task> = {};
    const cleanTitle = title.trim();
    if (cleanTitle && cleanTitle !== task.title) patch.title = cleanTitle;
    if (description !== (task.description ?? "")) patch.description = description;
    // Label text persists locally even without backend changes.
    saveLagoonLabel(task.id, label.trim(), tone);
    onMetaChanged();
    if (Object.keys(patch).length > 0) {
      setSaving(true);
      try {
        await onPatch(task.id, patch);
      } catch (err) {
        toast({ title: "Save failed", msg: err instanceof Error ? err.message : "Try again." });
        setSaving(false);
        return;
      } finally {
        setSaving(false);
      }
    }
    requestClose();
  };

  const assignee = members.find((m) => m.userId === task.assigneeId) ?? null;

  const dueDate = useMemo(() => {
    const ymd = toYmd(task.dueAt);
    return ymd ? new Date(`${ymd}T12:00:00`) : undefined;
  }, [task.dueAt]);
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <AnimatePresence onExitComplete={finishClose}>
      {visible ? (
        <Dialog
          open
          onOpenChange={(next) => {
            if (!next) requestClose();
          }}
        >
          <DialogContent
            aria-label="Card details"
            showCloseButton
            className="lagoon lagoon-scroll-fade max-w-lg gap-0 overflow-y-auto p-5 duration-0 data-open:animate-none sm:max-w-lg"
            style={{ maxHeight: "85dvh" }}
          >
            <motion.div variants={popIn} initial="hidden" animate="show" exit="exit">
              <DialogHeader className="flex-row items-start gap-3">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="sr-only">Card details</DialogTitle>
                  <Input
                    aria-label="Card title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!canWrite}
                    className="border-0 bg-transparent px-0 pr-9 text-lg font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-2"
                  />
                  {project ? (
                    <DialogDescription className="mt-1.5 font-mono text-[11px] tabular-nums">
                      {project.key} · {project.name}
                    </DialogDescription>
                  ) : null}
                </div>
              </DialogHeader>

              {/* Body sections stagger in subtly on open (30ms stagger, mount
                  only — typing/editing never replays it). Header and footer
                  ride the panel pop; they are not stagger children. */}
              <motion.div variants={staggerParent} initial="hidden" animate="show" exit="exit" className="flex flex-col gap-5">
              <motion.div variants={staggerChild} className="mt-4 grid gap-4">
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    aria-label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-24 resize-y"
                    placeholder="Add a more detailed description…"
                    disabled={!canWrite}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-3">
                    <Field>
                      <FieldLabel>Label</FieldLabel>
                      <Input
                        aria-label="Label"
                        value={label}
                        onChange={(e) => persistLabel(e.target.value, tone)}
                        placeholder="Label name"
                        disabled={!canWrite}
                      />
                    </Field>
                    <div className="flex items-center gap-2.5">
                      {LAGOON_TONES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          aria-label={`Set ${t} label color`}
                          aria-pressed={tone === t}
                          title={t}
                          onClick={() => persistLabel(label, tone === t ? undefined : t)}
                          disabled={!canWrite}
                          data-active={tone === t}
                          className="size-7 rounded-full transition-transform hover:scale-105 active:scale-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 data-[active=true]:ring-2 data-[active=true]:ring-ring data-[active=true]:ring-offset-2"
                          style={{ background: `var(--lagoon-${t})` }}
                        />
                      ))}
                    </div>
                    <Field>
                      <FieldLabel>Priority</FieldLabel>
                      <Select
                        value={task.priority}
                        onValueChange={(v) => void handlePriority(v as Task["priority"])}
                        disabled={!canWrite}
                      >
                        <SelectTrigger aria-label="Priority" className="w-full capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="none">None</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid content-start gap-3">
                    <Field>
                      <FieldLabel>Member</FieldLabel>
                      <AvatarGroup>
                        <button
                          type="button"
                          aria-label="Unassigned"
                          title="Unassigned"
                          onClick={() => void handleMember(null)}
                          disabled={!canWrite}
                          data-active={task.assigneeId === null}
                          className="grid size-8 place-items-center rounded-full text-[10px] font-semibold text-white transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                          style={{ background: "var(--lagoon-muted-fg)", opacity: task.assigneeId === null ? 1 : 0.6 }}
                        >
                          –
                        </button>
                        {members.slice(0, 8).map((m) => {
                          const display = m.name ?? m.email ?? m.userId.slice(0, 4);
                          const active = task.assigneeId === m.userId;
                          return (
                            // Real button (not a clickable span): keyboard
                            // reachable with a visible ring + pressed state.
                            // ring-2 ring-background preserves the avatar
                            // separator ring lost by nesting under the button.
                            <button
                              key={m.userId}
                              type="button"
                              title={display}
                              aria-label={`Assign ${display}`}
                              aria-pressed={active}
                              disabled={!canWrite}
                              data-active={active}
                              onClick={() => void handleMember(m.userId)}
                              className="cursor-pointer rounded-full ring-2 ring-background transition-opacity focus-visible:ring-[var(--tf-accent)] disabled:cursor-not-allowed"
                              style={{
                                opacity: active || task.assigneeId === null ? 1 : 0.6,
                              }}
                            >
                              <Avatar
                                title={display}
                                style={{
                                  background: lagoonAvatarTone(m.userId),
                                }}
                              >
                                <AvatarFallback className="bg-transparent text-[10px] font-semibold text-white">
                                  {lagoonInitials(display)}
                                </AvatarFallback>
                              </Avatar>
                            </button>
                          );
                        })}
                      </AvatarGroup>
                      {assignee ? (
                        <p className="text-xs font-medium">{assignee.name ?? assignee.email}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Unassigned — pick a member above</p>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel>Due date</FieldLabel>
                      <DatePicker
                        value={dueDate}
                        disabled={!canWrite}
                        onSelect={(d) => {
                          if (!d) {
                            void handleDue("");
                            return;
                          }
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          void handleDue(`${d.getFullYear()}-${m}-${day}`);
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </motion.div>

          <motion.div variants={staggerChild}>
          <Field>
            <FieldLabel className="tabular-nums">
              Checklist{checklist.length > 0 ? ` · ${doneCount}/${checklist.length}` : ""}
            </FieldLabel>
            <div className="flex flex-col gap-1">
              <AnimatePresence initial={false}>
                {checklist.map((item) => (
                  <motion.label
                    key={item.id}
                    layout
                    variants={listItem}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    data-done={item.done}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-[background-color,color,opacity] duration-150 hover:bg-muted data-[done=true]:text-muted-foreground data-[done=true]:[&>span]:line-through"
                  >
                    <Checkbox
                      checked={item.done}
                      disabled={!canWrite}
                      onCheckedChange={() =>
                        persistChecklist(
                          checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)),
                        )
                      }
                    />
                    <span>{item.text}</span>
                  </motion.label>
                ))}
              </AnimatePresence>
            </div>
            {canWrite ? (
              <form onSubmit={handleAddCheck} className="mt-2 flex gap-2">
                <Input name="checkItem" aria-label="New checklist item" placeholder="Add an item" />
                <Button type="submit" variant="secondary" className="font-medium active:scale-[0.97]">
                  Add
                </Button>
              </form>
            ) : null}
          </Field>
          </motion.div>

          <motion.div variants={staggerChild}>
          <Field>
            <FieldLabel className="tabular-nums">Comments{comments.length > 0 ? ` · ${comments.length}` : ""}</FieldLabel>
            <div className="flex flex-col gap-2">
              {commentsQ.isLoading ? (
                <div className="flex flex-col gap-1.5" role="status" aria-label="Loading comments">
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              ) : (
                <AnimatePresence initial={false}>
                {comments.map((c) => (
                  <motion.div
                    key={c.id}
                    layout
                    variants={listItem}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="rounded-lg border bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-semibold">
                        {names.get(c.authorId) ?? "Someone"}
                      </span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                      {canWrite ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Delete comment"
                                onClick={() => void handleDeleteComment(c.id)}
                                className="ml-auto text-muted-foreground"
                              />
                            }
                          >
                            <IconTrash size={12} />
                          </TooltipTrigger>
                          <TooltipContent>Delete comment</TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </motion.div>
                ))}
                </AnimatePresence>
              )}
            </div>
            {canWrite ? (
              <form onSubmit={handleAddComment} className="mt-2 flex gap-2">
                <Input
                  aria-label="Write a comment"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment…"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="font-medium active:scale-[0.97]"
                  disabled={!commentText.trim() || commentSending}
                  loading={commentSending}
                >
                  Send
                </Button>
              </form>
            ) : null}
          </Field>
          </motion.div>
          </motion.div>

          <Separator />

          <DialogFooter className="flex-row items-center justify-between border-0 bg-transparent p-0 pt-4 sm:justify-between">
            {canWrite ? (
              confirmingDelete ? (
                <div
                  role="group"
                  aria-label="Confirm card deletion"
                  className="flex items-center gap-2"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setConfirmingDelete(false);
                  }}
                >
                  <span className="text-[12px] font-medium text-muted-foreground">Delete this card?</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                    Keep
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    autoFocus
                    onClick={() => onDelete(task)}
                    className="active:scale-[0.97]"
                  >
                    <IconTrash size={14} /> Yes, delete
                  </Button>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setConfirmingDelete(true)} className="active:scale-[0.97]">
                  <IconTrash size={14} /> Delete card
                </Button>
              )
            ) : (
              <span />
            )}
            <Button
              onClick={() => void handleDone()}
              disabled={saving}
              loading={saving}
              className="lagoon-create-btn border-0 font-semibold active:scale-[0.97]"
            >
              Done
            </Button>
          </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    ) : null}
  </AnimatePresence>
  );
}