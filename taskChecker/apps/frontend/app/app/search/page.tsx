"use client";

import { Suspense, useState, useCallback, useMemo, memo, useEffect, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { LagoonShell } from "@/components/lagoon/LagoonShell";
import { useTenant } from "@/components/store";
import { IconSearch, IconFile, IconMessageSquare, IconFolder, IconPlus, IconUser } from "@/components/icons";
import { api, getCurrentTenantId, type Project, type SearchResult } from "@/lib/api";
import { useSWR } from "@/lib/swr";
import { cx } from "@/lib/utils";
import { reportError } from "@/lib/report";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { motion, PageEnter, contentFade } from "@/components/motion";

const RESULT_TYPES = [
  { value: "all", label: "All", icon: IconSearch },
  { value: "task", label: "Tasks", icon: IconFile },
  { value: "comment", label: "Comments", icon: IconMessageSquare },
] as const;

const SearchResultItem = memo(function SearchResultItem({
  result,
  query,
  authorName,
}: {
  result: SearchResult;
  query: string;
  authorName?: string | null;
}) {
  const highlight = (text: string) => {
    if (!query) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i}>{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  if (result.type === "task") {
    return (
      <Link href={`/app/tasks/${result.id}`} className="search-result task-result">
        <div className="result-header">
          <span className="result-type task">Task</span>
          <span className="result-id">{result.id?.slice(0, 8)}</span>
        </div>
        <h4 className="result-title">{highlight(result.title ?? "")}</h4>
        <div className="result-meta">
          {result.status && <span className="result-status">{result.status}</span>}
          {result.projectId && <span className="result-project">{result.projectId.slice(0, 8)}</span>}
        </div>
        {result.snippet && <p className="result-snippet">{highlight(result.snippet)}</p>}
      </Link>
    );
  }

  return (
    <Link href={`/app/tasks/${result.taskId}`} className="search-result comment-result">
      <div className="result-header">
        <span className="result-type comment">Comment</span>
        <span className="result-id">{result.id?.slice(0, 8)}</span>
      </div>
      <p className="result-comment-body">{highlight(result.snippet ?? "")}</p>
      <div className="result-meta">
        {result.taskId && <span className="result-task">Task: {result.taskId.slice(0, 8)}</span>}
        {authorName ? <span className="result-author">By: {authorName}</span> : null}
      </div>
    </Link>
  );
});

function SearchPageContent() {
  const { org } = useTenant();
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgId = getCurrentTenantId();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState((searchParams.get("type") as "all" | "task" | "comment") ?? "all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const membersQ = useSWR<{ members: Array<{ userId: string; name: string | null; email?: string | null }> }>(
    orgId ? `search-members-${orgId}` : null,
    () => api.orgs.listMembers(orgId!),
  );
  const projectsQ = useSWR<{ projects: Project[] }>(
    orgId ? `search-projects-${orgId}` : null,
    () => api.projects.list(orgId!),
  );
  const nameById = useMemo(
    () => new Map((membersQ.data?.members ?? []).map((m) => [m.userId, m.name ?? null])),
    [membersQ.data]
  );
  const projects = useMemo(() => projectsQ.data?.projects ?? [], [projectsQ.data]);
  const members = useMemo(() => membersQ.data?.members ?? [], [membersQ.data]);

  const performSearch = useCallback(async () => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    if (!orgId) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.search.query(query, type, 50);
      setResults(res.results);
      // Update URL without navigation
      const params = new URLSearchParams();
      params.set("q", query);
      if (type !== "all") params.set("type", type);
      router.replace(`/app/search?${params.toString()}`, { scroll: false });
    } catch (err) {
      reportError(err, "search:query", { query });
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, type, orgId, router]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      void performSearch();
    }, 200);
    return () => clearTimeout(timer);
  }, [performSearch]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    startTransition(() => setQuery(e.target.value));
  };

  const handleTypeChange = (value: "all" | "task" | "comment") => {
    startTransition(() => setType(value));
  };

  const q = query.trim().toLowerCase();
  const projectHits = useMemo(
    () =>
      q.length >= 2
        ? projects
            .filter((p) => `${p.name} ${p.key}`.toLowerCase().includes(q))
            .slice(0, 5)
        : [],
    [projects, q],
  );
  const peopleHits = useMemo(
    () =>
      q.length >= 2
        ? members
            .filter((m) => `${m.name ?? ""} ${m.email ?? ""}`.toLowerCase().includes(q))
            .slice(0, 5)
        : [],
    [members, q],
  );
  const taskResults = useMemo(() => results.filter((r) => r.type === "task"), [results]);
  const commentResults = useMemo(() => results.filter((r) => r.type === "comment"), [results]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    router.replace("/app/search", { scroll: false });
  }, [router]);

  return (
    <LagoonShell
      projects={projects}
      activeProjectId=""
      onSelectProject={(id) => router.push(`/app/board?project=${id}`)}
      onProjectsChanged={() => projectsQ.mutate()}
    >
      <div className="lagoon-dash" style={{ overflowY: "auto" }}>
        <div className="lagoon-dash-inner">
          <PageEnter className="page search-page">
            <header className="page-header">
              <div>
                <h1 className="page-title">Search</h1>
                <p className="page-subtitle">Find projects, tasks, people and comments in {org?.name ?? "your organization"}</p>
              </div>
            </header>

            <div className="search-container">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void performSearch();
                }}
              >
                <Field orientation="horizontal">
                  <Input
                    type="search"
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="Search projects, tasks, people… (minimum 2 characters)"
                    autoFocus
                    aria-label="Search projects, tasks and people"
                  />
                  <Button type="submit" disabled={loading} loading={loading}>
                    <IconSearch size={14} /> Search
                  </Button>
                </Field>
              </form>

              <div className="filter-tabs search-filters" role="group" aria-label="Result type">
                {RESULT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    className={cx("filter-tab", type === t.value && "active")}
                    aria-pressed={type === t.value}
                    onClick={() => handleTypeChange(t.value as "all" | "task" | "comment")}
                  >
                    <t.icon size={14} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="search-results">
                {loading ? (
                  <div className="flex flex-col gap-3" role="status" aria-label="Searching">
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                ) : hasSearched ? (
                  results.length === 0 && projectHits.length === 0 && peopleHits.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <IconSearch size={16} />
                        </EmptyMedia>
                        <EmptyTitle>No results for &ldquo;{query}&rdquo;</EmptyTitle>
                        <EmptyDescription>
                          Search covers project names, task titles and descriptions, people and comments
                          in this workspace. Try a shorter term or a different filter.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <div className="flex items-center gap-2">
                          <Button variant="secondary" size="sm" onClick={clearSearch}>
                            Clear search
                          </Button>
                          <Button size="sm" onClick={() => router.push("/app/board")}>
                            <IconPlus size={14} /> New task
                          </Button>
                        </div>
                      </EmptyContent>
                    </Empty>
                  ) : (
                    <motion.div variants={contentFade} initial="hidden" animate="show" className="results-list">
                      <p className="results-count">
                        {results.length + projectHits.length + peopleHits.length} result
                        {results.length + projectHits.length + peopleHits.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
                      </p>

                      {projectHits.length > 0 ? (
                        <section aria-label="Projects" style={{ marginBottom: 16 }}>
                          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--lagoon-muted-fg)", marginBottom: 8 }}>
                            Projects
                          </h3>
                          <div className="flex flex-col gap-2">
                            {projectHits.map((p) => (
                              <Link key={p.id} href={`/app/board?project=${p.id}`} className="search-result task-result">
                                <div className="result-header">
                                  <span className="result-type task">
                                    <IconFolder size={12} /> Project
                                  </span>
                                  <span className="result-id mono">{p.key}</span>
                                </div>
                                <h4 className="result-title">{p.name}</h4>
                                <div className="result-meta">
                                  <span className="result-project">Open board →</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {taskResults.length > 0 ? (
                        <section aria-label="Tasks" style={{ marginBottom: 16 }}>
                          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--lagoon-muted-fg)", marginBottom: 8 }}>
                            Tasks
                          </h3>
                          <div className="flex flex-col gap-2">
                            {taskResults.map((result) => (
                              <SearchResultItem
                                key={result.id}
                                result={result}
                                query={query}
                                authorName={result.authorId ? nameById.get(result.authorId) ?? undefined : undefined}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {peopleHits.length > 0 ? (
                        <section aria-label="People" style={{ marginBottom: 16 }}>
                          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--lagoon-muted-fg)", marginBottom: 8 }}>
                            People
                          </h3>
                          <div className="flex flex-col gap-2">
                            {peopleHits.map((m) => (
                              <Link key={m.userId} href="/app/settings/members" className="search-result task-result">
                                <div className="result-header">
                                  <span className="result-type task">
                                    <IconUser size={12} /> Person
                                  </span>
                                </div>
                                <h4 className="result-title">{m.name ?? m.email ?? m.userId.slice(0, 8)}</h4>
                                {m.email ? (
                                  <div className="result-meta">
                                    <span className="result-project">{m.email}</span>
                                  </div>
                                ) : null}
                              </Link>
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {commentResults.length > 0 && (type === "all" || type === "comment") ? (
                        <section aria-label="Comments" style={{ marginBottom: 16 }}>
                          <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--lagoon-muted-fg)", marginBottom: 8 }}>
                            Comments
                          </h3>
                          <div className="flex flex-col gap-2">
                            {commentResults.map((result) => (
                              <SearchResultItem
                                key={result.id}
                                result={result}
                                query={query}
                                authorName={result.authorId ? nameById.get(result.authorId) ?? undefined : undefined}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null}

                      <p style={{ fontSize: 12, color: "var(--lagoon-muted-fg)" }}>
                        Also browse the <Link href={`/app/library?q=${encodeURIComponent(query)}`} style={{ textDecoration: "underline" }}>library</Link> for
                        collections and starred resources.
                      </p>
                    </motion.div>
                  )
                ) : (
                  <div className="search-hints">
                    <h3>Search tips</h3>
                    <ul>
                      <li>Use quotes for exact phrases: <code>&quot;design review&quot;</code></li>
                      <li>Prefix with <code>title:</code> to search only titles</li>
                      <li>Prefix with <code>body:</code> to search only descriptions</li>
                      <li>Use <code>status:done</code> to filter by status</li>
                      <li>Combine terms: <code>bug status:todo</code></li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </PageEnter>
        </div>
      </div>
    </LagoonShell>
  );
}
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}
