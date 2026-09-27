# Deferred migration plans (audit P2)

## zod 3 → 4

- Inventory: `zod@^3.25.0` in `apps/backend`; v3 idioms in use: only
  `z.string().email()` (2 files: `modules/auth.ts`, `modules/orgs.ts`) plus
  `z.object/safeParse/enum/min/max/optional/uuid` throughout.
- Plan: `pnpm add zod@4` in a branch, codemod `z.string().email()` →
  `z.email()`, then `check-types` + `bun test`. Watch: `error.issues[0]`
  shape and custom `invalid_type_error` params changed in v4 — grep for
  `issues[` and `invalid_type` before flipping.
- Gate: backend `lint` + full unit suite + `TEAMFLOW_IT=1` integration green.

## framer-motion → `motion` rename

- Inventory: `framer-motion@^13.4.0` in `apps/frontend`, imported in exactly
  2 files (`app/providers.tsx`: `MotionConfig`; `components/motion.tsx`:
  re-export shim). The `wip-motion-board` stash (AnimatePresence board work)
  was dropped as superseded — do not reintroduce it; Part-4 motion is one
  orchestrated card-drop moment, not per-card entrances.
- Plan: `pnpm add motion` / remove `framer-motion`, rewrite the 2 imports
  (`from "framer-motion"` → `from "motion/react"`), verify the board drop
  + chat slide-in against `tokens.css` (`--ease-settle`), keep
  `prefers-reduced-motion` behavior. `components/motion.tsx` stays the single
  import seam so the next rename touches one file.
- Gate: `pnpm run lint` (React Compiler memoization warnings are the canary),
  `check-types`, manual keyboard-DnD + reduced-motion pass.
