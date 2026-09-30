/* Lagoon boards dashboard — joyful overview ported from
   treloo-joyful-design's dashboard route, computed from the real
   projects/tasks API: per-board progress, due dates, workspace stats. */

"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LagoonShell, useLagoonChrome } from "@/components/lagoon/LagoonShell";
import { IconLayers, IconPlus, IconSearch } from "@/components/icons";
import { api, getCurrentTenantId, type Project, type Task, type Team } from "@/lib/api";
import { useTenant } from "@/components/store";
import { useSWR } from "@/lib/swr";
import { motion, PageEnter, contentFade } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { toYmd, todayYmd } from "@/components/lagoon/lagoon-utils";

const BOARD_TONES = ["teal", "coral", "ocean"] as const;

function LagoonDashboard() {
  const router = useRouter();
  const { org } = useTenant();
  const { openNewBoard } = useLagoonChrome();
  const orgId = getCurrentTenantId();
  const [search, setSearch] = useState("");

  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `dash-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const teamsQ = useSWR<{ teams: Team[] }>(
    orgId ? `dash-teams-${orgId}` : null,
    () => api.teams.list(orgId!),
  );
  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  const teams = useMemo(() => teamsQ.data?.teams ?? [], [teamsQ.data]);
  const teamName = useMemo(() => {
    const map = new Map(teams.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? (map.get(id) ?? null) : null);
  }, [teams]);

  // Task counts per board — parallel fetches, keyed by project ids.
  const taskPagesQ = useSWR<Task[][]>(
    orgId && projects.length > 0 ? `dash-tasks-${orgId}-${projects.map((p) => p.id).join(",")}` : null,
    async () => {
      const pages = await Promise.all(projects.map((p) => api.tasks.list(orgId!, p.id, { limit: 100 })));
      return pages.map((page) => page.data);
    },
  );

  const today = todayYmd();

  const boards = useMemo(
    () =>
      projects.map((p, i) => {
        const tasks = taskPagesQ.data?.[i] ?? [];
        const active = tasks.filter((t) => t.status !== "done").length;
        const done = tasks.length - active;
        const progress = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
        const upcoming = tasks
          .filter((t) => t.status !== "done" && (toYmd(t.dueAt) ?? "") >= today)
          .map((t) => toYmd(t.dueAt) as string)
          .sort()[0];
        const dueLabel = upcoming
          ? new Date(`${upcoming}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : null;
        return {
          project: p,
          tasks: tasks.length,
          active,
          progress,
          dueLabel,
          team: teamName(p.teamId),
          tone: BOARD_TONES[i % BOARD_TONES.length] ?? "teal",
        };
      }),
    [projects, taskPagesQ.data, teamName, today],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter(
      (b) =>
        b.project.name.toLowerCase().includes(q) ||
        b.project.key.toLowerCase().includes(q) ||
        (b.team ?? "").toLowerCase().includes(q),
    );
  }, [boards, search]);

  const activeTasks = boards.reduce((sum, b) => sum + b.active, 0);

  return (
    <LagoonShell
      projects={projects}
      activeProjectId=""
      onSelectProject={(id) => router.push(`/app/board?project=${id}`)}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      <div className="lagoon-dash" style={{ overflowY: "auto" }}>
        <div className="lagoon-dash-inner">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              borderBottom: "1px solid var(--lagoon-border)",
              paddingBottom: 32,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--lagoon-teal)" }}>
                  <IconLayers size={14} /> {org?.name ?? "Workspace"}
                </div>
                <h1 className="lagoon-display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  Boards
                </h1>
                <p style={{ marginTop: 8, maxWidth: 560, fontSize: 14, color: "var(--lagoon-muted-fg)" }}>
                  {boards.length === 0
                    ? "Create a board to start tracking work."
                    : `${boards.length} ${boards.length === 1 ? "board" : "boards"} · ${activeTasks} active ${activeTasks === 1 ? "task" : "tasks"}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button size="sm" className="lagoon-create-btn border-0" onClick={openNewBoard}>
                  <IconPlus size={14} /> New board
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 12, color: "var(--lagoon-muted-fg)", flexWrap: "wrap" }}>
              <InputGroup variant="search" className="lagoon-search" style={{ width: 280 }}>
                <InputGroupAddon align="inline-start">
                  <IconSearch size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Search boards"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search boards…"
                />
              </InputGroup>
            </div>
          </div>

          {projectsQ.isLoading ? (
            <section aria-label="Loading boards" role="status" style={{ display: "grid", gap: 16, paddingTop: 32, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skeleton className="h-52 w-full rounded-xl" />
                </div>
              ))}
            </section>
          ) : filtered.length === 0 ? (
            <PageEnter className="lagoon-empty" style={{ marginTop: 32 }}>
              <h3 className="lagoon-display" style={{ fontSize: 16, fontWeight: 600 }}>
                {search ? "No boards match" : "No boards yet"}
              </h3>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>
                {search ? "Try a different search term." : "Create your first board to get started."}
              </p>
              {!search ? (
                <Button size="sm" className="lagoon-create-btn border-0" style={{ marginTop: 16 }} onClick={openNewBoard}>
                  <IconPlus size={14} /> New board
                </Button>
              ) : null}
            </PageEnter>
          ) : (
            <motion.div variants={contentFade} initial="hidden" animate="show">
              <section aria-label="All boards" style={{ display: "grid", gap: 16, paddingTop: 32, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {filtered.map((b) => (
                  <Link
                    key={b.project.id}
                    href={`/app/board?project=${b.project.id}`}
                    className="lagoon-board-card"
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 9999, background: `var(--lagoon-${b.tone})` }} />
                      <span style={{ fontSize: 11, color: "var(--lagoon-muted-fg)" }}>
                        {b.team ?? b.project.key}
                      </span>
                    </div>
                    <h2 className="lagoon-display" style={{ marginTop: 20, fontSize: 20, fontWeight: 600 }}>{b.project.name}</h2>
                    <p style={{ marginTop: 8, minHeight: 40, fontSize: 12, lineHeight: 1.6, color: "var(--lagoon-muted-fg)" }}>
                      {b.team ? `${b.team} · ` : ""}{b.project.key} board — {b.active} open, {b.tasks - b.active} done.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20, fontSize: 11, color: "var(--lagoon-muted-fg)" }}>
                      <span className="tabular-nums">{b.tasks} tasks</span>
                      <span className="tabular-nums">{b.active} active</span>
                      <span>{b.dueLabel ? `Due ${b.dueLabel}` : "No due dates"}</span>
                    </div>
                    <div className="lagoon-progress" style={{ marginTop: 16 }}>
                      <div style={{ height: "100%", borderRadius: 9999, background: `var(--lagoon-${b.tone})`, width: `${b.progress}%` }} />
                    </div>
                  </Link>
                ))}
              </section>
            </motion.div>
          )}
        </div>
      </div>
    </LagoonShell>
  );
}

export default function ProjectsPageWrapper() {
  return (
    <Suspense fallback={<div className="lagoon" style={{ padding: 24 }} role="status" aria-label="Loading boards"><Skeleton className="h-6 w-40 rounded" /><div style={{ display: "grid", gap: 16, marginTop: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }} aria-hidden><Skeleton className="h-52 w-full rounded-xl" /><Skeleton className="h-52 w-full rounded-xl" /><Skeleton className="h-52 w-full rounded-xl" /></div></div>}>
      <LagoonDashboard />
    </Suspense>
  );
}
