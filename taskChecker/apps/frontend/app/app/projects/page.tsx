/* Lagoon projects — workspace project directory backed by the real
   projects/tasks API: per-project task counts, due dates, team names.
   Each row deep-links to its kanban at /app/board?project=. */

"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LagoonShell, useLagoonChrome } from "@/components/lagoon/LagoonShell";
import { IconChevronRight, IconLayers, IconPlus, IconSearch } from "@/components/icons";
import { api, getCurrentTenantId, type Project, type Task, type Team } from "@/lib/api";
import { useTenant } from "@/components/store";
import { useSWR } from "@/lib/swr";
import { motion, PageEnter, contentFade } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { toYmd, todayYmd } from "@/components/lagoon/lagoon-utils";

function LagoonProjects() {
  const router = useRouter();
  const { org } = useTenant();
  const { openNewBoard } = useLagoonChrome();
  const orgId = getCurrentTenantId();
  const [search, setSearch] = useState("");

  const projectsQ = useSWR<{ projects: Project[]; quota?: { plan: string; used: number; limit: number } }>(
    orgId ? `dash-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const teamsQ = useSWR<{ teams: Team[] }>(
    orgId ? `dash-teams-${orgId}` : null,
    () => api.teams.list(orgId!),
  );
  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  const quota = projectsQ.data?.quota;
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

  const rows = useMemo(
    () =>
      projects.map((p, i) => {
        const tasks = taskPagesQ.data?.[i] ?? [];
        const active = tasks.filter((t) => t.status !== "done").length;
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
          dueLabel,
          team: teamName(p.teamId),
        };
      }),
    [projects, taskPagesQ.data, teamName, today],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (b) =>
        b.project.name.toLowerCase().includes(q) ||
        b.project.key.toLowerCase().includes(q) ||
        (b.team ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const activeTasks = rows.reduce((sum, b) => sum + b.active, 0);

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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--lagoon-gold)" }}>
                  <IconLayers size={14} /> {org?.name ?? "Workspace"}
                </div>
                <h1 className="lagoon-display" style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  Projects
                </h1>
                <p style={{ marginTop: 8, maxWidth: 560, fontSize: 14, color: "var(--lagoon-muted-fg)" }}>
                  {rows.length === 0
                    ? "Create a project to start tracking work."
                    : `${rows.length} ${rows.length === 1 ? "project" : "projects"} · ${activeTasks} active ${activeTasks === 1 ? "task" : "tasks"}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button size="sm" className="lagoon-create-btn border-0" onClick={openNewBoard}>
                  <IconPlus size={14} /> New project
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 12, color: "var(--lagoon-muted-fg)", flexWrap: "wrap" }}>
              <InputGroup variant="search" className="lagoon-search" style={{ width: 280 }}>
                <InputGroupAddon align="inline-start">
                  <IconSearch size={14} />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  aria-label="Search projects"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search projects…"
                />
              </InputGroup>
              {quota ? (
                <span className="tabular-nums" style={{ marginLeft: "auto" }} title={`${quota.plan} plan project usage`}>
                  {quota.used} of {quota.limit} {quota.plan} projects
                </span>
              ) : null}
            </div>
          </div>

          {projectsQ.isLoading ? (
            <section aria-label="Loading projects" role="status" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 32 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ))}
            </section>
          ) : filtered.length === 0 ? (
            <PageEnter className="lagoon-empty" style={{ marginTop: 32 }}>
              <h3 className="lagoon-display" style={{ fontSize: 16, fontWeight: 600 }}>
                {search ? "No projects match" : "No projects yet"}
              </h3>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--lagoon-muted-fg)" }}>
                {search ? "Try a different search term." : "Create your first project to get started."}
              </p>
              {!search ? (
                <Button size="sm" className="lagoon-create-btn border-0" style={{ marginTop: 16 }} onClick={openNewBoard}>
                  <IconPlus size={14} /> New project
                </Button>
              ) : null}
            </PageEnter>
          ) : (
            <motion.div variants={contentFade} initial="hidden" animate="show">
              <section aria-label="All projects" style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 32 }}>
                {filtered.map((b) => (
                  <Link
                    key={b.project.id}
                    href={`/app/board?project=${b.project.id}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: "16px 20px",
                      borderRadius: 12,
                      border: "1px solid var(--lagoon-border)",
                      background: "var(--lagoon-card)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <h2 className="lagoon-display" style={{ fontSize: 17, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.project.name}</h2>
                        <span style={{ flex: "none", fontSize: 11, fontWeight: 600, color: "var(--lagoon-muted-fg)", border: "1px solid var(--lagoon-border)", borderRadius: 6, padding: "2px 6px" }}>
                          {b.project.key}
                        </span>
                      </div>
                      <p style={{ marginTop: 6, fontSize: 12, color: "var(--lagoon-muted-fg)" }}>
                        {[b.team, `${b.tasks} ${b.tasks === 1 ? "task" : "tasks"}`, `${b.active} active`, b.dueLabel ? `Due ${b.dueLabel}` : "No due dates"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <IconChevronRight size={16} style={{ flex: "none", color: "var(--lagoon-muted-fg)" }} />
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
    <Suspense fallback={<div className="lagoon" style={{ padding: 24 }} role="status" aria-label="Loading projects"><Skeleton className="h-6 w-40 rounded" /><div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }} aria-hidden><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-20 w-full rounded-xl" /><Skeleton className="h-20 w-full rounded-xl" /></div></div>}>
      <LagoonProjects />
    </Suspense>
  );
}
