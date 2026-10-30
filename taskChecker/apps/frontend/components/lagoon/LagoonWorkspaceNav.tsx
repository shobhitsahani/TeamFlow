"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "@/components/motion";
import { cx } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  on: boolean;
  badge?: number;
}

interface LagoonWorkspaceNavProps {
  items: NavItem[];
  onNavigate?: () => void;
}

// Module-level memory so position persists across Next.js page remounts
let lastKnownIndex = -1;

export function LagoonWorkspaceNav({ items, onNavigate }: LagoonWorkspaceNavProps) {
  const activeIndex = Math.max(0, items.findIndex((it) => it.on));
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [coords, setCoords] = useState<{ top: number; height: number }>({ top: 0, height: 36 });
  const [hoverCoords, setHoverCoords] = useState<{ top: number; height: number }>({ top: 0, height: 36 });
  const [mounted, setMounted] = useState(false);

  const currentIndex = optimisticIndex !== null ? optimisticIndex : activeIndex;

  // Clear optimistic override when real activeIndex syncs with URL
  useEffect(() => {
    if (optimisticIndex !== null && activeIndex === optimisticIndex) {
      setOptimisticIndex(null);
    }
  }, [activeIndex, optimisticIndex]);

  // Keep module cache updated
  useEffect(() => {
    lastKnownIndex = currentIndex;
  }, [currentIndex]);

  // Measure element positions accurately
  useLayoutEffect(() => {
    const el = itemRefs.current[currentIndex];
    const container = containerRef.current;
    if (el && container) {
      const top = el.offsetTop;
      const height = el.offsetHeight;
      setCoords({ top, height });
    }
  }, [currentIndex]);

  useLayoutEffect(() => {
    if (hoverIndex !== null) {
      const el = itemRefs.current[hoverIndex];
      if (el) {
        setHoverCoords({ top: el.offsetTop, height: el.offsetHeight });
      }
    }
  }, [hoverIndex]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const initialTop = mounted || lastKnownIndex < 0
    ? coords.top
    : (lastKnownIndex * 40);

  return (
    <nav className="px-3 pt-4" aria-label="Workspace sections">
      <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-slate-400 select-none">
        Workspace
      </p>

      <div
        ref={containerRef}
        className="relative flex flex-col gap-1"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Hover backdrop pill */}
        <AnimatePresence>
          {hoverIndex !== null && hoverIndex !== currentIndex && (
            <motion.div
              key="hover-pill"
              className="pointer-events-none absolute left-0 right-0 z-0 rounded-xl bg-white/[0.04] border border-white/5"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{
                opacity: 1,
                scale: 1,
                top: hoverCoords.top,
                height: hoverCoords.height,
              }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{
                type: "spring",
                stiffness: 450,
                damping: 30,
              }}
            />
          )}
        </AnimatePresence>

        {/* Liquid Active Indicator Pill */}
        <motion.div
          className="pointer-events-none absolute left-0 right-0 z-0 rounded-xl"
          initial={{ top: initialTop, height: coords.height }}
          animate={{
            top: coords.top,
            height: coords.height,
          }}
          transition={{
            top: { type: "spring", stiffness: 340, damping: 26, mass: 0.7 },
            height: { type: "spring", stiffness: 340, damping: 26 },
          }}
        >
          {/* Frosted Glass Capsule */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/20 via-white/[0.09] to-white/[0.04] border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-xs" />

          {/* Liquid Edge Meniscus Glow */}
          <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-purple-400 via-indigo-300 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" />

          {/* Prismatic Shimmer Accent */}
          <div className="absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </motion.div>

        {/* Navigation Items */}
        {items.map((item, idx) => {
          const Icon = item.icon;
          const isCurrent = idx === currentIndex;

          return (
            <Link
              key={item.label}
              href={item.href}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              aria-current={isCurrent ? "page" : undefined}
              onMouseEnter={() => setHoverIndex(idx)}
              onClick={() => {
                setOptimisticIndex(idx);
                onNavigate?.();
              }}
              className={cx(
                "group relative z-10 flex items-center gap-2.5 px-2.5 h-9 text-xs font-medium rounded-xl transition-colors duration-150 outline-none select-none",
                isCurrent
                  ? "text-white font-semibold"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              <Icon
                size={16}
                className={cx(
                  "shrink-0 transition-all duration-200",
                  isCurrent
                    ? "text-purple-300 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] scale-105"
                    : "text-slate-400 group-hover:text-slate-200",
                )}
              />
              <span className="truncate">{item.label}</span>

              {item.badge && item.badge > 0 ? (
                <span
                  className={cx(
                    "ml-auto flex size-4 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                    isCurrent
                      ? "bg-purple-500/30 text-purple-200 ring-1 ring-purple-400/50"
                      : "bg-white/10 text-slate-300 ring-1 ring-white/10",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
