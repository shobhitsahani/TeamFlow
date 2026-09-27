/* Lagoon calendar — joyful month grid ported from treloo-joyful-design
   src/routes/calendar.tsx, backed by the real tasks API.
   Monday-first month grid, prev/today/next nav, per-day task chips with
   label-tone dots, assignee + project subline. Click a chip to open the
   card modal. Undated tasks render in a strip below the grid. */

"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter } from "lucide-react";
import type { Task } from "@/lib/api";
import { cx } from "@/lib/utils";
import {
  effectiveLabel,
  lagoonInitials,
  loadLagoonMeta,
  toYmd,
  toneForPriority,
} from "./lagoon-utils";

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

export function LagoonCalendar({
  tasks,
  projectLabel,
  today,
  metaTick,
  memberName,
  onOpen,
}: LagoonCalendarProps) {
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
  const cells = Array.from(
    { length: Math.ceil((firstDay + daysInMonth) / 7) * 7 },
    (_, index) => index - firstDay + 1,
  );

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
    <div className="lagoon-cal-page">
      <div className="lagoon-cal-titlebar">
        <div>
          <div className="lagoon-cal-eyebrow">
            <CalendarDays size={14} />
            Schedule
          </div>
          <h1 className="lagoon-display lagoon-cal-title">Calendar</h1>
          <p className="lagoon-cal-sub">
            A clear view of deadlines{projectLabel ? ` in ${projectLabel}` : " across every Lagoon project"}.
          </p>
        </div>
        <div className="lagoon-cal-actions">
          <button
            type="button"
            className="lagoon-toggle-btn"
            onClick={() => setUpcomingOnly(false)}
            aria-pressed={!upcomingOnly}
            title={projectLabel || "All tasks in view"}
          >
            <Filter size={14} /> {projectLabel || "All projects"}
          </button>
          <button
            type="button"
            className={cx("lagoon-toggle-btn", upcomingOnly && "is-on")}
            onClick={() => setUpcomingOnly((v) => !v)}
            aria-pressed={upcomingOnly}
          >
            <Clock3 size={14} /> Upcoming
          </button>
        </div>
      </div>

      <section className="lagoon-cal-panel" aria-label={`${MONTH_NAMES[month]} ${year} calendar`}>
        <div className="lagoon-cal-panelhead">
          <div>
            <h2 className="lagoon-display lagoon-cal-month">
              {MONTH_NAMES[month]} {year}
            </h2>
            <p className="lagoon-cal-count">
              {monthTasks.length} scheduled {monthTasks.length === 1 ? "task" : "tasks"}
            </p>
          </div>
          <div className="lagoon-cal-nav">
            <button type="button" aria-label="Previous month" className="lagoon-icon-btn lagoon-cal-navbtn" onClick={() => moveMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
            <button type="button" className="lagoon-btn-secondary lagoon-cal-todaybtn" onClick={goToday}>
              Today
            </button>
            <button type="button" aria-label="Next month" className="lagoon-icon-btn lagoon-cal-navbtn" onClick={() => moveMonth(1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="lagoon-cal-weekhead" aria-hidden>
          {WEEK_DAYS.map((day) => (
            <div key={day} className="lagoon-cal-weekday">
              {day}
            </div>
          ))}
        </div>

        <div className="lagoon-cal-grid">
          {cells.map((day, index) => {
            const validDay = day > 0 && day <= daysInMonth;
            const key = validDay ? dateKey(year, month, day) : "";
            const dayTasks = key ? (tasksByDate.get(key) ?? []) : [];
            const isToday = !!today && key === today;
            return (
              <div
                key={`${key}-${index}`}
                className={cx("lagoon-cal-cell", !validDay && "is-outside")}
              >
                {validDay ? (
                  <>
                    <div className={cx("lagoon-cal-daynum", isToday && "is-today")}>{day}</div>
                    <div className="lagoon-cal-chips">
                      {dayTasks.slice(0, 3).map((task) => {
                        const name = memberName(task.assigneeId);
                        return (
                          <button
                            key={task.id}
                            type="button"
                            className="lagoon-cal-chip"
                            onClick={() => onOpen(task)}
                            title={`${task.title} — ${projectLabel}`}
                          >
                            <span className="lagoon-cal-chiprow">
                              <span
                                className="lagoon-cal-dot"
                                style={{ background: toneDotVar(task, metaTick) }}
                              />
                              <span className="lagoon-cal-chiptitle">{task.title}</span>
                            </span>
                            <span className="lagoon-cal-chipsub">
                              {name ? `${lagoonInitials(name)} · ` : ""}
                              {projectLabel}
                            </span>
                          </button>
                        );
                      })}
                      {dayTasks.length > 3 ? (
                        <button
                          type="button"
                          className="lagoon-cal-more"
                          onClick={() => onOpen(dayTasks[3]!)}
                          title={dayTasks
                            .slice(3)
                            .map((t) => t.title)
                            .join("\n")}
                        >
                          +{dayTasks.length - 3} more
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {undated.length > 0 ? (
        <section className="lagoon-cal-undated" aria-label={`Unscheduled, ${undated.length} tasks`}>
          <h2 className="lagoon-display lagoon-cal-undatedtitle">
            No date <span className="lagoon-col-count">{undated.length}</span>
          </h2>
          <div className="lagoon-cal-undatedlist">
            {undated.map((task) => {
              const name = memberName(task.assigneeId);
              return (
                <button key={task.id} type="button" className="lagoon-tl-row" onClick={() => onOpen(task)}>
                  <span
                    className="lagoon-cal-dot"
                    style={{ background: toneDotVar(task, metaTick), width: 8, height: 8 }}
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
                    <span style={{ fontSize: 10, color: "var(--lagoon-muted-fg)" }}>
                      {name ?? "Unassigned"} · {projectLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
