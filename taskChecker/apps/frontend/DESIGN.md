---
name: TeamFlow
description: Quiet Harbor board — confident ops kanban for team leads, dark-first.
colors:
  primary: "oklch(0.65 0.24 300)"
  neutral-bg: "oklch(0.16 0.014 255)"
  surface: "oklch(0.205 0.017 255)"
  surface-2: "oklch(0.23 0.016 255)"
  line: "oklch(0.285 0.02 255)"
  ink: "oklch(0.95 0.008 250)"
  muted: "oklch(0.67 0.018 250)"
  gold: "oklch(0.79 0.17 76)"
  green: "oklch(0.72 0.17 160)"
  success: "oklch(0.72 0.16 153)"
  danger: "oklch(0.66 0.22 20)"
  warn: "oklch(0.79 0.17 76)"
typography:
  display:
    fontFamily: "Space Grotesk Variable, Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "DM Sans Variable, DM Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.01em"
rounded:
  sm: "2px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  chip:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.muted}"
    rounded: "4px"
    padding: "2px 6px"
---

# Design System: TeamFlow

## Overview

**Creative North Star: "The Quiet Harbor"**

TeamFlow is the dock where each org's work lands and stays put. Dense, board-first, and decisive: one primary action per screen, high-contrast controls, weight and spacing carrying hierarchy instead of decoration. Dark-first by default (no light flash on paint), quiet timestamps and dots until needed, motion as a single settle rather than scattered entrances. Tenant isolation is the invariant underneath; the surface never leaks another org's weather into your harbor.

**Key Characteristics:**
- Confident ops, not muted everything: decisive primary, neutral everything else.
- Tactile and confident: lifted cards, -2px hover rise, visible 2px focus.
- Sentence case always: weight + proximity group, never tracked-out caps.
- One authored settle: exponential ease-out, transform/shadow only.

## Colors

Confident harbor palette: deep-navy surfaces with Lagoon Purple owning the single primary action per screen; gold and green carry label/status meaning with text, never alone.

