// "use client"; // usage page commented out
// usage page disabled — uncomment to re-enable
"use client";

import { AppShell } from "@/components/app-shell";

export default function UsagePage() {
  // // usage commented out — page returns placeholder
  // const { org } = useTenant();
  // const orgId = org?.id ?? getCurrentTenantId();
  // const plan = (org?.plan as Plan) ?? "free";
  // ... entire usage logic commented out ...
  return (
    <AppShell>
      <div className="page settings-page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Usage</h1>
            <p className="page-subtitle">Usage tracking is currently disabled.</p>
          </div>
        </header>
        <div className="settings-content">
          <section className="settings-section">
            <h2>Current usage</h2>
            <p style={{ color: "var(--slate-500)" }}>Usage metering is commented out. Re-enable in <code>apps/backend/src/lib/usage.ts</code> and <code>apps/frontend/app/app/settings/usage/page.tsx</code>.</p>
          </section>
        </div>
      </div>
    </AppShell>
  );
  // original implementation commented out below for easy restore:
  // const { org } = useTenant();
  // const orgId = org?.id ?? getCurrentTenantId();
  // const plan = (org?.plan as Plan) ?? "free";
  // const catalog = PLAN_CATALOG[plan] ?? PLAN_CATALOG.free;
  // const limits = catalog.limits;
  // const usageQ = useSWR<{ plan: string; limits: Record<string, number>; month: Record<string, number> }>(
  //   orgId ? `usage-${orgId}` : null,
  //   () => api.usage.get(),
  // );
  // const usage = usageQ.data?.month ?? {};
  // const currentMembersQ = useSWR<{ members: Array<{ userId: string; status: string }> }>(
  //   orgId ? `usage-members-${orgId}` : null,
  //   () => api.orgs.listMembers(orgId!),
  // );
  // const activeMembers = (currentMembersQ.data?.members ?? []).filter((m) => m.status === "active").length;
  // const projectsQ = useSWR<{ projects: Array<{ deletedAt: string | null }> }>(
  //   orgId ? `usage-projects-${orgId}` : null,
  //   () => api.projects.list(orgId!),
  // );
  // const activeProjects = (projectsQ.data?.projects ?? []).filter((p) => !p.deletedAt).length;
  // const metrics = [
  //   { key: "seats", used: activeMembers, limit: limits.seats!, label: "Seats", icon: IconUsers },
  //   { key: "activeProjects", used: activeProjects, limit: limits.activeProjects!, label: "Active projects", icon: IconFolder },
  //   { key: "apiCallsPerDay", used: usage.api_calls ?? 0, limit: limits.apiCallsPerDay!, label: "API calls (today)", icon: IconZap },
  // ];
  // return ( <AppShell> ... </AppShell> );
}