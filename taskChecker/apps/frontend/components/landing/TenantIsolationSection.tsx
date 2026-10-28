"use client";

import { AlertTriangle, Check, Database, ShieldCheck, X } from "lucide-react";
import styles from "./landing.module.css";

export function TenantIsolationSection() {
  return (
    <section
      id="tenant-security"
      aria-labelledby="security-heading"
      className={`${styles.sectionRoot} relative border-t border-white/[0.06] bg-black py-24 sm:py-32`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className={`${styles.reveal} grid gap-6 lg:grid-cols-12 lg:items-end`}>
          <h2 id="security-heading" className={`${styles.displayHeading} text-white lg:col-span-7`}>
            Tenant isolation is the architecture, not a setting.
          </h2>

          <p className={`${styles.lede} max-w-xl text-pretty text-zinc-400 lg:col-span-5 lg:justify-self-end`}>
            Traditional SaaS relies on engineers remembering to write a tenant filter. TeamFlow
            keys every row to its organization and enforces the boundary in Postgres itself.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-5 lg:mt-16 lg:grid-cols-2 lg:gap-6">
          <div
            className={`${styles.reveal} rounded-xl border border-white/[0.07] bg-white/[0.015] p-6 sm:p-8`}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
                  <AlertTriangle className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className={`${styles.panelTitle} text-white`}>Filter-only isolation</h3>
                  <p className="mt-0.5 text-xs text-zinc-500">The common failure mode</p>
                </div>
              </div>
              <span className={`${styles.monoData} hidden rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 font-medium text-red-300 sm:inline-block`}>
                Fragile by default
              </span>
            </div>

            <p className="mt-6 text-[15px] leading-7 text-zinc-400">
              If one endpoint, join, or ORM call forgets the tenant clause, another customer&apos;s
              work can appear in the result set. The boundary depends on code review catching every
              omission.
            </p>

            <div className="mt-6 rounded-lg border border-red-500/15 bg-black/40 p-4">
              <div className="font-mono text-xs leading-6 text-zinc-500">
                {"// Ad-hoc query without tenant scope"}
              </div>
              <div className="mt-1.5 break-words font-mono text-xs leading-6 text-red-300">
                SELECT * FROM tasks WHERE status = &apos;in_progress&apos;;
              </div>
              <div className="mt-2 flex items-start gap-2 font-mono text-xs text-red-400/90">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="leading-5">Missing tenant_id — rows can cross organizations.</span>
              </div>
            </div>

            <ul className="mt-6 space-y-3 text-[15px] leading-7 text-zinc-400">
              <li className="flex items-start gap-2.5">
                <X className="mt-1 size-4 shrink-0 text-red-400" aria-hidden="true" />
                <span>Every endpoint has to remember the tenant clause.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-1 size-4 shrink-0 text-red-400" aria-hidden="true" />
                <span>A missing join silently widens the result set.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <X className="mt-1 size-4 shrink-0 text-red-400" aria-hidden="true" />
                <span>Isolation depends on review discipline staying perfect.</span>
              </li>
            </ul>
          </div>

          <div
            className={`${styles.reveal} relative overflow-hidden rounded-xl border border-[#c693fd]/20 bg-[#0e0a13] p-6 shadow-[0_40px_100px_-56px_rgba(147,51,234,0.6)] sm:p-8`}
            data-reveal="1"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,_rgba(198,147,253,0.10),_transparent_70%)]"
            />

            <div className="relative flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#c693fd]/30 bg-[#c693fd]/10 text-[#d8b4fe]">
                  <Database className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className={`${styles.panelTitle} text-white`}>Two-layer enforcement</h3>
                  <p className="mt-0.5 text-xs text-purple-300/80">How TeamFlow is built</p>
                </div>
              </div>
              <span className={`${styles.monoData} hidden items-center gap-1.5 rounded-md border border-[#c693fd]/25 bg-[#c693fd]/10 px-2 py-1 font-medium text-purple-200 sm:inline-flex`}>
                <ShieldCheck className="size-3" aria-hidden="true" />
                Postgres RLS
              </span>
            </div>

            <p className="relative mt-6 text-[15px] leading-7 text-zinc-300">
              Every request runs inside a verified tenant context. Postgres row-level security then
              turns an omitted filter into a database failure instead of a leak.
            </p>

            <div className="relative mt-6 rounded-lg border border-[#c693fd]/20 bg-black/50 p-4">
              <div className="font-mono text-xs leading-6 text-zinc-500">
                {"// Verified principal context"}
              </div>
              <div className="mt-1.5 font-mono text-xs leading-6 text-purple-200">
                withTenant(principal.orgId, async (db) =&gt; &#123;
              </div>
              <div className="break-words pl-4 font-mono text-xs leading-6 text-zinc-500">
                {"// RLS rejects any row outside the tenant"}
              </div>
              <div className="break-words pl-4 font-mono text-xs leading-6 text-emerald-300">
                await db.query(&apos;SELECT * FROM tasks WHERE ...&apos;)
              </div>
              <div className="font-mono text-xs leading-6 text-purple-200">&#125;)</div>
            </div>

            <ul className="relative mt-6 space-y-3 text-[15px] leading-7 text-zinc-300">
              <li className="flex items-start gap-2.5">
                <Check className="mt-1 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-white">Tenant ID in primary and foreign keys.</strong>{" "}
                  Referential isolation by construction.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="mt-1 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-white">Postgres RLS at the database engine.</strong>{" "}
                  A missing filter fails closed.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="mt-1 size-4 shrink-0 text-emerald-400" aria-hidden="true" />
                <span>
                  <strong className="font-medium text-white">Every mutation recorded.</strong> Actor,
                  action, tenant, and timestamp stay in the audit trail.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TenantIsolationSection;
