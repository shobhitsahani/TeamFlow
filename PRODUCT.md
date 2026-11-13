# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Engineering teams, product managers, and high-velocity engineering organizations requiring real-time, multi-tenant collaboration with strict tenant isolation and role-based access.

## Product Purpose
"The quiet harbor for high-velocity teams" — TeamFlow provides a calm, keyboard-friendly, highly responsive project and kanban board environment backed by PostgreSQL Row Level Security (RLS) tenant isolation, scoped RBAC (owner, admin, member, viewer), realtime sync with replay, and audit logging.

## Positioning
Unlike bloated, noisy project trackers, TeamFlow couples high density and fast keyboard navigation with hard database-level tenant isolation (Postgres RLS) and deterministic realtime sync replay.

## Operating Context
Users spend their entire workday inside the board: reviewing tickets, moving cards across stages, triaging sprint backlogs, checking project progress, viewing activity streams, and chatting with team members.

## Capabilities and Constraints
- Surfaces under `/app`: `/app/board` (primary kanban), `/app/projects`, `/app/teams`, `/app/tasks/[id]`, `/app/activity`, `/app/chat`, `/app/library`, `/app/settings`, `/app/settings/members`, `/app/settings/audit`, `/app/settings/usage`, `/app/settings/profile`, `/app/settings/integrations`.
- Scoped RBAC: owner, admin, member, viewer. Viewers get clear read-only affordances (disabled state + explanatory badges/tooltips, never dead unresponsive buttons).
- Realtime sync: status indicator always visible (Connected / Replaying / Disconnected), cards pulse on remote update without full-board reflow.
- Strict isolation: protected pages (`/`, `/auth/sign-in`, `/auth/sign-up`) remain 100% untouched.

## Brand Commitments
- Name: TeamFlow
- Aesthetic: Calm, precise, quietly confident. "The quiet harbor for high-velocity teams".
- Colors: OKLCH-based Harbor Indigo / Purple accent (`oklch(0.65 0.24 300)` / `#9333ea` brand touch) on dark/light slate foundations.
- Typography: Space Grotesk display, DM Sans body, JetBrains Mono data/tabular figures.
- Mark: Fluid geometry (`logo_mark.png`).

## Product Principles
1. Calm above all: Dense but readable; minimize decorative noise, avoid cartoonish saturation or aggressive animations.
2. One clear action per view: Visual hierarchy immediately guides the eye to the primary goal on each surface.
3. Tenant and role always visible: The user always knows which organization they are operating within and what permissions they possess.
4. Never hide sync state: Realtime connection, saving state, and offline/replay status are permanently explicit and non-intrusive.
5. Instant keyboard navigation: Rapid triage via ⌘K palette, quick filters, and accessible shortcuts.

## Accessibility & Inclusion
WCAG AA compliance across contrast, keyboard navigation (focus rings, focus trap, drawer escape), screen reader labeling, and full support for `prefers-reduced-motion` and `prefers-reduced-transparency`.
