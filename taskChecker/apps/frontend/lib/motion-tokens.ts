/* Central Motion Tokens for TeamFlow
   Adheres to Motion specifications:
   - Durations: fast (140ms), base (220ms), slow (350ms)
   - Easings: easeOut [0.16, 1, 0.3, 1], easeInOut [0.65, 0, 0.35, 1], easeIn [0.32, 0, 0.67, 0]
   - Springs: snappy, soft, settle
   - Stagger: 35ms per item capped at 8 items
   - Only transform and opacity animations.
*/

import type { Transition, Variants } from "framer-motion";

export const MOTION_DURATIONS = {
  instant: 0.08,
  fast: 0.14,    // 140ms (120-160ms range)
  base: 0.22,    // 220ms (200-260ms range)
  slow: 0.35,    // 350ms (320-400ms range)
} as const;

export const MOTION_EASINGS = {
  easeOut: [0.16, 1, 0.3, 1] as const,
  easeInOut: [0.65, 0, 0.35, 1] as const,
  easeIn: [0.32, 0, 0.67, 0] as const,
} as const;

export const MOTION_SPRINGS = {
  snappy: {
    type: "spring",
    stiffness: 380,
    damping: 28,
    mass: 0.8,
  } as const,
  soft: {
    type: "spring",
    stiffness: 220,
    damping: 24,
    mass: 1,
  } as const,
  settle: {
    type: "spring",
    stiffness: 300,
    damping: 30,
    mass: 0.9,
  } as const,
} as const;

export const STAGGER_CONFIG = {
  step: 0.035, // 35ms <= 40ms
  maxItems: 8,
} as const;

// Transition presets
export const TRANSITIONS = {
  fast: {
    duration: MOTION_DURATIONS.fast,
    ease: [...MOTION_EASINGS.easeOut],
  } satisfies Transition,
  base: {
    duration: MOTION_DURATIONS.base,
    ease: [...MOTION_EASINGS.easeOut],
  } satisfies Transition,
  slow: {
    duration: MOTION_DURATIONS.slow,
    ease: [...MOTION_EASINGS.easeOut],
  } satisfies Transition,
  snappySpring: MOTION_SPRINGS.snappy satisfies Transition,
  softSpring: MOTION_SPRINGS.soft satisfies Transition,
  settleSpring: MOTION_SPRINGS.settle satisfies Transition,
} as const;

// Reusable Variants
export const VARIANTS = {
  // Route transitions: subtle fade plus 6-8px shift
  routeTransition: {
    initial: { opacity: 0, y: 7 },
    animate: { opacity: 1, y: 0, transition: TRANSITIONS.base },
    exit: { opacity: 0, y: -4, transition: TRANSITIONS.fast },
  } satisfies Variants,

  // Modal and popover: scale from origin (0.96 to 1) + opacity
  modal: {
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0, transition: TRANSITIONS.base },
    exit: { opacity: 0, scale: 0.96, y: 4, transition: TRANSITIONS.fast },
  } satisfies Variants,

  // Command palette scale & fade
  commandPalette: {
    initial: { opacity: 0, scale: 0.98, y: -10 },
    animate: { opacity: 1, scale: 1, y: 0, transition: TRANSITIONS.fast },
    exit: { opacity: 0, scale: 0.98, y: -6, transition: TRANSITIONS.fast },
  } satisfies Variants,

  // Task drawer: slide in from right + backdrop
  drawerBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: TRANSITIONS.fast },
    exit: { opacity: 0, transition: TRANSITIONS.fast },
  } satisfies Variants,

  drawerContent: {
    initial: { x: "100%", opacity: 0.8 },
    animate: { x: "0%", opacity: 1, transition: TRANSITIONS.softSpring },
    exit: { x: "100%", opacity: 0.8, transition: TRANSITIONS.fast },
  } satisfies Variants,

  // Card hover lift (2px max)
  cardHover: {
    rest: { y: 0, scale: 1 },
    hover: { y: -2, scale: 1.005, transition: TRANSITIONS.fast },
    tap: { scale: 0.98, transition: { duration: 0.08 } },
  } satisfies Variants,

  // Kanban drag lifting state
  cardDrag: {
    dragging: {
      scale: 1.02,
      rotate: 1.2,
      zIndex: 50,
      boxShadow: "0 20px 30px -10px rgba(0, 0, 0, 0.5)",
      transition: TRANSITIONS.fast,
    },
    dropped: {
      scale: 1,
      rotate: 0,
      zIndex: 0,
      transition: TRANSITIONS.settleSpring,
    },
  } satisfies Variants,

  // Realtime card pulse highlight
  cardRealtimePulse: {
    initial: { boxShadow: "0 0 0 0px rgba(168, 85, 247, 0)" },
    pulse: {
      boxShadow: [
        "0 0 0 0px rgba(168, 85, 247, 0.7)",
        "0 0 0 6px rgba(168, 85, 247, 0)",
      ],
      transition: { duration: 0.8, ease: "easeOut" },
    },
  } satisfies Variants,

  // List item stagger container
  staggerList: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: STAGGER_CONFIG.step,
        delayChildren: 0.02,
      },
    },
  } satisfies Variants,

  listItem: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0, transition: TRANSITIONS.fast },
    exit: { opacity: 0, scale: 0.96, transition: TRANSITIONS.fast },
  } satisfies Variants,
} as const;
