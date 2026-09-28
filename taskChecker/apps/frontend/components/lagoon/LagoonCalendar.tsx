/* Lagoon calendar — joyful month grid ported from treloo-joyful-design
   src/routes/calendar.tsx, backed by the real tasks API.
   Monday-first month grid, prev/today/next nav, per-day task chips with
   label-tone dots, assignee + project subline. Click a chip to open the
   card modal. Undated tasks render in a strip below the grid.

   Presentation layer runs on the shadcn set (Card / CardHeader / Button /
   Badge / Tooltip) with a subtle month-change fade from components/motion.
   The grid itself stays custom: react-day-picker (components/ui/calendar)
   renders day cells but has no slot for per-day task chips or the
   outside-day sizing this board view needs. */

"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter } from "lucide-react";
import type { Task } from "@/lib/api";
import { cn } from "@/lib/utils";
import { motion } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { effectiveLabel, lagoonInitials, loadLagoonMeta, toYmd, toneForPriority } from "./lagoon-utils";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toneDotVar(task: Task, metaTick: number): string {
  // metaTick re-reads per-task local meta (labels) after modal saves.
  void metaTick;
  const meta = loadLagoonMeta(task.id);
  const label = effectiveLabel(task.priority, meta);
  const tone = label?.tone ?? toneForPriority(task.priority) ?? "ocean";
  return `var(--lagoon-${tone})`;
}

export interface LagoonCalendarProps {
  tasks: Task[];
  projectLabel: string;
  today: string | null;
  metaTick: number;
  memberName: (userId: string | null) => string | null;
  onOpen: (task: Task) => void;
}

