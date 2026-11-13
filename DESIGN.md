---
name: TeamFlow
description: The quiet harbor for high-velocity teams — high-density, calm, keyboard-friendly project and kanban board
colors:
  primary: "#9333ea"
  primary-hover: "#7e22ce"
  neutral-bg-dark: "#0b0f17"
  neutral-bg-light: "#f8fafc"
  surface-glass-1: "rgba(255, 255, 255, 0.05)"
  surface-glass-2: "rgba(255, 255, 255, 0.09)"
  surface-glass-3: "rgba(255, 255, 255, 0.14)"
  surface-card-dark: "#131a26"
  surface-card-light: "#ffffff"
  border-glass: "rgba(255, 255, 255, 0.10)"
  border-glass-subtle: "rgba(255, 255, 255, 0.06)"
  border-highlight: "rgba(255, 255, 255, 0.18)"
  text-primary-dark: "#f8fafc"
  text-primary-light: "#0f172a"
  text-muted-dark: "#94a3b8"
  text-muted-light: "#64748b"
  status-gold: "#f59e0b"
  status-purple: "#a855f7"
  status-green: "#10b981"
  status-success: "#22c55e"
  status-danger: "#ef4444"
typography:
  display:
    fontFamily: "'Space Grotesk Variable', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Space Grotesk Variable', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'DM Sans Variable', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'DM Sans Variable', -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.01em"
  mono:
    fontFamily: "'JetBrains Mono Variable', monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted-dark}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  kanban-card:
    backgroundColor: "{colors.surface-card-dark}"
    textColor: "{colors.text-primary-dark}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
---

# TeamFlow Design System

<!-- impeccable:design-schema 1 -->

## Overview
TeamFlow is designed around the ethos of **"the quiet harbor for high-velocity teams"**. It is a mission-critical, dense, calm, and keyboard-oriented workspace. Users spend full workdays navigating boards, updating sprint tasks, reviewing project milestones, and tracking activity streams.

### Principles
1. **Calm & Focused**: Density without visual fatigue. Quiet surfaces keep focus on work items.
2. **One Clear Action Per Surface**: Visual hierarchy ensures every view highlights its primary CTA.
3. **Tenant & Role Permanently Visible**: The active organization and user's scoped RBAC role (`owner`, `admin`, `member`, `viewer`) are always transparent. Viewers see explicit read-only affordances with explanatory tooltips, never unresponsive dead buttons.
4. **Never Hide Sync State**: Realtime connection, replay buffer, and websocket status are explicitly visible in the navigation chrome.
5. **Restrained Glassmorphism**: Glass is reserved exclusively for floating navigation and modal layers (`sidebar`, `top bar`, `drawers`, `command palette`, `toasts`). Kanban cards and table rows stay opaque/solid to preserve high contrast and density.

---

## Colors

The color palette is built on OKLCH and calibrated for dual dark/light support, anchored by deep nautical/slate foundations and a single authoritative purple accent.

- **Primary Brand Accent**:
  - `var(--tf-brand)`: OKLCH purple (`oklch(0.65 0.24 300)` / `#9333ea`)
  - Hover: `oklch(0.58 0.25 300)` / `#7e22ce`
  - Background tint: `oklch(0.65 0.24 300 / 0.12)`
- **Canvas Foundations**:
  - Dark mode: `#0b0f17` with subtle ambient radial gradients (`oklch(0.65 0.24 300 / 0.03)` top-left, `oklch(0.68 0.16 230 / 0.03)` bottom-right)
  - Light mode: `#f8fafc` with gentle cool ambient radiance
- **Surfaces & Glass Elevations**:
  - `Elevation 1` (Filter bar, inline chips): `rgba(255, 255, 255, 0.05)`, blur 12px, border `rgba(255, 255, 255, 0.08)`
  - `Elevation 2` (Sidebar, Top bar, Floating headers): `rgba(255, 255, 255, 0.085)`, blur 18px, border `rgba(255, 255, 255, 0.12)`, top-edge highlight `rgba(255, 255, 255, 0.18)`
  - `Elevation 3` (Command palette, Task drawer, Modals, Menus): `rgba(20, 26, 38, 0.88)` on dark / `rgba(255, 255, 255, 0.92)` on light, blur 24px, layered soft shadow
- **Semantic Status Accents**:
  - Backlog: Gold (`#f59e0b`)
  - To Do: Purple (`#a855f7`)
  - In Progress: Teal/Green (`#10b981`)
  - Done: Success Emerald (`#22c55e`)
  - Critical / Overdue: Destructive Coral (`#ef4444`)

---

## Typography

TeamFlow combines modern geometric sans-serif displays with clear, humanist body type and tabular numerals.

- **Display & Section Titles**: Space Grotesk (`@fontsource-variable/space-grotesk`)
  - Board headers, dialog titles, dashboard metrics: `letter-spacing: -0.015em`, weights 600–700
- **Body & Controls**: DM Sans (`@fontsource-variable/dm-sans`)
  - Card titles, descriptions, navigation links, form labels, buttons: weights 400, 500, 600
- **Data, Short IDs & Timestamps**: JetBrains Mono (`@fontsource-variable/jetbrains-mono`)
  - Task keys (`LGN-8F3B91`), sprint metrics, checklist counters, dates: `tabular-nums`, weights 500

