"use client";

import React, { type ComponentType } from "react";
import Link from "next/link";
import { motion, MOTION_SPRINGS } from "@/components/motion";
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

export function LagoonWorkspaceNav({ items, onNavigate }: LagoonWorkspaceNavProps) {
  return (
    <nav className="px-3 pt-3" aria-label="Workspace sections">
      <p className="px-2 pb-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--tf-fg-muted)] select-none">
        Workspace
      </p>

      <div className="relative flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isCurrent = item.on;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isCurrent ? "page" : undefined}
              onClick={onNavigate}
              className={cx(
                "group relative flex items-center gap-2.5 px-2.5 h-9 text-xs rounded-xl transition-colors outline-none select-none",
                isCurrent
                  ? "text-purple-600 dark:text-purple-300 font-semibold"
                  : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]",
              )}
            >
              {/* Active Pill with layoutId for GPU-accelerated smooth slide */}
              {isCurrent ? (
                <motion.div
                  layoutId="tf-nav-active-pill"
                  className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/25 dark:border-purple-400/30"
                  transition={MOTION_SPRINGS.snappy}
                >
                  <div className="absolute left-1 top-2 bottom-2 w-1 rounded-full bg-purple-600 dark:bg-purple-400" />
                </motion.div>
              ) : null}

              <Icon
                size={16}
                className={cx(
                  "relative z-10 shrink-0 transition-colors",
                  isCurrent
                    ? "text-purple-600 dark:text-purple-300"
                    : "text-[var(--tf-fg-muted)] group-hover:text-[var(--tf-fg)]",
                )}
              />
              <span className="relative z-10 truncate">{item.label}</span>

              {item.badge && item.badge > 0 ? (
                <span
                  className={cx(
                    "relative z-10 ml-auto flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                    isCurrent
                      ? "bg-purple-500/30 text-purple-700 dark:text-purple-200 ring-1 ring-purple-400/50"
                      : "bg-black/10 dark:bg-white/10 text-[var(--tf-fg-muted)]",
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