export function LagoonCalendar({ tasks, projectLabel, today, metaTick, memberName, onOpen }: LagoonCalendarProps) {
  const [viewDate, setViewDate] = useState(() => {
    if (today) {
      const [y, m] = today.split("-").map(Number);
      if (y && m) return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [upcomingOnly, setUpcomingOnly] = useState(false);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Trivial derivation (≤42 numbers) — deliberately unmemoized so the
  // React Compiler can optimize this component.
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => index - firstDay + 1);

  const visibleTasks = useMemo(() => {
    if (!upcomingOnly || !today) return tasks;
    return tasks.filter((t) => {
      const ymd = toYmd(t.dueAt);
      return ymd != null && ymd >= today && t.status !== "done";
    });
  }, [tasks, upcomingOnly, today]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of visibleTasks) {
      const ymd = toYmd(t.dueAt);
      if (!ymd) continue;
      const list = map.get(ymd);
      if (list) list.push(t);
      else map.set(ymd, [t]);
    }
    return map;
  }, [visibleTasks]);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTasks = visibleTasks.filter((t) => toYmd(t.dueAt)?.startsWith(monthPrefix));
  const undated = visibleTasks.filter((t) => !toYmd(t.dueAt));

  function moveMonth(amount: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function goToday() {
    if (today) {
      const [y, m] = today.split("-").map(Number);
      if (y && m) {
        setViewDate(new Date(y, m - 1, 1));
        return;
      }
    }
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="flex flex-col justify-between gap-5 border-b border-border/70 px-3 pb-6 pt-5 sm:flex-row sm:items-end sm:px-5 sm:pt-6 sm:pb-7">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            <CalendarDays size={14} aria-hidden />
            Schedule
          </div>
          <h1 className="lagoon-display text-3xl font-semibold tracking-tight sm:text-4xl">Calendar</h1>
          <p className="mt-2 max-w-[34rem] text-sm text-muted-foreground">
            A clear view of deadlines{projectLabel ? ` in ${projectLabel}` : " across every Lagoon project"}.
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={upcomingOnly ? "outline" : "secondary"}
                  size="sm"
                  onClick={() => setUpcomingOnly(false)}
                  aria-pressed={!upcomingOnly}
                />
              }
            >
              <Filter size={14} aria-hidden /> {projectLabel || "All projects"}
            </TooltipTrigger>
            <TooltipContent>{projectLabel || "All tasks in view"}</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            variant={upcomingOnly ? "secondary" : "outline"}
            size="sm"
            onClick={() => setUpcomingOnly((v) => !v)}
            aria-pressed={upcomingOnly}
          >
            <Clock3 size={14} aria-hidden /> Upcoming
          </Button>
        </div>
      </div>

      <Card
        className="mx-3 mt-6 overflow-hidden py-0 sm:mx-5 sm:mt-8"
        aria-label={`${MONTH_NAMES[month]} ${year} calendar`}
      >
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 py-4">
          <div>
            <CardTitle className="lagoon-display text-lg">
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <CardDescription>
              <Badge variant="secondary" className="mt-1.5">
                {monthTasks.length} scheduled {monthTasks.length === 1 ? "task" : "tasks"}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous month"
                    onClick={() => moveMonth(-1)}
                  />
                }
              >
                <ChevronLeft size={16} aria-hidden />
              </TooltipTrigger>
              <TooltipContent>Previous month</TooltipContent>
            </Tooltip>
            <Button type="button" variant="secondary" size="sm" onClick={goToday}>
              Today
            </Button>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next month"
                    onClick={() => moveMonth(1)}
                  />
                }
              >
                <ChevronRight size={16} aria-hidden />
              </TooltipTrigger>
              <TooltipContent>Next month</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40" aria-hidden>
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground sm:px-3 sm:text-left"
              >
                {day}
              </div>
            ))}
          </div>

          <motion.div
            key={`${year}-${month}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="grid grid-cols-7"
          >
            {cells.map((day, index) => {
              const validDay = day > 0 && day <= daysInMonth;
              const key = validDay ? dateKey(year, month, day) : "";
              const dayTasks = key ? (tasksByDate.get(key) ?? []) : [];
              const isToday = !!today && key === today;
              return (
                <div
                  // Real days key on their stable date; placeholder cells get
                  // positional keys (they remount with the month anyway).
                  key={validDay ? key : `outside-${index}`}
                  className={cn(
                    "min-h-28 border-b border-r border-border/60 bg-card/35 p-1.5 sm:min-h-36 sm:p-2",
                    !validDay && "bg-muted/50",
                  )}
                >
                  {validDay ? (
                    <>
                      <div
                        className={cn(
                          "mb-1 grid size-6 place-items-center rounded-full text-xs text-muted-foreground",
                          isToday && "bg-primary font-semibold text-primary-foreground",
                        )}
                      >
                        {day}
                      </div>
                      <div className="flex flex-col gap-1">
                        {dayTasks.slice(0, 3).map((task) => {
                          const name = memberName(task.assigneeId);
                          return (
                            <Tooltip key={task.id}>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    onClick={() => onOpen(task)}
                                    className="block w-full rounded-md bg-muted/90 p-1.5 text-left shadow-[inset_0_0_0_1px_var(--border)] transition-all duration-150 ease-out hover:-translate-y-px"
                                  />
                                }
                              >
                                <span className="flex items-start gap-1.5">
                                  <span
                                    aria-hidden
                                    className="mt-1 size-1.5 flex-none rounded-full"
                                    style={{ background: toneDotVar(task, metaTick) }}
                                  />
                                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold leading-snug">
                                    {task.title}
                                  </span>
                                </span>
                                <span className="mt-1 block overflow-hidden text-ellipsis whitespace-nowrap pl-3 text-[9px] text-muted-foreground">
                                  {name ? `${lagoonInitials(name)} · ` : ""}
                                  {projectLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {task.title} — {projectLabel}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {dayTasks.length > 3 ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={() => onOpen(dayTasks[3]!)}
                                  className="rounded px-1.5 py-0.5 text-left text-[10px] font-semibold text-primary hover:bg-primary/10"
                                />
                              }
                            >
                              +{dayTasks.length - 3} more
                            </TooltipTrigger>
                            <TooltipContent>
                              {dayTasks
                                .slice(3)
                                .map((t) => t.title)
                                .join(", ")}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>

      {undated.length > 0 ? (
        <Card className="mx-3 mt-4 gap-3 py-0 pb-3 sm:mx-5" aria-label={`Unscheduled, ${undated.length} tasks`}>
          <CardHeader className="py-3">
            <CardTitle className="lagoon-display flex items-center gap-2 text-[13px] font-semibold">
              No date <Badge variant="secondary">{undated.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              {undated.map((task) => {
                const name = memberName(task.assigneeId);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onOpen(task)}
                    className="flex items-center gap-3 rounded-md border border-border/70 bg-card px-3 py-2 text-left transition-colors duration-150 hover:border-primary/50 hover:bg-muted/50"
                  >
                    <span
                      aria-hidden
                      className="size-2 flex-none rounded-full"
                      style={{ background: toneDotVar(task, metaTick) }}
                    />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {task.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {name ?? "Unassigned"} · {projectLabel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