### Primary
- **Harbor Purple** (oklch(0.65 0.24 300) dark / oklch(0.55 0.22 300) light): The only primary action per screen (Create, New board), active nav states, focus rings, today badges. Its rarity is the point.
- **Trello Blue legacy** (#0c66e4 family in `globals.css` brand-50..900): Superseded inside `.lagoon` and dark mode by Harbor Purple; do not introduce new blue CTAs.

### Secondary (optional; omit if the project has only one accent)
- **Harbor Gold** (oklch(0.79 0.17 76) dark / oklch(0.72 0.15 80) light): Backlog dots, label tones, drop-target tint (12-22% color-mix). Warmth without owning action.
- **Harbor Green** (oklch(0.72 0.17 160) dark / oklch(0.6 0.15 160) light): In-progress dots, success checks, progress. Text + icon always accompany the hue.

### Tertiary (optional)
- **Signal Red** (oklch(0.66 0.22 20)): Errors and destructive only. Never a brand accent.
- **Caution Amber** (oklch(0.79 0.17 76)): Warnings and overdue emphasis with text (Overdue · date), never color alone.

### Neutral
- **Deep Harbor** (oklch(0.16 0.014 255) dark bg / #f6f7f9 light `tf-bg`): Canvas. Dark-first default via `tf.theme.v2`.
- **Dock Surface** (oklch(0.205 0.017 255) / #ffffff light): Cards, header, modals.
- **Trough** (oklch(0.23 0.016 255) / #f1f2f4 light `col-bg`): Column troughs, muted fills, list wells.
- **Harbor Line** (oklch(0.285 0.02 255) / #dde2ea light): 1px borders only. Never a side stripe above 1px.
- **Ink** (oklch(0.95 0.008 250) / #172b4d light `slate-900`): Primary text.
- **Fog** (oklch(0.67 0.018 250) / #5d6676 light `tf-muted`): Secondary text, placeholders, timestamps (≥4.5:1 on surfaces; tint from surface hue on colored fills, never gray-on-color).

### Named Rules (optional, powerful)
**The One Voice Rule.** Harbor Purple appears on ≤1 primary action per screen plus active states. Everything else stays neutral.
**The Meaning-With-Text Rule.** Gold/green/red never carry meaning by color alone; pill + dot + text label travel together.

## Typography

**Display Font:** Space Grotesk Variable (with system-ui fallback)
**Body Font:** DM Sans Variable (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono Variable for data only (keys, counts, due dates, timestamps with tabular-nums)

**Character:** Workhorse sans + one display voice. Weight and spacing carry hierarchy; Sora/Manrope/Hanken files stay loaded for compat but never split the UI voice.

### Hierarchy
- **Display** (600, clamp(1.875rem, 4vw, 2.25rem), 1.1, -0.02em): Calendar title, dashboard hero. Max 6rem, balanced headings.
- **Headline** (600, 1.5rem / 1.125rem, 1.2): Page titles (16-20px observed in board header, task detail 20px).
- **Title** (600, 0.8125rem, 1.4, -0.01em): Card titles (13px), list heads (13px), modal titles. Two-line clamp on cards.
- **Body** (400, 0.9375rem, 1.55): Chat, descriptions, empty copy. Max 68ch on prose surfaces (`.task-description`, `.empty-msg`, `.lagoon-card-desc`).
- **Label** (600, 0.75rem, 1.4, 0.01em, sentence case): Section labels, field labels, pills. Never ALL-CAPS eyebrows.

### Named Rules (optional)
**The Sentence-Case Rule.** No kickers or eyebrows above headings. The heading carries its own weight.
**The Tabular Data Rule.** Counts, due dates, and timestamps use tabular-nums; never proportional figures in dense cells.

## Layout

Three-surface harbor: canvas (`tf-bg` / `lagoon-surface`), trough (`lagoon-muted` / `col-bg` #f1f2f4), card (`lagoon-card` / white). Shell is sidebar (15rem neutral card / 256px ctx) + main, 100dvh flex with hidden overflow. Board canvas scrolls horizontally with edge fades riding the content (`background-attachment: local`); lists scroll vertically inside columns with the same ride-with-content fade. 4px scale only (`--s-1..7`: 4/8/12/16/24/32/48). Tight groups, generous separation, more space above a heading than below it. Container: single centered rhythm shared by `.page` and `.lagoon-dash-inner` — 72rem max, 32/20/48 padding (48/32 on sm+) — so every route shares one left edge. Page headers top-align (`flex-start`) with actions wrapping below the title on narrow screens. Responsive: sidebar fixes off-canvas below 1024px with 180ms slide; desktop search hides below 768px with full-width mobile search last in the filterbar; avatar cluster hides below 640px; Create keeps its label on all sizes; columns min 280px (272px mobile) flex-grow to fill, calendar cells 7rem (9rem on sm+). No global `.hidden` override; Tailwind owns visibility.

## Elevation & Depth

**The Lifted-Card Rule. Cards rest lifted; overlays lift further.**

Lifted cards per user direction: resting cards carry a soft offset blur (`lagoon-shadow-sm`: 0 1px 2px rgb(15 23 42 / 0.05) light / 0 1px 2px rgb(0 0 0 / 0.4) dark), never a zero-offset halo. Hover raises to md with -2px translate; drag lifts to 0 16px 32px -12px rgb(0 0 0 / 0.35) with scale 0.98 rotate 2deg on one easing curve.

### Shadow Vocabulary (if applicable)
- **Resting** (`0 1px 2px rgb(15 23 42 / 0.05)` light / `0 1px 2px rgb(0 0 0 / 0.4)` dark): Lifted card at rest.
- **Raised** (`0 9px 24px -16px color-mix(ink 40%, transparent)`): Card hover, menus, timeline rows. Interaction response only.
- **Overlay** (`0 24px 48px -12px rgb(15 23 42 / 0.25)` light / `rgb(0 0 0 / 0.65)` dark): Modals, dropdowns, toasts. Dim veil 40% ink behind modals; 70% rgb(4 8 18) in dark portals.

### Named Rules (optional)
**The Offset-And-Blur Rule.** Every shadow carries offset + soft blur. A zero-offset colored halo is decoration, not depth.

## Shapes

Form language is small, round, and quiet: details 2px (`--r-sm`), controls 6px (`--r-md`), cards 8px (`--r-lg`), dialogs 12px (`--r-xl`). Pills are semantic tags only (label pills 4px, badges/tags 9999px with 1px tinted border); circles are avatars only (28px default, 20/32 variants, 2px white ring in stacks). Borders are 1px `Harbor Line`; skip the border when spacing or surface contrast already separates, never outline every element. No side-tab accents: priority/status ride on pill + dot + text, never a 3px `border-left` (detector side-tab, craft-floor >1px side-border ban). No glass-as-decoration; calendar panel blur (18px saturate 125%) is a scoped effect, not a default. No hard offset block shadows outside neobrutalism.

## Components

### Buttons
Tactile and confident. Shape 8px (6px icon-btns 22-36px). Primary: Harbor Purple fill, white ink, 13px 600, 8/16 padding; hover brightness filter (1.06-1.08), disabled 0.5 opacity. Secondary: muted fill ink text. Ghost: transparent, hover muted fill. Danger: transparent green-text pattern in Lagoon (errors elsewhere stay Signal Red). Focus: 2px Harbor Purple outline offset 2px. One primary CTA per screen (calendar view cedes creation to EventManager).

### Chips
Label pills (10px 600, 2/6 padding, 4px radius) in 12% color-mix tints with matching text + dot; tags/badges pill 9999px with 1px tinted border (brand-50/brand-200 light). State is selected/unselected via `is-on` ring (ink 1px + outer ring), never color alone.

### Cards / Containers
Lagoon cards: 8px corner, 1px Harbor Line, Dock Surface bg, 12px padding, resting lifted shadow. Hover: -2px translate, ink-tinted border, md shadow. Done: 0.7 opacity + success check. Focus-visible: 2px purple outline on the focusable wrapper (`data-slot="lagoon-card"`). Title 14px 600 three-line clamp; desc 13px Fog three-line clamp; priority pill + dot + text (critical/high/medium/low) above title; foot 12px min-28 wrapped row with top divider, avatar/due/stats. Drop targets tint gold 12-22% + inset 1px gold ring with background/box-shadow transition only (no layout shift). Columns: 12px trough, 12px padding, flex 1 1 0 min 280px max 420px so the board fills wide viewports and scrolls horizontally when minimums overflow; body min 120px with internal scroll.

### Inputs / Fields
Bordered fields: surface bg, 1px Harbor Line, 8px radius, 8/12 padding, 12-13px. Focus: purple border + 3px 15% purple ring, surface stays. Composer: card-shell with borderless textarea (64px min, 12px, transparent) showing focus on the card. Search: surface fill with icon + kbd hint, focus-within purple border + ring. Error/disabled: Signal Red text with message + 0.5 disabled; never placeholder as label. Caret and selection themed from palette (accent caret, accent-soft selection).

### Navigation
Lagoon sidebar 15rem neutral card fill with Harbor Line border, muted links (13px 500), hover muted wash + ink, `is-on` 12% purple tint + 600 ink with purple-tinted border. Workspace card surface with 1px line and xs shadow, hover purple-tinted border. Header 60px card bg with 1px bottom border: title 20px 600 + 12px Fog sub, centered search (280-480px, 36px), avatar cluster (28px, -8 overlap, hashed tones), icon-btns 36px 8px with muted→ink hover (40px on coarse pointers). View tabs: 13px pills with sliding `layoutId` underline in primary. Filterbar groups views + tag filter + scope with divider, Clear control when filtered. Timestamps hover-reveal on precise pointers, always visible on touch/focus.

### Signature Component
Joyful month calendar: frosted panel (card 78% + border 76%, 8px, 18px blur) with 7-col grid, 7-9rem cells, chip cards (surface 90% + inset 1px border 60%) lifting on hover with purple inset ring; today is a purple filled daynum; undated tray is a bordered card below.

## Do's and Don'ts

Concrete guardrails from the incumbent implementation and the chosen world.

### Do:
- **Do** keep one Harbor Purple primary per screen; everything else neutral with active states borrowing the accent sparingly.
- **Do** pair every status/priority hue with pill + dot + text (e.g. Overdue · date, 2/4 checklist, Done check).
- **Do** use 2px focus outlines offset 2px on every interactive element, themed from Harbor Purple.
- **Do** theme browser surfaces from the palette: accent caret, accent-soft selection, thin line-colored scrollbars, tabular data numerals.
- **Do** honor reduced motion: kill the settle and the -2px lift, keep state changes instant.
- **Do** return focus to the opening card/row on modal close and announce moves/toasts in plain language.

### Don't:
- **Don't** use `border-left`/`border-right` above 1px on cards, list items, callouts, or toasts (inset shadow or pill instead).
- **Don't** add kickers/eyebrows above headings or gradient text for emphasis (weight/size carry it).
- **Don't** animate width/height/padding/margin (use transform/opacity, or grid-template-rows for height).
- **Don't** put gray text on colored fills (tint secondary text from that hue or use white/near-white).
- **Don't** invent new blue CTAs, new font families, or ad-hoc px outside the 4px scale; `impeccable-tokens.css` loads last and wins.
- **Don't** split the source of truth: `:root` owns light, `.dark` owns dark, `.lagoon` owns Lagoon scope.
