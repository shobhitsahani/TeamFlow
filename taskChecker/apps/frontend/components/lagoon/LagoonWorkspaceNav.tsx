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
  const primaryLabels = new Set(["Boards", "Projects", "Teams", "Work"]);
  const primaryItems = items.filter((i) => primaryLabels.has(i.label));
  const secondaryItems = items.filter((i) => !primaryLabels.has(i.label));

  const renderNavList = (list: NavItem[]) => (
    <div className="relative flex flex-col gap-1">
      {list.map((item) => {
        const Icon = item.icon;
        const isCurrent = item.on;

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isCurrent ? "page" : undefined}
            onClick={onNavigate}
            className={cx(
              "group relative flex items-center gap-2.5 px-2.5 h-8.5 text-xs rounded-xl transition-all outline-none select-none",
              isCurrent
                ? "text-[var(--tf-fg)] font-semibold shadow-xs"
                : "text-[var(--tf-fg-muted)] hover:text-[var(--tf-fg)] hover:bg-[var(--tf-hover-bg)]",
            )}
          >
            {/* Subtle Active Pill — surface tint plus weight without heavy bright bar */}
            {isCurrent ? (
              <motion.div
                layoutId="tf-nav-active-pill"
                className="pointer-events-none absolute inset-0 z-0 rounded-xl bg-black/[0.04] dark:bg-white/[0.07] border border-[var(--tf-border)] shadow-xs"
                transition={MOTION_SPRINGS.snappy}
              />
            ) : null}

            <Icon
              size={15}
              className={cx(
                "relative z-10 shrink-0 transition-colors",
                isCurrent
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-[var(--tf-fg-muted)] group-hover:text-[var(--tf-fg)]",
              )}
            />
            <span className="relative z-10 truncate">{item.label}</span>

            {item.badge && item.badge > 0 ? (
              <span
                className={cx(
                  "relative z-10 ml-auto flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                  isCurrent
                    ? "bg-purple-500/20 text-purple-700 dark:text-purple-200 ring-1 ring-purple-400/40"
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
  );

  return (
    <nav className="px-3 pt-1 flex flex-col gap-3.5" aria-label="Workspace navigation">
      <div>
        <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--tf-fg-muted)] select-none">
          Workspace
        </p>
        {renderNavList(primaryItems)}
      </div>

      <div>
        <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--tf-fg-muted)] select-none">
          Manage
        </p>
        {renderNavList(secondaryItems)}
      </div>
    </nav>
  );
}
