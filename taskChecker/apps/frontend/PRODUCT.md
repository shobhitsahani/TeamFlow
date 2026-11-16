# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users: team leads / PMs in B2B organizations, planning, assigning, and tracking work across teams and projects.

RBAC roles (owner | admin | member | viewer) exist as the permission model. Other roles use the product to execute tasks, but only team leads / PMs are confirmed as primary.

## Product Purpose

TeamFlow is a web-based, multi-tenant project and workflow tool where each organization's users, teams, projects, tasks, comments, attachments, and activity are isolated behind a tenant boundary, with RBAC, realtime notifications, webhooks, API access, usage controls, and a full audit trail.

Success means a lead can plan and track work for their org without ever seeing or affecting another org's data, with board reads and task mutations completing within product SLOs and derived effects (notifications, feeds, search) catching up within seconds.

## Positioning

Hard tenant isolation as a construction invariant: shared-schema Postgres with `tenant_id` in PKs and FKs, request-scoped `withTenant()` context, and Postgres RLS that turns a missing filter into a failure rather than a leak.

A neighboring Linear / Jira / Slack-style tool cannot truthfully copy this claim without the same two-layer enforcement.

## Operating Context

B2B web workflows in the browser: teams, projects, kanban boards, tasks, threaded comments, attachments via presigned blob-store URLs, activity feeds, notifications with cursor-based catch-up, full-text search, webhooks, API keys, usage metering, and audit logs.

Out of scope for v1: native mobile apps, chat, custom domains, billing engine, multi-region active-active, database silos, dedicated search cluster.

## Capabilities and Constraints

Confirmed functionality: org provisioning and invitations, RBAC enforcement on mutating and admin surfaces, teams, projects, tasks (CRUD, assignees, statuses, priorities, due dates), comments, attachments (presign + metadata), activity streams, notifications, WebSocket push with since-cursor replay, tenant-scoped full-text search, outbound webhooks with retry ledger, scoped API keys, usage metering, audit logs, soft deletion with retention purge, cursor pagination with capped limits, idempotency keys on creates.

Technical constraints: every tenant-scoped query keys on `tenant_id` from the authenticated principal, never from client input; UUIDv7 IDs; responsive web only.

Explicitly undecided: payments provider and exact tier limits; mobile push transport timing; presence / typing scope; transactional outbox hardening timing; dedicated search engine adoption timing.

## Brand Commitments

Name: TeamFlow. Product surface described in code as board covering projects, kanban, and members (chat explicitly out of scope for v1). Asset on hand: `TeamFlow logo.png` at repo root. No confirmed voice, testimonials, or additional identity constraints.

## Evidence on Hand

- `docs/design/teamflow.md` — settled v1 design, tenant isolation as load-bearing constraint.
- `docs/design/teamflow-requirements.md` — MVP scope, deferred v2 items, explicit out-of-scope list.
- `taskChecker/README.md` and `taskChecker/apps/backend/README.md` — tenant isolation model, RBAC, quickstart.
- Incumbent implementation: `taskChecker/apps/frontend/app/` (root redirects to `/app/board`), `taskChecker/apps/backend/src/` (Hono API).

Absences future work must not fabricate: no testimonials, customers, benchmarks, pricing, licensing, or deployment claims confirmed.

## Product Principles

1. Tenant isolation is an invariant, not a feature — boundary checks never degrade.
2. Correctness over scale theater — modest B2B load earns a modular monolith, not extra clusters.
3. Sync writes for what matters, async effects for what derives — stale beats error except at the boundary.
4. Every mutation and admin action carries its role check.
5. Undecided product facts stay undecided until the user decides them.
