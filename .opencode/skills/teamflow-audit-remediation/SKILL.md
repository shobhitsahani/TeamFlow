---
name: teamflow-audit-remediation
description: Use this skill whenever working on the TeamFlow / TaskChecker repo (C:\projects\taskChecker) and asked to fix bugs, harden security, add CI, clean up ORM/Supabase duality, resolve doc drift, or improve the UI/UX. Trigger on phrases like "fix the P0s", "harden auth", "rotate the keys", "add CI", "clean up the themes", or "make the UI nicer/prettier". This skill is the work order derived from the 2026-09-25 full-project audit (branch v0/trello-ui-polish @ ba71a2f) — read it fully before making changes, and work top-down by priority unless told otherwise.
---

# TeamFlow Audit Remediation

TeamFlow is a multi-tenant Trello-like SaaS with team chat: pnpm+Bun+Turbo monorepo,
Hono backend (Postgres + RLS + Redis + BullMQ + WS realtime), Next.js/React frontend.
This skill is the fix list from the 2026-09-25 audit, ordered so the highest-risk,
highest-value work happens first. Don't reorder priorities without telling the user why.

## How to work through this

1. Work one item at a time, in order: P0 → P1 → P2.
2. Before touching code, re-read the current state of the file — the audit is a snapshot
   and things may have moved (e.g. the auth.ts diff may already be merged).
3. After each fix, run the narrowest relevant check before moving on:
   `bun test`, `bun run check-types`, `turbo run lint`, or the specific integration
   suite (`TEAMFLOW_IT=1 bun test test/integration.test.ts`).
4. Commit each logical fix on its own, with a conventional message
   (e.g. `fix(auth): fail-closed JWT_SECRET in production`). Don't bundle a security
   fix with a refactor.
5. Never write real secrets into a committed file — `.env` only, `.env.example` gets
   placeholders like `<your-groq-key>`.

---

## Part 1 — P0: do today

**1. Rotate committed API keys**
Files: `litellm_config.yaml` (lines 6,11,16,22,28,34), `.claude/settings.local.json`.
- Rotate the Groq, Gemini, and OpenRouter keys at their respective dashboards.
- Move all three into `.env` (backend/root, whichever `start-proxy.ps1` reads from),
  reference via env var in `litellm_config.yaml`, never a literal value.
- Check `.claude/settings.local.json`'s `ANTHROPIC_AUTH_TOKEN` too — same treatment.
- Confirm `.gitignore` covers the real `.env`, then check no usage/billing anomalies
  on the exposed keys before/after rotation.
- Optional: purge history with BFG/git-filter-repo, or explicitly accept
  rotation-only and document why.

**2. Fail-closed `JWT_SECRET`**
File: `apps/backend/src/config.ts:59`.
- Remove the `dev-only-change-me…` fallback when `NODE_ENV=production`.
- `need("JWT_SECRET")` should throw at startup if unset, and validate length ≥32
  chars with real entropy (not `aaaa...`).
- Keep a fallback allowed only outside production, and log a loud warning when it's used.

