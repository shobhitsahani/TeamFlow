"use client";

/* Shared Framer Motion primitives — one place for easings, durations and
   reusable variants so animations stay consistent across board, overlays,
   chat and pages. Respects prefers-reduced-motion via MotionConfig (see
   app/providers.tsx) AND per-component opacity-only fallbacks below. */

import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export { AnimatePresence, MotionConfig, motion, useReducedMotion };
export type { Variants };

/* ---------- shared tokens ----------
   Durations: fast 0.12s, base 0.2s, slow 0.32s (modal enter only).
   Exits run at ~60-70% of their entrance duration. Nothing animates
   over ~300ms except modal enter (slow = 0.32s is the ceiling).
   `instant` (0.08s) is the standard exit for fast entrances. */

export const DUR = {
  instant: 0.08,
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

/* Easings: easeOut for entrances, easeIn for exits. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;

/* One spring for layout moves (drag reorder, tab indicator). Stiff and
   heavily damped — settles fast with no bounce or wobble. */
export const LAYOUT_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.8,
} as const;

/** @deprecated Use LAYOUT_SPRING. Kept for backward compat. */
export const EASE_SPRING = LAYOUT_SPRING;

/* ---------- reduced-motion helpers ----------
   MotionConfig reducedMotion="user" already strips transforms globally,
   but these helpers make individual components robust even outside that
   context: when reduced motion is preferred, fall back to opacity-only
   (no movement, no scale). */

const OPACITY_ONLY: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast } },
  exit: { opacity: 0, transition: { duration: DUR.instant } },
};

/** Return opacity-only variants when the user prefers reduced motion. */
export function useAccessibleVariants(variants: Variants): Variants {
  const reduce = useReducedMotion();
  return reduce ? OPACITY_ONLY : variants;
}

/* ---------- layout-stability helper ----------
   Gate `layout` animations behind first paint so initial mount and data
   refetch never swirl: `layout={layoutReady && !dragging ? "position" : false}`.
   Pass a reset key (e.g. project id) to re-arm the gate when the whole
   list identity changes (board switch) — only real user-driven moves
   (drag reorder, add/delete) animate after that. Position-only layout
   keeps text from stretching while the parent settles. */
export function useLayoutReady(resetKey?: string | number): boolean {
  const [cycle, setCycle] = useState({ key: resetKey, ready: false });
  // Re-arm the gate during render when the list identity changes
  // (render-adjustment pattern: no effect, no cascading render).
  if (cycle.key !== resetKey) {
    setCycle({ key: resetKey, ready: false });
  }
  useEffect(() => {
    if (cycle.ready) return;
    let cancelled = false;
    // Deferred callback — never a synchronous effect-body setState, same
    // shape as the board's localStorage hydration.
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setCycle((c) => ({ ...c, ready: true }));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [cycle.ready, cycle.key]);
  return cycle.ready;
}

/* ---------- generic variants ----------
   Entrance offsets stay small (6-8px translate, 0.96-0.98 scale).
   No large slides, no overshoots. */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: DUR.instant, ease: "easeIn" } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: [...EASE_OUT] },
  },
  exit: {
    opacity: 0,
    y: 6,
    transition: { duration: DUR.fast, ease: [...EASE_IN] },
  },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DUR.base, ease: [...EASE_OUT] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    transition: { duration: DUR.fast, ease: [...EASE_IN] },
  },
};

export const backdropFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast } },
  exit: { opacity: 0, transition: { duration: DUR.instant } },
};

export const sheetRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: DUR.slow, ease: [...EASE_OUT] },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: DUR.base, ease: [...EASE_IN] },
  },
};

export const dropdownMenu: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -4 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: DUR.fast, ease: [...EASE_OUT] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -2,
    transition: { duration: DUR.instant, ease: [...EASE_IN] },
  },
};

export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03, delayChildren: 0.04 } },
  exit: {},
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.base, ease: [...EASE_OUT] },
  },
  exit: { opacity: 0, transition: { duration: DUR.instant } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: DUR.instant } },
};

/* ---------- view / content crossfades ----------
   Tab view switches, skeleton -> content swaps. Opacity-only, 100-150ms,
   never a slide. */

export const viewFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: DUR.instant, ease: "easeIn" } },
};

/** Alias: content crossfading in over skeletons (no pop-in). */
export const contentFade = viewFade;

/** Gentle fadeUp on mount for empty states. */
export const emptyRise = fadeUp;

/* ---------- tiny wrappers ---------- */

/** Page-level entrance: fade + slight rise, no layout shift. */
export function PageEnter({
  children,
  className,
  style,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: [...EASE_OUT], delay }}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container — wrap grids / columns / lists. */
export function Stagger({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={staggerParent}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

/** Stagger child — each card / row inside <Stagger>. */
export function StaggerItem({
  children,
  className,
  style,
  layout,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  layout?: boolean;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={staggerChild}
      layout={layout}
    >
      {children}
    </motion.div>
  );
}