---

## Layout

- **Unified Lagoon Shell**: Fixed left glass sidebar (width: 256px collapsed/compact responsive), sticky top navigation bar (height: 56px), scrollable main canvas.
- **Kanban Board Columns**: Horizontal flex container with `scroll-snap-type: x mandatory` (`tf-columns-snap`) ensuring flawless touch and tablet scrolling.
- **Responsive Adaptations**:
  - Desktop (>1024px): Expanded multi-column board, dual sidebar navigation with workspace switcher and role badge.
  - Tablet (768px–1024px): Snap-aligned board columns, responsive search input.
  - Mobile (<768px): Sliding navigation drawer with 44px touch targets, full-width column view with horizontal swipe, sticky mobile action buttons.

---

## Elevation & Depth

Layering follows strict hierarchical elevations without artificial drop-shadow clutter:
1. **Canvas Level (0)**: Restrained ambient radial background; low contrast, static, zero CPU overhead.
2. **Content Level (1 - Solid)**: Kanban cards, table rows, list items. Rendered solid (`tf-kanban-card`) to guarantee maximum text legibility and contrast under WCAG AA.
3. **Navigation Glass (2 - Translucent)**: Sidebar and header bar. Blurs canvas underneath (16–20px) with 1px translucent border and top highlight.
4. **Modal & Overlays (3 - Elevated Glass)**: Drawers, dialogs, ⌘K palette, dropdown menus. Soft multi-layer depth shadow `0 20px 48px -12px rgba(0, 0, 0, 0.35)`.
- **Fallbacks**: `@supports not (backdrop-filter: blur(1px))` and `@media (prefers-reduced-transparency: reduce)` fall back to 98% solid background colors.

---

## Shapes

- **Base Radius**: 10px (`--radius-md`) for buttons, inputs, dropdown items.
- **Card & Column Radius**: 14px (`--radius-lg`) for kanban columns, team cards, and project rows.
- **Floating Modals & Drawers**: 18px (`--radius-xl`) with smooth corner curvature.
- **Pills & Badges**: Fully rounded (`rounded-full`, 9999px) for status indicators, role badges, tag chips, and avatar fallbacks.

---

## Components

### 1. LagoonShell & Navigation
- **Workspace Selector**: Dropdown displaying active tenant, tenant switch options, and settings shortcut.
- **RoleBadge**: Pill badge explicitly showing `Owner`, `Admin`, `Member`, or `Viewer` with role description tooltips.
- **RealtimeStatusBadge**: Live indicator displaying `Connected`, `Syncing`, `Replaying (N events)`, or `Disconnected` with subtle animated status dot.
- **Quick Search (⌘K)**: Trigger button in the top bar opening keyboard palette.

### 2. Kanban Board & Task Cards
- **LagoonTaskCard (`tf-kanban-card`)**:
  - Mono task identifier (`LGN-...`).
  - Priority badge (combines colored dot + text label; never conveys priority via color alone).
  - Title with multi-line clamp and tooltip.
  - Due date badge with overdue highlighting.
  - Assignee avatar with initials and contrast-safe background.
  - Checklist progress count.
  - Native HTML5 mouse drag-and-drop and touch long-press pointer events.
  - Keyboard move menu accessible via `M`.
  - Realtime update pulse (`tf-realtime-pulsing`): Highlights remote task changes with a brief border pulse without re-animating the whole board.

### 3. GlassSurface Component
- Reusable component (`<GlassSurface elevation={1 | 2 | 3}>`) providing standardized blur, translucent fill, borders, and reduced-transparency fallbacks.

### 4. Motion Tokens
- Centralized in `lib/motion-tokens.ts`:
  - `DUR`: fast (140ms), base (220ms), slow (350ms)
  - `EASE`: `easeOut`, `easeInOut`, `easeIn`
  - `SPRINGS`: `snappy` (stiffness 380, damping 28), `soft` (stiffness 240, damping 26), `settle` (stiffness 320, damping 32)
  - Layout transitions: Position-only, respecting `MotionConfig reducedMotion="user"`.

---

## Do's and Don'ts

### Do:
- **Do** preserve solid backgrounds for task cards and dense lists so text contrast never suffers.
- **Do** provide keyboard shortcuts (`/` for search, `c`/`n` for new card, `m` for card move, `⌘K` for palette).
- **Do** disable creation/mutation controls for `viewer` roles with explanatory tooltips.
- **Do** animate only `transform` and `opacity` properties.
- **Do** respect `prefers-reduced-motion` and `prefers-reduced-transparency`.
- **Do** scope all app redesign styles under `.tf-app-scope` to keep homepage and auth completely unaffected.

### Don't:
- **Don't** use AI-slop color gradients (e.g., purple-to-pink gradients, gradient text, glowing blobs).
- **Don't** animate blur radius or stack more than 2 blur layers.
- **Don't** convey meaning or priority through color alone without accompanying text or icons.
- **Don't** show dead, unresponsive buttons to viewers without explaining permission constraints.
- **Don't** re-animate or reflow the entire board when a single realtime event arrives.
- **Don't** touch or alter protected pages (`/`, `/auth/sign-in`, `/auth/sign-up`).