**3. Merge the auth DB-down fix**
File: `apps/backend/src/modules/auth.ts:109-198` (uncommitted diff already exists).
- Land it as its own commit with a clear security-fix message.
- The sandbox/fallback path (issuing JWTs when the DB is down) must be gated behind
  an explicit `ALLOW_AUTH_FALLBACK=true` env var, and must never be settable in
  production (assert this at startup, don't just rely on the env file being right).
- Add a regression test: DB down → login/signup returns 503, never a valid token.

---

## Part 2 — P1: within 30 days

- **CI pipeline** (currently none — no `.github/workflows`): run on every PR —
  `check-types`, `eslint --max-warnings 0`, `bun test`, `TEAMFLOW_IT=1` integration
  suite, `pnpm audit`, and a secret scanner (Gitleaks). Block merge on red.
- **Backend has zero ESLint** — add a flat config (reuse `packages/eslint-config/base.js`)
  and a `lint` script. On the frontend, replace the global `only-warn` demotion
  (or at least run `eslint . --max-warnings 0` in CI) so real errors can't hide as warnings.
- **Structured logging**: replace the 34 ad-hoc `console.*` calls with pino (or similar),
  JSON output + request-id in prod. Wire a minimal Sentry (or equivalent) hook for
  frontend `console.error` sites in realtime/audit/search. Add `/healthz` and `/readyz`
  with 2–3 starter alerts.
- **Security headers / CORS / cookies**: add a helmet-equivalent middleware, an explicit
  CORS allowlist, and audit cookie flags (`HttpOnly`, `Secure`, `SameSite`). Add
  per-channel WS authz tests so one org's socket truly cannot read another's channel.
- **Single source of truth for scale + auth model**: the design docs disagree on
  DAU/QPS (2.5k vs 10k vs 30k vs 50k) — pick one baseline (the `requirements.md`
  numbers are the sanest MVP target) and mark the others "future". Update
  `data-model.md`'s `app.current_user_id + organization_id` references to the
  actually-built `app.tenant_id`.
- **Kill the ORM/Supabase duality**: keep Drizzle (migrations are already Drizzle-led),
  remove `prisma` deps/scripts, and either commit to the Supabase local stack
  (add `supabase/migrations`, `seed.sql`, enable the pooler) or delete `supabase/`
  entirely. Don't leave both half-configured.
- **Resolve `apps/web`**: it's an orphan stub with no `package.json`. Either finish it
  (what's it for?) or delete it. Align Turbo/TypeScript major versions across roots
  (currently 7.0.2 vs an override forcing 6.0.2) and add an explicit Prettier config.

---

## Part 3 — P2: 60–90 days / polish

- OpenAPI spec at `/v1/openapi.json` + API versioning proof.
- Incident runbooks + backup/DR drill evidence (RPO/RTO).
- k6 load-test baseline + an EXPLAIN/index audit on the hot query paths.
- Renovate/Dependabot + `pnpm audit` gate + a basic SBOM.
- Plan the zod 3→4 and framer-motion→`motion` rename migrations.
- Git hygiene: add `.gitattributes` (`* text=auto` — two files are showing LF/CRLF
  warnings), land or drop the `wip-motion-board` stash, turn on branch protection
  once CI exists.

---

## Part 4 — UI/UX direction ("make it nicer")

The current frontend works but reads as five overlapping theme files
(`globals.css`, `theme.css`, `trello.css`, `lagoon.css`, `home.css`, ~7.3k lines
total) rather than one considered design. The fix isn't "add polish," it's
"replace five ad-hoc stylesheets with one small token system," then apply it.

**Don't reach for the generic defaults**: no warm-cream-background-plus-terracotta,
no identical rounded SaaS cards with the same soft grey shadow on everything, no
ALL-CAPS section labels, no gradient-wash decoration. Those read as templated.

**Direction grounded in what this actually is** (a tactile task board + a live
team chat, not a generic dashboard):

- **Color** — one dark-ish base, one warm accent used sparingly for the single
  primary action per screen (not every button), and desaturated semantic colors
  for priority/status that carry meaning rather than decorate. Concretely:
  `--bg: #14171f`, `--surface: #1c202b`, `--surface-2: #242938`, `--line: #333a4d`,
  `--text: #e7e9ee`, `--muted: #9096a8`, `--accent: #e8935a` (warm amber-orange,
  used only for the primary CTA and active states), plus quiet status colors
  (`--danger:#e56767`, `--warn:#d9a441`, `--ok:#5fb787`) reserved for priority
  stripes and status dots, never for decoration.
- **Type** — one workhorse UI sans (keep Inter, it's already in the stack) for
  everything, with a disciplined scale (e.g. 13/15/18/24/32px) instead of ad-hoc
  sizes across five files. Don't add a second display face just for headings —
  weight and spacing carry hierarchy instead.
- **Cards** — encode priority/status as a 3px left border stripe using the
  semantic colors above, not a colored pill on every card. Give the dragged card
  a slightly deeper shadow and a 2° rotation while lifted, and let it "settle"
  with a short, single easing curve on drop — one deliberate motion moment
  instead of hover-transitions on everything.
- **Chat rail** — dock it as a fixed-width panel, not a modal; unread state as
  a small dot, not a badge count that reflows layout; timestamps small and
  `--muted`, never competing with message text; consistent per-user avatar-initial
  colors derived from user id (a small hash → hue function), so people are
  recognizable at a glance without needing to read the name every time.
- **Motion** — pick one orchestrated moment (e.g. the card drop, or a new-message
  slide-in on the chat rail) and do it well; skip fade-and-slide-up entrances on
  every card and section, which is the most common AI-generated tell. Respect
  `prefers-reduced-motion` globally.
- **Accessibility** (also closes audit finding F-12): verify contrast on the
  trello/lagoon themes against the new tokens, visible `:focus-visible` rings on
  every interactive element, a keyboard-operable alternative to drag-and-drop on
  the board, and live-regions for new chat messages/notifications so screen
  readers announce them.

**Implementation approach**: build the token set as CSS custom properties in one
file, delete the other four, and migrate components incrementally (board first,
since it's the highest-traffic screen, then chat rail, then settings). Take
screenshots after each screen migrates and compare against the token sheet
before moving to the next — catches drift early instead of at the end.

---

## Definition of done

- [ ] All 3 P0 items fixed, committed separately, keys confirmed rotated.
- [ ] CI green on a fresh PR (types + lint + tests + integration + audit + secret scan).
- [ ] Backend has a working `lint` script; frontend lint has no warning-suppression.
- [ ] One ORM, one data-source-of-truth for Postgres (Supabase or compose, not both).
- [ ] Design docs agree with each other and with the built `app.tenant_id` model.
- [ ] Five theme CSS files reduced to one token file; board + chat rail migrated.
