"use client";

import React from "react";
import { cx } from "@/lib/utils";

export interface RealtimeStatusBadgeProps {
  status?: "connected" | "syncing" | "disconnected" | "replaying";
  className?: string;
  onReconnect?: () => void;
}

export function RealtimeStatusBadge({
  status = "connected",
  className,
  onReconnect,
}: RealtimeStatusBadgeProps) {
  const configs = {
    connected: {
      label: "Realtime Synced",
      dotClass: "bg-emerald-400 animate-pulse",
      badgeClass:
        "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300",
    },
    syncing: {
      label: "Syncing…",
      dotClass: "bg-amber-400 animate-pulse",
      badgeClass:
        "border-amber-500/25 bg-amber-500/10 text-amber-400 dark:text-amber-300",
    },
    replaying: {
      label: "Replaying stream",
      dotClass: "bg-blue-400 animate-pulse",
      badgeClass:
        "border-blue-500/25 bg-blue-500/10 text-blue-400 dark:text-blue-300",
    },
    disconnected: {
      label: "Offline • Reconnecting",
      dotClass: "bg-rose-400",
      badgeClass:
        "border-rose-500/25 bg-rose-500/10 text-rose-400 dark:text-rose-300",
    },
  };

  const current = configs[status] ?? configs.connected;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight select-none",
        current.badgeClass,
        className
      )}
      title={`Connection status: ${current.label}`}
    >
      <span
        className={cx(
          "size-1.5 rounded-full motion-reduce:animate-none",
          current.dotClass
        )}
        aria-hidden="true"
      />
      <span>{current.label}</span>
      {status === "disconnected" && onReconnect && (
        <button
          type="button"
          onClick={onReconnect}
          className="ml-1 underline hover:no-underline text-xs"
        >
          Retry
        </button>
      )}
    </div>
  );
}
